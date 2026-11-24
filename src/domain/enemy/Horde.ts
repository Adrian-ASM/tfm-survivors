import type { Arena } from '../arena/Arena';
import type { FlowField } from '../map/FlowField';
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
  private killCount: number;
  /** Objetivo del enemigo en curso (reutilizado: la persecución no asigna). */
  private readonly target = { x: 0, y: 0 };

  /** `initial`: enemigos ya presentes (ids 0 … n − 1) y `kills`: bajas previas, de `RunSetup`. */
  constructor(
    initial: Enemy[],
    private readonly arena: Arena,
    kills = 0,
  ) {
    this.enemies = initial;
    this.nextId = initial.length;
    this.killCount = kills;
  }

  /** Vivos en orden de aparición (vista de solo lectura del array interno, sin copiar). */
  get alive(): readonly Enemy[] {
    return this.enemies;
  }

  get kills(): number {
    return this.killCount;
  }

  /**
   * Paso 2 del tick n con el jugador ya movido en (x, y) (spec enemy-behavior y simulation-loop),
   * enemigo a enemigo en orden de lista (no interactúan entre sí, así que equivale a las tres
   * pasadas del contrato): (a) una espera que termina en n pasa a su destino; (b) una persecución se
   * mueve hacia el objetivo que le da el campo (el jugador con línea libre o en su celda; si no, el
   * centro de su siguiente celda); (c) una persecución con salida a distancia ≤ la de salida entra
   * en su destino. Mecha, carga y espera no se mueven. Sin asignar ni consumir azar.
   */
  act(n: number, x: number, y: number, dtSeconds: number, field: FlowField): void {
    const target = this.target;
    for (const enemy of this.enemies) {
      const b = enemy.type.behavior;
      let state = enemy.state;
      if (b.kinds[state] === 'wait' && enemy.stateEndsAt <= n) {
        state = b.to[state] ?? state;
        enemy.enter(state, n);
      }
      if (b.kinds[state] !== 'chase') continue;
      field.steer(enemy.x, enemy.y, x, y, target);
      enemy.chase(target.x, target.y, dtSeconds, this.arena);
      const exit = b.exitDistSq[state] ?? -1;
      if (exit < 0) continue;
      const dx = x - enemy.x;
      const dy = y - enemy.y;
      if (dx * dx + dy * dy <= exit) enemy.enter(b.to[state] ?? state, n);
    }
  }

  /** Alta en el tick n al final de la lista con el siguiente id, en el estado inicial de su tipo. */
  spawn(type: EnemyType, x: number, y: number, n = 0): void {
    this.enemies.push(
      Enemy.spawn(this.nextId, type, x, y, this.arena, type.health, type.behavior.initial, n),
    );
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
