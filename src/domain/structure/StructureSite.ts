import type { StructureType } from './StructureType';

/** Puerta de una casa: celda (c0 + ⌊cols / 2⌋, r0 + rows) y su centro (spec goblin-structures). */
export interface StructureDoor {
  readonly col: number;
  readonly row: number;
  readonly x: number;
  readonly y: number;
}

/** Geometría del mundo que necesita un sitio: celda y tamaño en px. */
export interface SiteGrid {
  readonly cellSize: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Sitio estático de una estructura (value object, ADR-0020): id en la partida, tipo, huella
 * (primera columna y fila, columnas y filas), posición en el centro del rectángulo de mundo de la
 * huella, radio de impacto del tipo y puerta (solo las casas).
 */
export interface StructureSite {
  readonly id: number;
  readonly type: StructureType;
  readonly col: number;
  readonly row: number;
  readonly cols: number;
  readonly rows: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly door: StructureDoor | null;
}

/** Centro del tramo [i · s, min((i + n) · s, lado)] de un eje (recortado al mundo). */
const middle = (i: number, n: number, s: number, side: number): number =>
  (i * s + Math.min((i + n) * s, side)) / 2;

/** Sitio de la huella `cols × rows` que empieza en (col, row). Geometría pura, sin validar. */
export function structureSite(
  id: number,
  type: StructureType,
  col: number,
  row: number,
  cols: number,
  rows: number,
  grid: SiteGrid,
): StructureSite {
  const { cellSize: s, width, height } = grid;
  const doorCol = col + Math.floor(cols / 2);
  const doorRow = row + rows;
  const door =
    type.kind === 'house'
      ? Object.freeze({
          col: doorCol,
          row: doorRow,
          x: middle(doorCol, 1, s, width),
          y: middle(doorRow, 1, s, height),
        })
      : null;
  return Object.freeze({
    id,
    type,
    col,
    row,
    cols,
    rows,
    x: middle(col, cols, s, width),
    y: middle(row, rows, s, height),
    radius: type.radius,
    door,
  });
}
