import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';

export const CASTLE_OUT_OF_GRID =
  'La huella del castillo y su puerta deben caber en la rejilla (como mucho la mitad de columnas y filas).';

/** Celda (columna, fila) de la rejilla. */
interface GridCell {
  readonly col: number;
  readonly row: number;
}

/**
 * Sitio del castillo en la rejilla (value object, spec procedural-map "Castillo en el mapa
 * generado"): huella de columnas `firstCol..lastCol` y filas `firstRow..lastRow`, puerta justo
 * debajo de la fila inferior y salida en el centro (del rectángulo recortado) de la puerta.
 */
export interface CastleSite {
  readonly firstCol: number;
  readonly lastCol: number;
  readonly firstRow: number;
  readonly lastRow: number;
  readonly door: GridCell;
  readonly exit: { readonly x: number; readonly y: number };
}

/** Geometría del mundo que necesita la colocación: celda y tamaño en px. */
export interface CastleGrid {
  readonly cellSize: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Coloca la huella `cols × rows` (design 0016 §3.2): con (cc, rc) la celda del centro del mundo,
 * columnas cc − ⌊cols / 2⌋ .. + cols − 1, filas rc − rows + 1 .. rc y puerta (cc, rc + 1). Falla con
 * `map.castle` si la huella pasa de ⌊columnas / 2⌋ × ⌊filas / 2⌋ o si ella o la puerta no caben.
 */
export function castleSite(
  castle: { readonly cols: number; readonly rows: number },
  grid: CastleGrid,
): Result<CastleSite, DomainError> {
  const { cellSize: s, width, height } = grid;
  const gridCols = Math.ceil(width / s);
  const gridRows = Math.ceil(height / s);
  const cc = Math.min(Math.floor(width / 2 / s), gridCols - 1);
  const rc = Math.min(Math.floor(height / 2 / s), gridRows - 1);
  const firstCol = cc - Math.floor(castle.cols / 2);
  const firstRow = rc - castle.rows + 1;
  const fits =
    castle.cols <= Math.floor(gridCols / 2) &&
    castle.rows <= Math.floor(gridRows / 2) &&
    firstCol >= 0 &&
    firstCol + castle.cols <= gridCols &&
    firstRow >= 0 &&
    rc + 1 < gridRows;
  if (!fits) return err(invalidConfig('map.castle', CASTLE_OUT_OF_GRID));
  const door = Object.freeze({ col: cc, row: rc + 1 });
  const exit = Object.freeze({
    x: (cc * s + Math.min((cc + 1) * s, width)) / 2,
    y: (door.row * s + Math.min((door.row + 1) * s, height)) / 2,
  });
  return ok(
    Object.freeze({
      firstCol,
      lastCol: firstCol + castle.cols - 1,
      firstRow,
      lastRow: rc,
      door,
      exit,
    }),
  );
}
