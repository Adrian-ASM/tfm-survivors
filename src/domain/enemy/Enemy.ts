import type { Arena } from '../arena/Arena';
import type { EnemyType } from './EnemyType';

/**
 * Enemigo (entidad). A diferencia de `Player`, su posición es estado escalar **mutable e interno**
 * al agregado `Run` (ADR-0003): con cientos de enemigos por tick, la persecución no asigna objetos.
 * Solo `Run` crea y mueve enemigos; nunca salen del agregado (el snapshot copia los escalares).
 */
export class Enemy {
  private px: number;
  private py: number;
  /** Vida actual: escalar mutable (ADR-0003), sin un `Health` por impacto en el camino caliente. */
  private life: number;
  /** Último tick en que recibió daño (0 = nunca; los ticks empiezan en 1). */
  private lastHitTick = 0;

  private constructor(
    readonly id: number,
    readonly type: EnemyType,
    x: number,
    y: number,
    health: number,
  ) {
    this.px = x;
    this.py = y;
    this.life = health;
  }

  get hp(): number {
    return this.life;
  }

  get alive(): boolean {
    return this.life > 0;
  }

  /** Daño por contacto del tipo. */
  get damage(): number {
    return this.type.damage;
  }

  /**
   * Resta el daño con recorte a 0 y devuelve true si este golpe lo ha dado de baja. Sobre un
   * enemigo ya dado de baja no hace nada. `tick` es el tick del impacto (para el destello).
   */
  takeDamage(amount: number, tick: number): boolean {
    if (!this.alive) return false;
    this.life = Math.max(0, this.life - amount);
    this.lastHitTick = tick;
    return !this.alive;
  }

  /**
   * ¿Indica daño reciente en el snapshot del tick k? Dañado en T: de T a T + flashTicks − 1
   * (spec auto-weapons, "Duración del destello").
   */
  damagedAt(k: number, flashTicks: number): boolean {
    return this.lastHitTick > 0 && k - this.lastHitTick < flashTicks;
  }

  /**
   * Crea un enemigo con el centro recortado a la arena. `health` (vida inicial) solo la fija
   * `RunSetup`; por defecto, la del tipo.
   */
  static spawn(
    id: number,
    type: EnemyType,
    x: number,
    y: number,
    arena: Arena,
    health: number = type.health,
  ): Enemy {
    const cx = arena.clampX(x, type.radius);
    return new Enemy(id, type, cx, arena.clampY(y, type.radius), health);
  }

  get x(): number {
    return this.px;
  }

  get y(): number {
    return this.py;
  }

  get radius(): number {
    return this.type.radius;
  }

  /** Avanza en línea recta hacia (tx, ty) sin sobrepasarlo y sin salir de la arena. */
  chase(tx: number, ty: number, dtSeconds: number, arena: Arena): void {
    const dx = tx - this.px;
    const dy = ty - this.py;
    const distance = Math.hypot(dx, dy);
    const step = this.type.speed * dtSeconds;
    if (distance <= step) {
      this.px = tx;
      this.py = ty;
    } else {
      this.px += (dx / distance) * step;
      this.py += (dy / distance) * step;
    }
    this.px = arena.clampX(this.px, this.type.radius);
    this.py = arena.clampY(this.py, this.type.radius);
  }
}
