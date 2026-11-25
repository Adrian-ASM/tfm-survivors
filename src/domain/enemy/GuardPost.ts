import type { Arena } from '../arena/Arena';
import { FlowField } from '../map/FlowField';
import type { GameMap } from '../map/GameMap';
import type { EnemyType } from './EnemyType';

/** Puntos de patrulla por estado: las 4 esquinas en orden, como (x, y) consecutivos. */
const CORNERS = 4;

/** Índice de destino que significa "el puesto" en `steer`. */
export const TO_POST = -1;

/**
 * Puesto de guardia (ADR-0020): el punto que guardan los guardias de una casa (su puerta) o el que
 * fija un escenario, con los 4 puntos de patrulla de cada estado de patrulla del tipo y un campo
 * de distancias por punto distinto (puesto y esquinas), orientado una sola vez: cada campo lee los
 * códigos vivos del mapa y se invalida solo al cambiar su revisión (una obra, ADR-0025). Cuenta los guardias vivos que lo guardan (tope de la casa). No consume azar ni asigna en
 * el tick: la BFS de cada campo se hace en su primera consulta.
 */
export class GuardPost {
  /** Por índice de estado: las esquinas recolocadas de ese estado de patrulla, o `null`. */
  private readonly corners: (Float64Array | null)[];
  /** Campo por celda de destino (índice de celda), compartido por los puntos de esa celda. */
  private readonly fields = new Map<number, FlowField>();
  private readonly map: GameMap;
  private guards = 0;
  /** Puesto: fijo salvo que una obra lo cubra (`evict`, 0026). */
  private px: number;
  private py: number;

  constructor(x: number, y: number, type: EnemyType, map: GameMap, arena: Arena) {
    this.map = map;
    this.px = x;
    this.py = y;
    const spot = { x: 0, y: 0 };
    const b = type.behavior;
    this.corners = b.kinds.map((kind, state) => {
      if (kind !== 'patrol') return null;
      const r = b.patrolRadius[state] ?? 0;
      const points = new Float64Array(2 * CORNERS);
      [
        [x - r, y - r],
        [x + r, y - r],
        [x + r, y + r],
        [x - r, y + r],
      ].forEach(([cx = 0, cy = 0], i) => {
        map.nearestWalkable(arena.clampX(cx, type.radius), arena.clampY(cy, type.radius), spot);
        points[2 * i] = spot.x;
        points[2 * i + 1] = spot.y;
        this.fieldTo(spot.x, spot.y);
      });
      return points;
    });
    this.fieldTo(x, y);
  }

  /** Campo orientado a la celda de (qx, qy); lo crea la primera vez (solo al construir). */
  private fieldTo(qx: number, qy: number): FlowField {
    const col = this.map.colAt(qx);
    const row = this.map.rowAt(qy);
    const key = row * this.map.cols + col;
    let field = this.fields.get(key);
    if (!field) {
      field = new FlowField(this.map);
      field.retarget(col, row);
      this.fields.set(key, field);
    }
    return field;
  }

  /** x del puesto. */
  get x(): number {
    return this.px;
  }

  /** y del puesto. */
  get y(): number {
    return this.py;
  }

  /**
   * Despeje de una obra (spec build-sites 0026): el puesto y cada punto de patrulla en una celda
   * construida pasan al centro de la celda caminable más cercana, y su campo se orienta a la celda
   * nueva. Sin azar; solo al construir (en el mapa generado no ocurre, por la colocación).
   */
  evict(map: GameMap): void {
    const spot = { x: 0, y: 0 };
    if (map.isBuiltAt(this.px, this.py)) {
      map.nearestWalkable(this.px, this.py, spot);
      this.px = spot.x;
      this.py = spot.y;
      this.fieldTo(spot.x, spot.y);
    }
    for (const points of this.corners) {
      if (!points) continue;
      for (let i = 0; i < CORNERS; i++) {
        const qx = points[2 * i] ?? 0;
        const qy = points[2 * i + 1] ?? 0;
        if (!map.isBuiltAt(qx, qy)) continue;
        map.nearestWalkable(qx, qy, spot);
        points[2 * i] = spot.x;
        points[2 * i + 1] = spot.y;
        this.fieldTo(spot.x, spot.y);
      }
    }
  }

  /** x del punto de patrulla `i` (0..3) del estado `state`, o del puesto con `TO_POST`. */
  pointX(state: number, i: number): number {
    return i === TO_POST ? this.px : (this.corners[state]?.[2 * i] ?? this.px);
  }

  /** y del punto de patrulla `i` (0..3) del estado `state`, o del puesto con `TO_POST`. */
  pointY(state: number, i: number): number {
    return i === TO_POST ? this.py : (this.corners[state]?.[2 * i + 1] ?? this.py);
  }

  /**
   * Objetivo del tick para ir de (ex, ey) al punto `i` del estado `state` (o al puesto con
   * `TO_POST`), escrito en `out` sin asignar (spec enemy-behavior, "Navegación hacia un punto
   * fijo"): la regla de la persecución con el campo de la celda del punto.
   */
  steer(state: number, i: number, ex: number, ey: number, out: { x: number; y: number }): void {
    const qx = this.pointX(state, i);
    const qy = this.pointY(state, i);
    const key = this.map.rowAt(qy) * this.map.cols + this.map.colAt(qx);
    const field = this.fields.get(key);
    if (field) {
      field.steer(ex, ey, qx, qy, out);
    } else {
      out.x = qx;
      out.y = qy;
    }
  }

  /** Guardias vivos que guardan este puesto. */
  get alive(): number {
    return this.guards;
  }

  /** Un guardia nuevo (nacimiento o `RunSetup`) guarda este puesto. */
  take(): void {
    this.guards += 1;
  }

  /** Baja de uno de sus guardias: deja de contar para el tope. */
  release(): void {
    this.guards = Math.max(0, this.guards - 1);
  }
}
