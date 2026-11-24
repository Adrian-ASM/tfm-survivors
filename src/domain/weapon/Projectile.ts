import { TICKS_PER_SECOND } from '../shared/Tick';
import type { AttackConfig } from './WeaponType';

export type ProjectileAttack = Extract<AttackConfig, { type: 'projectile' }>;

/**
 * Proyectil (entidad mutable y reutilizable, ADR-0003): vive en el pool de `Arsenal`, que lo relanza
 * con un id nuevo. Escalares, sin vectores ni objetos por disparo o por tick. No está limitado por
 * la arena: lo acota `lifetimeTicks`.
 */
export class Projectile {
  id = -1;
  x = 0;
  y = 0;
  radius = 0;
  damage = 0;
  /** Su objetivo al dispararse era una estructura: solo entonces puede impactar en una (D5). */
  atStructure = false;
  /** Gastado (impacto o caducidad): `Arsenal` lo devuelve al pool al compactar. */
  spent = true;
  private vx = 0;
  private vy = 0;
  private lastTick = 0;

  /**
   * Lanza desde (x, y) con dirección unitaria fija hacia (tx, ty) (con distancia 0, (1, 0)) y
   * avance de speed / 60 por tick. No persigue al objetivo. `atStructure`: el objetivo era una
   * estructura (ADR-0020).
   */
  launch(
    id: number,
    x: number,
    y: number,
    tx: number,
    ty: number,
    damage: number,
    attack: ProjectileAttack,
    firedAt: number,
    atStructure = false,
  ): void {
    const dx = tx - x;
    const dy = ty - y;
    const d = Math.hypot(dx, dy);
    const step = attack.speed / TICKS_PER_SECOND;
    this.id = id;
    this.x = x;
    this.y = y;
    this.vx = d === 0 ? step : (dx / d) * step;
    this.vy = d === 0 ? 0 : (dy / d) * step;
    this.radius = attack.radius;
    this.damage = damage;
    this.lastTick = firedAt + attack.lifetimeTicks;
    this.atStructure = atStructure;
    this.spent = false;
  }

  advance(): void {
    this.x += this.vx;
    this.y += this.vy;
  }

  /** Creado en T: en el tick T + lifetimeTicks avanza, comprueba impacto y desaparece. */
  expiredAt(n: number): boolean {
    return n >= this.lastTick;
  }
}
