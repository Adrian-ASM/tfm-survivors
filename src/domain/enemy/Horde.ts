import type { Arena } from '../arena/Arena';
import { Enemy } from './Enemy';
import type { EnemyType } from './EnemyType';

/**
 * Enemigos vivos de la partida (entidad interna de `Run`; nunca sale del agregado). Lista en orden
 * de aparición, ids desde un contador que nunca se reutiliza y contador de bajas (spec
 * run-outcome): cada muerto retirado por `removeDead` suma exactamente 1.
 */
export class Horde {
  private readonly enemies: Enemy[];
  private nextId: number;
  private killCount = 0;

  /** `initial`: enemigos ya presentes (ids 0 … n − 1, de `RunSetup`). */
  constructor(
    initial: Enemy[],
    private readonly arena: Arena,
  ) {
    this.enemies = initial;
    this.nextId = initial.length;
  }

  /** Vivos en orden de aparición (vista de solo lectura del array interno, sin copiar). */
  get alive(): readonly Enemy[] {
    return this.enemies;
  }

  get kills(): number {
    return this.killCount;
  }

  /** Todos persiguen el punto (x, y) en este tick. */
  chase(x: number, y: number, dtSeconds: number): void {
    for (const enemy of this.enemies) enemy.chase(x, y, dtSeconds, this.arena);
  }

  /** Alta al final de la lista con el siguiente id. */
  spawn(type: EnemyType, x: number, y: number): void {
    this.enemies.push(Enemy.spawn(this.nextId, type, x, y, this.arena));
    this.nextId += 1;
  }

  /**
   * Compactación estable en el sitio (ADR-0006): O(n), sin asignar y conservando el orden de
   * aparición de los vivos. Cada muerto suma una baja y se pasa a `onDeath` en el orden de la
   * lista, con su posición y tipo intactos.
   */
  removeDead(onDeath: (dead: Enemy) => void): void {
    let w = 0;
    for (let r = 0; r < this.enemies.length; r++) {
      const e = this.enemies[r];
      if (!e) continue;
      if (e.alive) {
        if (w !== r) this.enemies[w] = e;
        w++;
      } else {
        this.killCount += 1;
        onDeath(e);
      }
    }
    this.enemies.length = w;
  }
}
