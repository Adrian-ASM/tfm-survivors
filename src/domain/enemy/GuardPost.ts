import type { Arena } from '../arena/Arena';
import { codesOf } from '../map/connectivity';
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
 * de distancias por punto distinto (puesto y esquinas), orientado una sola vez porque el mapa no
 * cambia. Cuenta los guardias vivos que lo guardan (tope de la casa). No consume azar ni asigna en
 * el tick: la BFS de cada campo se hace en su primera consulta.
 */
export class GuardPost {
  /** Por índice de estado: las esquinas recolocadas de ese estado de patrulla, o `null`. */
  private readonly corners: (Float64Array | null)[];
  /** Campo por celda de destino (índice de celda), compartido por los puntos de esa celda. */
  private readonly fields = new Map<number, FlowField>();
  private readonly map: GameMap;
  private guards = 0;

  constructor(
    readonly x: number,
    readonly y: number,
    type: EnemyType,
    map: GameMap,
    arena: Arena,
  ) {
    this.map = map;
    const codes = codesOf(map);
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
        this.fieldTo(spot.x, spot.y, codes);
      });
      return points;
    });
    this.fieldTo(x, y, codes);
  }

  /** Campo orientado a la celda de (qx, qy); lo crea la primera vez (solo al construir). */
  private fieldTo(qx: number, qy: number, codes: Uint8Array): FlowField {
    const col = this.map.colAt(qx);
    const row = this.map.rowAt(qy);
    const key = row * this.map.cols + col;
    let field = this.fields.get(key);
    if (!field) {
      field = new FlowField(this.map, codes);
      field.retarget(col, row);
      this.fields.set(key, field);
    }
    return field;
  }

  /** x del punto de patrulla `i` (0..3) del estado `state`, o del puesto con `TO_POST`. */
  pointX(state: number, i: number): number {
    return i === TO_POST ? this.x : (this.corners[state]?.[2 * i] ?? this.x);
  }

  /** y del punto de patrulla `i` (0..3) del estado `state`, o del puesto con `TO_POST`. */
  pointY(state: number, i: number): number {
    return i === TO_POST ? this.y : (this.corners[state]?.[2 * i + 1] ?? this.y);
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
