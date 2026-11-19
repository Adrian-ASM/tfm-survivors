import { circlesOverlap } from '../collision/contact';
import { assertNever } from '../shared/assertNever';
import { Projectile, type ProjectileAttack } from './Projectile';
import { PulseEcho } from './PulseEcho';
import { Weapon } from './Weapon';
import type { WeaponLoadout } from './WeaponLoadout';
import type { TargetingConfig, WeaponType } from './WeaponType';
import type { WeaponTarget } from './WeaponTarget';
import { selectTarget } from './targeting';

type PulseAttack = Extract<Weapon['type']['attack'], { type: 'pulse' }>;

/**
 * Paso de armas del tick (servicio de dominio con estado; lo posee `Run`, como el `WaveDirector`).
 * Pools preasignados al empezar (ADR-0003, ADR-0006): cero asignaciones por disparo, impacto,
 * caducidad o pulso. Los objetivos llegan en orden de aparición; los muertos aún no compactados
 * se ignoran. Las armas no consumen azar.
 */
export class Arsenal {
  readonly weapons: readonly Weapon[];
  private readonly active: Projectile[] = [];
  private readonly free: Projectile[] = [];
  private readonly echoes: PulseEcho[] = [];
  private readonly freeEchoes: PulseEcho[] = [];
  private nextProjectileId = 0;

  constructor(private readonly loadout: WeaponLoadout) {
    this.weapons = Object.freeze(loadout.weapons.map((type) => new Weapon(type)));
    for (let i = 0; i < loadout.maxProjectiles; i++) this.free.push(new Projectile());
    for (let i = 0; i < loadout.pulseCapacity; i++) this.freeEchoes.push(new PulseEcho());
  }

  /** Proyectiles vivos en orden de creación (vista interna de solo lectura para el snapshot). */
  get projectiles(): readonly Projectile[] {
    return this.active;
  }

  /** Pulsos visibles en orden de disparo (vista interna de solo lectura para el snapshot). */
  get pulses(): readonly PulseEcho[] {
    return this.echoes;
  }

  /**
   * Aplica el tipo efectivo de un arma tras una mejora (camino frío). Los proyectiles en vuelo
   * conservan el daño que copiaron al lanzarse y los ecos su radio.
   */
  retune(weaponId: string, type: WeaponType): void {
    for (const w of this.weapons) if (w.type.id === weaponId) w.retune(type);
  }

  /**
   * Paso 3 del tick n con el jugador en (px, py): ecos caducados (3a), proyectiles existentes (3b),
   * compactación (3c) y disparos en el orden del loadout (3d). Devuelve las bajas del tick.
   */
  step(n: number, px: number, py: number, targets: readonly WeaponTarget[]): number {
    this.expireEchoes(n);
    let kills = this.moveProjectiles(n, targets);
    this.compactProjectiles();
    for (const weapon of this.weapons) kills += this.fire(weapon, n, px, py, targets);
    return kills;
  }

  /** 3a: el pulso de T se ve de T a T + visualTicks − 1. Compactación estable. */
  private expireEchoes(n: number): void {
    let w = 0;
    for (let r = 0; r < this.echoes.length; r++) {
      const e = this.echoes[r];
      if (!e) continue;
      if (e.expiredAt(n)) {
        this.freeEchoes.push(e);
      } else {
        this.echoes[w] = e;
        w++;
      }
    }
    this.echoes.length = w;
  }

  /** 3b: cada proyectil avanza y daña al primer vivo que solapa; si no, caduca a su tiempo. */
  private moveProjectiles(n: number, targets: readonly WeaponTarget[]): number {
    let kills = 0;
    for (const p of this.active) {
      p.advance();
      const hit = firstOverlapping(p.x, p.y, p.radius, targets);
      if (hit) {
        if (hit.takeDamage(p.damage, n)) kills++;
        p.spent = true;
      } else if (p.expiredAt(n)) {
        p.spent = true;
      }
    }
    return kills;
  }

  /** 3c: compactación estable en el sitio; los gastados vuelven al pool. */
  private compactProjectiles(): void {
    let w = 0;
    for (let r = 0; r < this.active.length; r++) {
      const p = this.active[r];
      if (!p) continue;
      if (p.spent) {
        this.free.push(p);
      } else {
        this.active[w] = p;
        w++;
      }
    }
    this.active.length = w;
  }

  /** 3d: un arma cargada con objetivo ataca; si no, conserva la carga. Devuelve las bajas. */
  private fire(
    weapon: Weapon,
    n: number,
    px: number,
    py: number,
    targets: readonly WeaponTarget[],
  ): number {
    if (!weapon.isChargedAt(n)) return 0;
    const target = targets[selectTarget(weapon.type.targeting, px, py, targets)];
    if (!target) return 0;
    const { attack } = weapon.type;
    switch (attack.type) {
      case 'projectile':
        if (!this.launch(weapon, attack, n, px, py, target)) return 0;
        weapon.fireAt(n);
        return 0;
      case 'pulse':
        weapon.fireAt(n);
        return this.pulse(weapon, attack, n, px, py, targets);
      default:
        return assertNever(attack);
    }
  }

  /** Lanza un proyectil del pool; false si el tope está lleno (el arma retiene la carga). */
  private launch(
    weapon: Weapon,
    attack: ProjectileAttack,
    n: number,
    px: number,
    py: number,
    target: WeaponTarget,
  ): boolean {
    if (this.active.length >= this.loadout.maxProjectiles) return false;
    const p = this.free.pop();
    if (!p) return false;
    p.launch(this.nextProjectileId, px, py, target.x, target.y, weapon.type.damage, attack, n);
    this.nextProjectileId += 1;
    this.active.push(p);
    return true;
  }

  /**
   * Daña en este mismo paso a todos los vivos que solapan el círculo del criterio, y a ningún
   * otro; deja un eco visible. Devuelve las bajas.
   */
  private pulse(
    weapon: Weapon,
    attack: PulseAttack,
    n: number,
    px: number,
    py: number,
    targets: readonly WeaponTarget[],
  ): number {
    const radius = reach(weapon.type.targeting);
    let kills = 0;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t?.alive && circlesOverlap(px, py, radius, t.x, t.y, t.radius)) {
        if (t.takeDamage(weapon.type.damage, n)) kills++;
      }
    }
    const echo = this.freeEchoes.pop();
    if (echo) {
      echo.set(weapon.type.id, n, px, py, radius, n + attack.visualTicks);
      this.echoes.push(echo);
    }
    return kills;
  }
}

/** Radio del círculo del criterio (el pulso lo usa como área; ADR-0007, `ATTACK_TARGETING`). */
function reach(t: TargetingConfig): number {
  switch (t.mode) {
    case 'any-in-radius':
      return t.radius;
    case 'nearest-in-range':
      return t.range;
    default:
      return assertNever(t);
  }
}

function firstOverlapping(
  x: number,
  y: number,
  r: number,
  targets: readonly WeaponTarget[],
): WeaponTarget | undefined {
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (t?.alive && circlesOverlap(x, y, r, t.x, t.y, t.radius)) return t;
  }
  return undefined;
}
