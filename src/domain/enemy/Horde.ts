import type { Arena } from '../arena/Arena';
import type { FlowField } from '../map/FlowField';
import { Enemy } from './Enemy';
import type { EnemyType } from './EnemyType';
import { TO_POST, type GuardPost } from './GuardPost';

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
   * pasadas del contrato): (a) una espera que termina en n pasa a su destino; (b) persecución y
   * alerta se mueven hacia el objetivo que les da el campo del jugador (el jugador con línea libre o
   * en su celda; si no, el centro de su siguiente celda), y patrulla y vuelta hacia su punto fijo
   * con el campo de ese punto (ADR-0020); (c) transiciones tras moverse (`transition`). Mecha, carga
   * y espera no se mueven. Sin asignar ni consumir azar.
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
      const kind = b.kinds[state];
      const post = enemy.post;
      if (kind === 'chase' || kind === 'alert') {
        field.steer(enemy.x, enemy.y, x, y, target);
      } else if ((kind === 'patrol' || kind === 'return') && post) {
        const point = kind === 'patrol' ? enemy.waypoint : TO_POST;
        post.steer(state, point, enemy.x, enemy.y, target);
      } else {
        continue;
      }
      enemy.chase(target.x, target.y, dtSeconds, this.arena);
      transition(enemy, state, n, x, y);
    }
  }

  /**
   * Alta en el tick n al final de la lista con el siguiente id, en el estado inicial de su tipo;
   * `post`, el puesto de un guardia.
   */
  spawn(type: EnemyType, x: number, y: number, n = 0, post: GuardPost | null = null): void {
    const { health, behavior } = type;
    this.enemies.push(
      Enemy.spawn(this.nextId, type, x, y, this.arena, health, behavior.initial, n, post),
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

/** ¿Está el enemigo exactamente en el punto `i` de su puesto (o en el puesto con `TO_POST`)? */
function isAt(enemy: Enemy, post: GuardPost, state: number, i: number): boolean {
  return enemy.x === post.pointX(state, i) && enemy.y === post.pointY(state, i);
}

/**
 * Transiciones del paso 2 tras moverse, con la distancia al jugador ya movido en (px, py) comparada
 * al cuadrado (spec enemy-behavior): persecución, salida por distancia; alerta, salida (lanzamiento)
 * y, si no, abandono a distancia mayor; patrulla, detección y, si no, el siguiente punto al llegar
 * exactamente al actual; vuelta, detección y, si no, su destino al llegar exactamente al puesto.
 */
function transition(enemy: Enemy, state: number, n: number, px: number, py: number): void {
  const b = enemy.type.behavior;
  const dx = px - enemy.x;
  const dy = py - enemy.y;
  const d2 = dx * dx + dy * dy;
  const post = enemy.post;
  switch (b.kinds[state]) {
    case 'chase':
      if (d2 <= (b.exitDistSq[state] ?? NO_DISTANCE)) enemy.enter(b.to[state] ?? state, n);
      return;
    case 'alert':
      if (d2 <= (b.exitDistSq[state] ?? NO_DISTANCE)) enemy.enter(b.to[state] ?? state, n);
      else if (d2 > (b.loseDistSq[state] ?? Infinity)) enemy.enter(b.loseTo[state] ?? state, n);
      return;
    case 'patrol':
      if (d2 <= (b.detectDistSq[state] ?? NO_DISTANCE)) enemy.enter(b.detectTo[state] ?? state, n);
      else if (post && isAt(enemy, post, state, enemy.waypoint)) enemy.advanceWaypoint();
      return;
    case 'return':
      if (d2 <= (b.detectDistSq[state] ?? NO_DISTANCE)) enemy.enter(b.detectTo[state] ?? state, n);
      else if (post && isAt(enemy, post, state, TO_POST))
        enemy.enter(b.arriveTo[state] ?? state, n);
      return;
    default:
      return;
  }
}

/** Distancia² "sin salida" (−1): ninguna distancia² la cumple. */
const NO_DISTANCE = -1;
