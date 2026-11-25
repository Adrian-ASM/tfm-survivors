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
  /** Puerta de la tienda (0024): la del castillo en el generado, la declarada o `null`. */
  readonly door: MapPoint | null;
  /** Casas y torres de la partida en su orden fijo (estático: la vida va en `RunSnapshot`). */
  readonly structures: readonly MapStructure[];
  /** Vetas en su orden de colocación o declaración (estático: el estado va en `RunSnapshot`). */
  readonly veins: readonly MapVein[];
  /** Montones de madera iniciales en su orden (posición inicial; los recogibles, en `RunSnapshot`). */
  readonly woodPiles: readonly MapPoint[];
  /** Solares de obra en el orden de la lista (0026, estático: el estado va en `RunSnapshot`). */
  readonly sites: readonly MapSite[];
}

/** Punto del mapa en px. */
export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

/** Veta del mapa (spec procedural-map 0022): id, posición, celda y radio de contacto. */
export interface MapVein extends MapPoint {
  readonly id: number;
  readonly col: number;
  readonly row: number;
  readonly radius: number;
}

/**
 * Solar del mapa (spec build-sites 0026): id, huella (ancla, columnas y filas; la de la casa y la de
 * la torre son la misma, design §1), centro de la huella y acceso.
 */
export interface MapSite {
  readonly id: number;
  readonly col: number;
  readonly row: number;
  readonly cols: number;
  readonly rows: number;
  readonly x: number;
  readonly y: number;
  readonly access: MapPoint;
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

/** Vista del mapa con sus estructuras, vetas, montones y solares (por defecto, ninguno); copia y congela. */
export function toMapSnapshot(
  map: GameMap,
  structures: readonly MapStructure[] = [],
  resources: {
    readonly veins: readonly MapPoint[];
    readonly woodPiles: readonly MapPoint[];
    readonly veinRadius: number;
  } = { veins: [], woodPiles: [], veinRadius: 0 },
  sites: readonly MapSite[] = [],
): MapSnapshot {
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
    door: map.door ? Object.freeze({ x: map.door.x, y: map.door.y }) : null,
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
    veins: Object.freeze(
      resources.veins.map((v, id) =>
        Object.freeze({
          id,
          x: v.x,
          y: v.y,
          col: map.colAt(v.x),
          row: map.rowAt(v.y),
          radius: resources.veinRadius,
        }),
      ),
    ),
    woodPiles: Object.freeze(resources.woodPiles.map((p) => Object.freeze({ x: p.x, y: p.y }))),
    sites: Object.freeze(
      sites.map((s) =>
        Object.freeze({
          id: s.id,
          col: s.col,
          row: s.row,
          cols: s.cols,
          rows: s.rows,
          x: s.x,
          y: s.y,
          access: Object.freeze({ x: s.access.x, y: s.access.y }),
        }),
      ),
    ),
  });
}
