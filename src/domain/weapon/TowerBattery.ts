import { HitLog } from '../combat/HitLog';
import type { BuildingRules } from '../site/BuildingRules';
import type { BuildSite } from '../site/BuildSite';
import { firstOverlapping } from './hits';
import { Projectile, type ProjectileAttack } from './Projectile';
import { selectTarget } from './targeting';
import { Weapon } from './Weapon';
import type { WeaponTarget } from './WeaponTarget';

/** Torre construida: su arma (cargada al construirse) y su punto de disparo. */
interface Tower {
  readonly weapon: Weapon;
  readonly x: number;
  readonly y: number;
}

/**
 * Torres de la partida (servicio de dominio con estado, propiedad de `Run`; spec build-sites 0026,
 * "Torre que dispara sola"): un `Weapon` por torre con el arma de torre del contenido, sin mejoras,
 * que dispara desde el centro de su huella al enemigo vivo más cercano en alcance (solo nivel 0: ni
 * estructuras ni ovejas), en el orden de los solares. Sus flechas viven en un pool propio de
 * `maxTowerProjectiles` registros con su propia secuencia de ids: no ocupan el tope del jugador.
 * Sin azar ni asignaciones en el tick.
 */
export class TowerBattery {
  /** Por id de solar, su torre o `null` (orden de los solares). */
  private readonly towers: (Tower | null)[];
  private readonly active: Projectile[] = [];
  private readonly free: Projectile[] = [];
  private nextId = 0;
  private readonly attack: ProjectileAttack;

  constructor(
    private readonly rules: BuildingRules,
    sites: readonly BuildSite[],
    /** Registro de golpes (0031): sus flechas solo dañan enemigos; por defecto, desactivado. */
    private readonly log: HitLog = HitLog.disabled(),
  ) {
    this.towers = sites.map(() => null);
    for (let i = 0; i < rules.maxTowerProjectiles; i++) this.free.push(new Projectile());
    const { attack } = rules.towerWeapon;
    if (attack.type !== 'projectile') throw new Error('Invariante rota: torre sin proyectiles');
    this.attack = attack;
  }

  /** Flechas vivas en orden de creación (vista interna de solo lectura para el snapshot). */
  get projectiles(): readonly Projectile[] {
    return this.active;
  }

  /** ¿Está cargada la torre del solar `siteId` en el tick n? (false sin torre). */
  isChargedAt(siteId: number, n: number): boolean {
    return this.towers[siteId]?.weapon.isChargedAt(n) ?? false;
  }

  /** Activa la torre de un solar recién construido, cargada (camino frío: una vez por torre). */
  add(site: BuildSite): void {
    const weapon = new Weapon(this.rules.towerWeapon);
    this.towers[site.id] = Object.freeze({ weapon, x: site.x, y: site.y });
  }

  /**
   * Paso 3.1 del tick n, tras los proyectiles del jugador: cada flecha avanza y daña al primer
   * enemigo vivo que solapa (atraviesa estructuras y ovejas) o caduca a su tiempo; compactación
   * estable. Devuelve las bajas.
   */
  advance(n: number, enemies: readonly WeaponTarget[]): number {
    let kills = 0;
    let spent = false;
    for (const p of this.active) {
      p.advance();
      const hit = firstOverlapping(p.x, p.y, p.radius, enemies);
      if (hit) {
        if (this.log.strike('enemy', hit, p.damage, n)) kills++;
        p.spent = true;
      } else if (p.expiredAt(n)) {
        p.spent = true;
      }
      spent ||= p.spent;
    }
    if (spent) this.compact();
    return kills;
  }

  /**
   * Paso 3.2 del tick n, tras las armas del jugador: cada torre, en el orden de los solares, elige
   * el enemigo vivo más cercano a ≤ alcance desde su punto de disparo y, si está cargada, lo tiene
   * y hay plaza en la reserva, dispara; con la reserva llena conserva la carga.
   */
  fire(n: number, enemies: readonly WeaponTarget[]): void {
    const { targeting, damage } = this.rules.towerWeapon;
    for (const tower of this.towers) {
      if (!tower?.weapon.isChargedAt(n)) continue;
      const target = enemies[selectTarget(targeting, tower.x, tower.y, enemies)];
      if (!target) continue;
      if (this.active.length >= this.rules.maxTowerProjectiles) continue;
      const p = this.free.pop();
      if (!p) continue;
      p.launch(this.nextId, tower.x, tower.y, target.x, target.y, damage, this.attack, n);
      this.nextId += 1;
      this.active.push(p);
      tower.weapon.fireAt(n);
    }
  }

  /** Compactación estable en el sitio; las gastadas vuelven al pool. */
  private compact(): void {
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
}
