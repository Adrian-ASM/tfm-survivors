import type { CellType } from '../../domain/map/CellType';
import type { MapSnapshot } from '../../domain/map/MapSnapshot';

/**
 * Tipos de celda que se pintan: la hierba no (se ve el fondo). El castillo (0016) aún no tiene
 * color ni arte en este adaptador: entra con el plan del mapa (`planMapArt`).
 */
export type PaintedCell = Exclude<CellType, 'grass' | 'castle'>;

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
 * Costura sin motor del pintado del mapa: rectángulos de mundo con color liso, solo de las celdas
 * no-hierba. Sustituye a la textura del tamaño del mundo del design 0015 §5, que añadía una capa
 * a pantalla completa (transparente en la hierba) y en CI sin GPU partía los fps a la mitad (PR #36).
 * Se repinta una vez por partida, no por frame.
 */
export interface TerrainCanvas {
  /** Quita los rectángulos de la partida anterior. */
  clear(): void;
  rect(x: number, y: number, width: number, height: number, color: number): void;
}

const isPainted = (t: CellType): t is PaintedCell => t !== 'grass' && t !== 'castle';

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
 * Une las celdas contiguas de una fila con el mismo color en un solo rectángulo (menos objetos y el
 * mismo área pintada). Entrada en orden de filas, como la da `terrainFills`.
 */
export function mergeRuns(fills: readonly CellFill[]): CellFill[] {
  const runs: CellFill[] = [];
  for (const f of fills) {
    const last = runs[runs.length - 1];
    if (last?.row === f.row && last.color === f.color && last.x + last.width === f.x) {
      runs[runs.length - 1] = { ...last, width: last.width + f.width };
    } else {
      runs.push(f);
    }
  }
  return runs;
}

/**
 * Pinta el mapa de una partida (borra el anterior) y devuelve las celdas pintadas por tipo: un
 * rectángulo por tramo de celdas no-hierba; la hierba no se pinta ni se cubre.
 */
export function paintTerrain(
  canvas: TerrainCanvas,
  map: MapSnapshot,
  colors: TerrainColors,
  world: { readonly width: number; readonly height: number },
): CellCounts {
  const { fills, counts } = terrainFills(map, colors, world);
  canvas.clear();
  for (const r of mergeRuns(fills)) canvas.rect(r.x, r.y, r.width, r.height, r.color);
  return counts;
}
