import type { CellType } from '../../domain/map/CellType';
import type { MapSnapshot } from '../../domain/map/MapSnapshot';

/** Tipos de celda que se pintan: la hierba no (se ve el fondo). */
export type PaintedCell = Exclude<CellType, 'grass'>;

/** Color (0xRRGGBB) de cada tipo pintado, de los datos de aspecto (`terrain`). */
export type TerrainColors = Readonly<Record<PaintedCell, number>>;

/** Celdas pintadas por tipo (sonda de render, change 0015). */
export type CellCounts = Record<PaintedCell, number>;

export const zeroCells = (): CellCounts => ({ trunk: 0, water: 0, bridge: 0 });

/** Una celda a pintar: su posición en la rejilla, su rectángulo de mundo recortado y su color. */
export interface CellFill {
  readonly col: number;
  readonly row: number;
  readonly color: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Costura sin motor de la textura del mapa (design 0015 §5): una celda = un píxel de una textura
 * de `cols × rows` que la escena escala × `cellSize`. Se repinta entera una vez por partida.
 */
export interface TerrainCanvas {
  clear(): void;
  fill(col: number, row: number, color: number): void;
  /** Sube los cambios a la GPU (una vez por partida). */
  refresh(): void;
}

const isPainted = (t: CellType): t is PaintedCell => t !== 'grass';

/**
 * Celdas no-hierba del mapa con su rectángulo de mundo (recortado al mundo `width × height`) y el
 * recuento por tipo. Puro: lo prueban los tests sin motor.
 */
export function terrainFills(
  map: MapSnapshot,
  colors: TerrainColors,
  world: { readonly width: number; readonly height: number },
): { fills: CellFill[]; counts: CellCounts } {
  const fills: CellFill[] = [];
  const counts = zeroCells();
  const s = map.cellSize;
  map.cells.forEach((type, i) => {
    if (!isPainted(type)) return;
    const col = i % map.cols;
    const row = (i - col) / map.cols;
    const x = col * s;
    const y = row * s;
    const width = Math.min(x + s, world.width) - x;
    const height = Math.min(y + s, world.height) - y;
    fills.push({ col, row, color: colors[type], x, y, width, height });
    counts[type] += 1;
  });
  return { fills, counts };
}

/**
 * Pinta el mapa de una partida en la textura (borra el anterior) y devuelve las celdas pintadas por
 * tipo. Un `refresh` por llamada.
 */
export function paintTerrain(
  canvas: TerrainCanvas,
  map: MapSnapshot,
  colors: TerrainColors,
  world: { readonly width: number; readonly height: number },
): CellCounts {
  const { fills, counts } = terrainFills(map, colors, world);
  canvas.clear();
  for (const f of fills) canvas.fill(f.col, f.row, f.color);
  canvas.refresh();
  return counts;
}
