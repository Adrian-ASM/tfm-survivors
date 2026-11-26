import type { HitSnapshot } from '../run/RunSnapshot';
import type { WeaponTarget } from '../weapon/WeaponTarget';
import type { CombatRules } from './CombatRules';
import type { HitKind, TargetHitKind } from './HitKind';

/**
 * Registro de un golpe (mutable y reutilizable dentro del anillo de `HitLog`, ADR-0003): escalares,
 * el objetivo del tick (solo para sumar por referencia) y su vista congelada, creada una vez.
 */
export class HitRecord {
  id = -1;
  tick = 0;
  kind: HitKind = 'enemy';
  /** Id del enemigo, estructura u oveja; −1 en `player`. */
  targetId = -1;
  x = 0;
  y = 0;
  amount = 0;
  target: WeaponTarget | null = null;
  view: HitSnapshot | null = null;
}

/**
 * Registro de golpes de combate de una partida (servicio de dominio con estado, propiedad de `Run`;
 * ADR-0027). Todo el daño de armas y explosiones pasa por `strike`, que anota el **daño aplicado**
 * (vida antes − después) sumado por objetivo y tick, con un id de una secuencia propia. Anillo
 * preasignado de `hitWindowTicks × (maxHitsPerTick + 1)` registros: cero asignaciones por golpe. No
 * consume azar ni cambia ninguna regla: `strike` devuelve lo mismo que `takeDamage`.
 */
export class HitLog {
  private readonly ring: HitRecord[] = [];
  /** Registros escritos en la partida (el siguiente va a `written % capacidad`). */
  private written = 0;
  /** Primer registro del tick abierto (índice absoluto). */
  private tickStart = 0;
  private current = -1;
  private ids = 0;
  /** Golpes de no jugador del tick abierto (tope `maxHitsPerTick`; el del jugador va aparte). */
  private targets = 0;

  constructor(private readonly rules: CombatRules | null) {
    const capacity = rules ? rules.hitWindowTicks * (rules.maxHitsPerTick + 1) : 0;
    for (let i = 0; i < capacity; i++) this.ring.push(new HitRecord());
  }

  /** Registro que aplica el daño y no anota nada (por defecto fuera de `Run`). */
  static disabled(): HitLog {
    return new HitLog(null);
  }

  /** Siguiente id de la secuencia (= golpes registrados en la partida). */
  get nextId(): number {
    return this.ids;
  }

  /** Abre el tick n: los golpes siguientes son de ese tick. */
  begin(n: number): void {
    this.current = n;
    this.tickStart = this.written;
    this.targets = 0;
  }

  /**
   * Aplica `amount` a `t` en el tick n y anota lo que de verdad le quita (nada si no le quita vida),
   * sumado al golpe que `t` ya tenga en el tick. Devuelve si el impacto lo deja a 0.
   */
  strike(kind: TargetHitKind, t: WeaponTarget, amount: number, n: number): boolean {
    const before = t.hp;
    const killed = t.takeDamage(amount, n);
    const applied = before - t.hp;
    if (applied <= 0 || this.ring.length === 0) return killed;
    if (n !== this.current) this.begin(n);
    const own = this.find(t);
    if (own) {
      own.amount += applied;
      return killed;
    }
    // Tope lleno: el golpe nuevo se descarta (sin id); el daño ya está aplicado.
    if (this.targets >= (this.rules?.maxHitsPerTick ?? 0)) return killed;
    this.targets += 1;
    const r = this.next();
    r.kind = kind;
    r.targetId = t.id;
    r.x = t.x;
    r.y = t.y;
    r.amount = applied;
    r.target = t;
    r.tick = n;
    return killed;
  }

  /** Golpe al jugador del paso 5 (vida antes − después, ya con armadura y recorte). */
  recordPlayer(x: number, y: number, amount: number, n: number): void {
    if (amount <= 0 || this.ring.length === 0) return;
    if (n !== this.current) this.begin(n);
    const r = this.next();
    r.kind = 'player';
    r.targetId = -1;
    r.x = x;
    r.y = y;
    r.amount = amount;
    r.tick = n;
  }

  /** Visita en orden de id los registros de los ticks k − N + 1 … k. */
  forWindow(k: number, visit: (r: HitRecord) => void): void {
    if (!this.rules) return;
    const from = k - this.rules.hitWindowTicks;
    const size = this.ring.length;
    for (let i = Math.max(0, this.written - size); i < this.written; i++) {
      const r = this.ring[i % size];
      if (r && r.tick > from && r.tick <= k) visit(r);
    }
  }

  private find(t: WeaponTarget): HitRecord | undefined {
    const size = this.ring.length;
    for (let i = this.tickStart; i < this.written; i++) {
      const r = this.ring[i % size];
      if (r?.target === t) return r;
    }
    return undefined;
  }

  /** Ocupa el siguiente registro del anillo con un id nuevo (borra su objetivo y su vista). */
  private next(): HitRecord {
    const r = this.ring[this.written % this.ring.length];
    if (!r) throw new Error('Invariante rota: registro de golpes vacío');
    this.written += 1;
    r.id = this.ids;
    this.ids += 1;
    r.target = null;
    r.view = null;
    return r;
  }
}
