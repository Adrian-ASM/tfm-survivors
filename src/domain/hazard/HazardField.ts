import { circlesOverlap } from '../collision/contact';
import type { Enemy } from '../enemy/Enemy';
import { Blast } from './Blast';
import { Dynamite } from './Dynamite';
import type { HazardRules } from './HazardRules';

/** Dinamita ya en vuelo al empezar (forma de `RunSetup.dynamites`, validada antes). */
export interface DynamiteSeed {
  readonly x: number;
  readonly y: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly ticksLeft: number;
  readonly radius: number;
  readonly damage: number;
}

/**
 * Peligros de área del tick (servicio de dominio con estado; lo posee `Run`, como el `Arsenal`):
 * dinamitas en vuelo en un pool fijo de `maxDynamites` y explosiones visibles en una lista que
 * solo crece al superar su máximo histórico (ADR-0003/0006). Ambas en orden de creación y con ids
 * que no se reutilizan; compactación estable. No depende de `Horde`: recibe los vivos en orden de
 * lista. No consume azar ni toca el mapa (spec enemy-hazards, "Peligros deterministas").
 */
export class HazardField {
  private readonly flying: Dynamite[] = [];
  private readonly spare: Dynamite[] = [];
  private readonly visible: Blast[] = [];
  private readonly spareBlasts: Blast[] = [];
  /** Barriles cuya mecha termina en el tick (reutilizado: no asigna por tick). */
  private readonly fusing: Enemy[] = [];
  private nextDynamiteId = 0;
  private nextBlastId = 0;
  private hit = 0;

  constructor(
    readonly rules: HazardRules,
    initial: readonly DynamiteSeed[] = [],
  ) {
    for (let i = 0; i < rules.maxDynamites; i++) this.spare.push(new Dynamite());
    for (const d of initial) {
      this.take(d, d.targetX, d.targetY, 0, d.ticksLeft, d.radius, d.damage);
    }
  }

  /** Dinamitas en vuelo en orden de creación (vista interna de solo lectura para el snapshot). */
  get dynamites(): readonly Dynamite[] {
    return this.flying;
  }

  /** Explosiones visibles en orden de creación (vista interna de solo lectura). */
  get blasts(): readonly Blast[] {
    return this.visible;
  }

  /** Mayor daño de las explosiones del tick que alcanzan al jugador (0 si ninguna; paso 5). */
  get playerHit(): number {
    return this.hit;
  }

  /** Paso 4.1: se retiran las explosiones con `tick + blastTicks ≤ n` (compactación estable). */
  expire(n: number): void {
    const ttl = this.rules.blastTicks;
    let w = 0;
    for (let r = 0; r < this.visible.length; r++) {
      const b = this.visible[r];
      if (!b) continue;
      if (b.tick + ttl <= n) {
        this.spareBlasts.push(b);
      } else {
        this.visible[w] = b;
        w++;
      }
    }
    this.visible.length = w;
  }

  /**
   * Paso 4.2 del tick n con el jugador en (px, py, pr): (a) los barriles vivos cuya mecha termina
   * en n, en orden de lista, marcados todos antes de resolver (explotan aunque otra explosión del
   * tick los deje a 0, D2); (b) las dinamitas que llegan, en orden de creación, que dejan su hueco.
   * Cada explosión daña a todo enemigo vivo cuyo círculo la solapa (salvo al propio barril) y
   * registra el golpe candidato del jugador. Al final los barriles marcados quedan a vida 0.
   * Devuelve si hay bajas que retirar (`removeDead`, paso 4.3).
   */
  explode(n: number, enemies: readonly Enemy[], px: number, py: number, pr: number): boolean {
    this.hit = 0;
    const fusing = this.fusing;
    fusing.length = 0;
    for (const e of enemies) {
      if (e.alive && e.type.behavior.kinds[e.state] === 'fuse' && e.stateEndsAt <= n) {
        fusing.push(e);
      }
    }
    let died = fusing.length > 0;
    for (const e of fusing) {
      const b = e.type.behavior;
      const radius = b.blastRadius[e.state] ?? 0;
      const damage = b.blastDamage[e.state] ?? 0;
      if (this.strike(n, e.x, e.y, radius, damage, enemies, e, px, py, pr)) died = true;
    }
    if (this.detonate(n, enemies, px, py, pr)) died = true;
    for (const e of fusing) e.explode();
    fusing.length = 0;
    return died;
  }

  /**
   * Paso 4.4: en orden de lista, cada enemigo vivo en carga lista (`since + ticks ≤ n`) lanza una
   * dinamita hacia el jugador mientras quede sitio bajo el tope y entra en su destino. Sin sitio,
   * sigue en carga y lanza en el primer tick con sitio.
   */
  launch(n: number, enemies: readonly Enemy[], px: number, py: number): void {
    for (const e of enemies) {
      if (this.flying.length >= this.rules.maxDynamites) return;
      const b = e.type.behavior;
      const s = e.state;
      if (!e.alive || b.kinds[s] !== 'charge' || e.stateEndsAt > n) continue;
      const flight = b.flightTicks[s] ?? 1;
      this.take(e, px, py, n, n + flight, b.blastRadius[s] ?? 0, b.blastDamage[s] ?? 0);
      e.enter(b.to[s] ?? s, n);
    }
  }

  /** 4.2b: dinamitas con `explodesAt ≤ n`, en orden de creación; salen del pool. */
  private detonate(n: number, enemies: readonly Enemy[], px: number, py: number, pr: number) {
    let died = false;
    let w = 0;
    for (let r = 0; r < this.flying.length; r++) {
      const d = this.flying[r];
      if (!d) continue;
      if (d.explodesAt <= n) {
        if (this.strike(n, d.tx, d.ty, d.radius, d.damage, enemies, null, px, py, pr)) died = true;
        this.spare.push(d);
      } else {
        this.flying[w] = d;
        w++;
      }
    }
    this.flying.length = w;
    return died;
  }

  /**
   * Una explosión en (cx, cy) de radio R y daño D: crea su `Blast`, resta D a cada enemigo vivo que
   * la solapa estrictamente (salvo `self`) y registra el golpe al jugador. Devuelve si mata a alguno.
   */
  private strike(
    n: number,
    cx: number,
    cy: number,
    radius: number,
    damage: number,
    enemies: readonly Enemy[],
    self: Enemy | null,
    px: number,
    py: number,
    pr: number,
  ): boolean {
    const blast = this.spareBlasts.pop() ?? new Blast();
    blast.set(this.nextBlastId, cx, cy, radius, n);
    this.nextBlastId += 1;
    this.visible.push(blast);
    if (damage > this.hit && circlesOverlap(cx, cy, radius, px, py, pr)) this.hit = damage;
    let died = false;
    for (const e of enemies) {
      if (e === self || !e.alive) continue;
      if (circlesOverlap(cx, cy, radius, e.x, e.y, e.radius) && e.takeDamage(damage, n)) {
        died = true;
      }
    }
    return died;
  }

  private take(
    from: { readonly x: number; readonly y: number },
    tx: number,
    ty: number,
    launchedAt: number,
    explodesAt: number,
    radius: number,
    damage: number,
  ): void {
    const d = this.spare.pop();
    if (!d) return;
    d.set(this.nextDynamiteId, from, tx, ty, launchedAt, explodesAt, radius, damage);
    this.nextDynamiteId += 1;
    this.flying.push(d);
  }
}
