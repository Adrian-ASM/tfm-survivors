import { circlesOverlap } from '../collision/contact';
import { assertNever } from '../shared/assertNever';
import { Projectile, type ProjectileAttack } from './Projectile';
import { PulseEcho } from './PulseEcho';
import { Weapon } from './Weapon';
import type { WeaponLoadout } from './WeaponLoadout';
import type { TargetingConfig, WeaponType } from './WeaponType';
import type { WeaponTarget } from './WeaponTarget';
import { firstOverlapping } from './hits';
import { selectTarget } from './targeting';

type PulseAttack = Extract<Weapon['type']['attack'], { type: 'pulse' }>;

/** Sin objetivos de reserva (partidas sin estructuras o sin ovejas). */
const NO_TARGETS: readonly WeaponTarget[] = Object.freeze([]);

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
  /**
   * Niveles de reserva del tick en orden (1 estructuras, 2 ovejas; ADR-0022). Array fijo reutilizado:
   * `step` solo reasigna sus dos huecos, sin asignar por tick.
   */
  private readonly reserves: (readonly WeaponTarget[])[] = [NO_TARGETS, NO_TARGETS];

  /**
   * `pulseCapacity`: ecos preasignados; por defecto los del loadout base. `Run` pasa la cota del
   * peor caso de las mejoras (ADR-0008), porque una mejora de cadencia puede solapar más ecos.
   */
  constructor(
    private readonly loadout: WeaponLoadout,
    pulseCapacity: number = loadout.pulseCapacity,
  ) {
    this.weapons = Object.freeze(loadout.weapons.map((type) => new Weapon(type)));
    for (let i = 0; i < loadout.maxProjectiles; i++) this.free.push(new Projectile());
    for (let i = 0; i < pulseCapacity; i++) this.freeEchoes.push(new PulseEcho());
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
   * compactación (3c) y disparos en el orden del loadout (3d). Objetivos por niveles (ADR-0020 y
   * ADR-0022): enemigos; si el criterio no encuentra ninguno, estructuras (casas y torres); si
   * tampoco, ovejas. Devuelve las bajas de enemigos del tick (destruir una estructura o matar una
   * oveja no es una baja).
   */
  step(
    n: number,
    px: number,
    py: number,
    targets: readonly WeaponTarget[],
    structures: readonly WeaponTarget[] = NO_TARGETS,
    sheep: readonly WeaponTarget[] = NO_TARGETS,
  ): number {
    return this.advance(n, targets, structures, sheep) + this.fireAll(n, px, py, targets);
  }

  /**
   * Paso 3.1 del tick n (0026): ecos caducados, proyectiles existentes y compactación, con los
   * niveles de reserva del tick (que usa después `fireAll`). Devuelve las bajas de enemigos.
   */
  advance(
    n: number,
    targets: readonly WeaponTarget[],
    structures: readonly WeaponTarget[] = NO_TARGETS,
    sheep: readonly WeaponTarget[] = NO_TARGETS,
  ): number {
    const { reserves } = this;
    reserves[0] = structures;
    reserves[1] = sheep;
    this.expireEchoes(n);
    const kills = this.moveProjectiles(n, targets, reserves);
    this.compactProjectiles();
    return kills;
  }

  /**
   * Paso 3.2 del tick n (0026): disparos en el orden del loadout con el jugador en (px, py) y los
   * niveles de reserva de `advance`. Devuelve las bajas de enemigos (pulsos).
   */
  fireAll(n: number, px: number, py: number, targets: readonly WeaponTarget[]): number {
    let kills = 0;
    for (const weapon of this.weapons) {
      kills += this.fire(weapon, n, px, py, targets, this.reserves);
    }
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

  /**
   * 3b: cada proyectil avanza y daña al primer enemigo vivo que solapa; si no hay ninguno y su
   * objetivo era de un nivel de reserva, al primer objetivo vivo de ese nivel que solapa (atraviesa
   * los de los demás niveles); si no impacta, caduca a su tiempo. Solo cuenta las bajas de enemigos.
   */
  private moveProjectiles(
    n: number,
    targets: readonly WeaponTarget[],
    reserves: readonly (readonly WeaponTarget[])[],
  ): number {
    let kills = 0;
    for (const p of this.active) {
      p.advance();
      const hit = firstOverlapping(p.x, p.y, p.radius, targets);
      const level = p.tier > 0 ? reserves[p.tier - 1] : undefined;
      const wall = hit || !level ? undefined : firstOverlapping(p.x, p.y, p.radius, level);
      if (hit) {
        if (hit.takeDamage(p.damage, n)) kills++;
        p.spent = true;
      } else if (wall) {
        wall.takeDamage(p.damage, n);
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

  /**
   * 3d: un arma cargada con objetivo ataca; si no, conserva la carga. El objetivo es el enemigo que
   * elige su criterio o, si no hay ninguno, el del primer nivel de reserva en el que el mismo
   * criterio encuentra uno (sin concatenar ni asignar). Devuelve las bajas.
   */
  private fire(
    weapon: Weapon,
    n: number,
    px: number,
    py: number,
    targets: readonly WeaponTarget[],
    reserves: readonly (readonly WeaponTarget[])[],
  ): number {
    if (!weapon.isChargedAt(n)) return 0;
    const { targeting } = weapon.type;
    let tier = 0;
    let target = targets[selectTarget(targeting, px, py, targets)];
    for (let i = 0; !target && i < reserves.length; i++) {
      const level = reserves[i] ?? NO_TARGETS;
      target = level[selectTarget(targeting, px, py, level)];
      tier = i + 1;
    }
    if (!target) return 0;
    const { attack } = weapon.type;
    switch (attack.type) {
      case 'projectile':
        if (!this.launch(weapon, attack, n, px, py, target, tier)) return 0;
        weapon.fireAt(n);
        return 0;
      case 'pulse':
        weapon.fireAt(n);
        return this.pulse(weapon, attack, n, px, py, targets, reserves);
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
    tier: number,
  ): boolean {
    if (this.active.length >= this.loadout.maxProjectiles) return false;
    const p = this.free.pop();
    if (!p) return false;
    const { damage } = weapon.type;
    p.launch(this.nextProjectileId, px, py, target.x, target.y, damage, attack, n, tier);
    this.nextProjectileId += 1;
    this.active.push(p);
    return true;
  }

  /**
   * Daña en este mismo paso a todos los enemigos vivos y a todos los objetivos vivos de los niveles
   * de reserva (estructuras no destruidas y ovejas) que solapan el círculo del criterio, y a ningún
   * otro; deja un eco visible. Devuelve las bajas de enemigos.
   */
  private pulse(
    weapon: Weapon,
    attack: PulseAttack,
    n: number,
    px: number,
    py: number,
    targets: readonly WeaponTarget[],
    reserves: readonly (readonly WeaponTarget[])[],
  ): number {
    const radius = reach(weapon.type.targeting);
    const { damage } = weapon.type;
    let kills = 0;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t?.alive && circlesOverlap(px, py, radius, t.x, t.y, t.radius)) {
        if (t.takeDamage(damage, n)) kills++;
      }
    }
    for (const level of reserves) {
      for (let i = 0; i < level.length; i++) {
        const s = level[i];
        if (s?.alive && circlesOverlap(px, py, radius, s.x, s.y, s.radius)) s.takeDamage(damage, n);
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
