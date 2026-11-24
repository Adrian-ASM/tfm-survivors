import { CELL_TYPES, type CellType } from './CellType';
import type { CastleFootprint, GameMap } from './GameMap';
import type { StartZone } from './MapRules';

/**
 * Vista congelada del mapa de una partida para el adaptador y la sonda E2E (design 0015 §3.5). Es
 * estática: se construye una vez por partida y no va en `RunSnapshot` (copiarla por frame
 * asignaría). Modificarla desde fuera no toca la rejilla interna.
 */
export interface MapSnapshot {
  readonly cols: number;
  readonly rows: number;
  readonly cellSize: number;
  /** Tipos de las `cols · rows` celdas en orden de filas. */
  readonly cells: readonly CellType[];
  readonly counts: Readonly<Record<CellType, number>>;
  /** Punto de salida del jugador y centro de la zona de inicio del mapa. */
  readonly start: StartZone;
  /** Huella del castillo del mapa generado; `null` en el vacío y en los explícitos. */
  readonly castle: CastleFootprint | null;
  /** Casas y torres de la partida en su orden fijo (estático: la vida va en `RunSnapshot`). */
  readonly structures: readonly MapStructure[];
}

/**
 * Estructura del mapa (spec procedural-map 0021): id, tipo, huella, posición, radio de impacto y
 * puerta (solo las casas; `null` en las torres).
 */
export interface MapStructure {
  readonly id: number;
  readonly type: string;
  readonly col: number;
  readonly row: number;
  readonly cols: number;
  readonly rows: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly door: {
    readonly col: number;
    readonly row: number;
    readonly x: number;
    readonly y: number;
  } | null;
}

/** Vista del mapa con sus estructuras (por defecto, ninguna); copia y congela cada estructura. */
export function toMapSnapshot(map: GameMap, structures: readonly MapStructure[] = []): MapSnapshot {
  const cells: CellType[] = [];
  const counts = Object.fromEntries(CELL_TYPES.map((t) => [t, 0])) as Record<CellType, number>;
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const type = map.typeAt(c, r);
      cells.push(type);
      counts[type] += 1;
    }
  }
  return Object.freeze({
    cols: map.cols,
    rows: map.rows,
    cellSize: map.cellSize,
    cells: Object.freeze(cells),
    counts: Object.freeze(counts),
    start: Object.freeze({ ...map.start }),
    castle: map.castle ? Object.freeze({ ...map.castle }) : null,
    structures: Object.freeze(
      structures.map((s) =>
        Object.freeze({
          id: s.id,
          type: s.type,
          col: s.col,
          row: s.row,
          cols: s.cols,
          rows: s.rows,
          x: s.x,
          y: s.y,
          radius: s.radius,
          door: s.door ? Object.freeze({ ...s.door }) : null,
        }),
      ),
    ),
  });
}
