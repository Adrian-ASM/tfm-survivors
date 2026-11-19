import { circlesOverlap } from '../collision/contact';
import { Projectile, type ProjectileAttack } from './Projectile';
import { Weapon } from './Weapon';
import type { WeaponLoadout } from './WeaponLoadout';
import type { WeaponTarget } from './WeaponTarget';
import { selectTarget } from './targeting';

/**
 * Paso de armas del tick (servicio de dominio con estado; lo posee `Run`, como el `WaveDirector`).
 * Pools preasignados al empezar (ADR-0003, ADR-0006): cero asignaciones por disparo, impacto o
 * caducidad. Los objetivos llegan en orden de aparición; los muertos aún no compactados se ignoran.
 */
export class Arsenal {
  readonly weapons: readonly Weapon[];
  private readonly active: Projectile[] = [];
  private readonly free: Projectile[] = [];
  private nextProjectileId = 0;

  constructor(private readonly loadout: WeaponLoadout) {
    this.weapons = Object.freeze(loadout.weapons.map((type) => new Weapon(type)));
    for (let i = 0; i < loadout.maxProjectiles; i++) this.free.push(new Projectile());
  }

  /** Proyectiles vivos en orden de creación (vista interna de solo lectura para el snapshot). */
  get projectiles(): readonly Projectile[] {
    return this.active;
  }

  /**
   * Paso 3 del tick n con el jugador en (px, py): proyectiles existentes, compactación y disparos.
   * Devuelve las bajas del tick (golpes que dejan a un objetivo con vida 0).
   */
  step(n: number, px: number, py: number, targets: readonly WeaponTarget[]): number {
    let kills = this.moveProjectiles(n, targets);
    this.compactProjectiles();
    for (const weapon of this.weapons) kills += this.fire(weapon, n, px, py, targets);
    return kills;
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
    const index = selectTarget(weapon.type.targeting, px, py, targets);
    const target = targets[index];
    if (!target) return 0;
    const { attack } = weapon.type;
    if (attack.type === 'projectile') {
      if (!this.launch(weapon, attack, n, px, py, target)) return 0;
    }
    weapon.fireAt(n);
    return 0;
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
