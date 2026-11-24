import type { WeaponTarget } from '../weapon/WeaponTarget';

/** Estado de una oveja (spec sheep): pasto, paseo o huida. */
export type SheepState = 'graze' | 'wander' | 'flee';

/**
 * Oveja (entidad neutral, ADR-0022). Registro mutable y reutilizable del pool de `Flock`, interno al
 * agregado `Run` (ADR-0003/0006): posición, origen, vida, estado y fase como escalares, sin objetos
 * por tick. Cumple `WeaponTarget`: las armas y las explosiones la dañan, nada más. Solo `Flock` la
 * crea y la mueve; el snapshot copia sus escalares.
 */
export class Sheep implements WeaponTarget {
  id = -1;
  x = 0;
  y = 0;
  /** Punto de origen: donde se creó (colocación, declaración o reaparición). */
  originX = 0;
  originY = 0;
  mode: SheepState = 'graze';
  /** Último tick de la fase en curso (pasto o paseo); la siguiente empieza en `phaseEnd + 1`. */
  phaseEnd = 0;
  /** Dirección unitaria del paseo o de la huida en curso. */
  dx = 1;
  dy = 0;
  private life = 0;
  /** Último tick en que recibió daño (0 = nunca; los ticks empiezan en 1). */
  private lastHitTick = 0;

  constructor(readonly radius: number) {}

  get hp(): number {
    return this.life;
  }

  /** Alcanzable por armas y explosiones: vida > 0 (una muerta aún sin retirar no lo es). */
  get alive(): boolean {
    return this.life > 0;
  }

  /**
   * Aparece en (x, y) con `health`, en pasto hasta el tick `phaseEnd` y con el origen en su
   * posición. Reinicia el destello (un registro reutilizado no hereda el de otra oveja).
   */
  set(id: number, x: number, y: number, health: number, phaseEnd: number): void {
    this.id = id;
    this.x = x;
    this.y = y;
    this.originX = x;
    this.originY = y;
    this.life = health;
    this.mode = 'graze';
    this.phaseEnd = phaseEnd;
    this.dx = 1;
    this.dy = 0;
    this.lastHitTick = 0;
  }

  /** Resta el daño con recorte a 0 y anota el tick; true si este golpe la deja a 0. */
  takeDamage(amount: number, tick: number): boolean {
    if (!this.alive) return false;
    this.life = Math.max(0, this.life - amount);
    this.lastHitTick = tick;
    return !this.alive;
  }

  /** ¿Indica daño reciente en el snapshot del tick k? (misma regla que los enemigos). */
  damagedAt(k: number, flashTicks: number): boolean {
    return this.lastHitTick > 0 && k - this.lastHitTick < flashTicks;
  }
}
