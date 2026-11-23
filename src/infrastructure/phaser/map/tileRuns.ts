import type { MapSnapshot } from '../../../domain/map/MapSnapshot';
import { shoreCells } from './shoreTiles';

// Agrupado de baldosas en tramos (design 0016 §12.3): agua y orillas en rectángulos de celdas
// contiguas con la misma clave, por filas o por columnas, el que dé menos objetos. Puro.

/** Celda con la clave que decide qué baldosa lleva (p. ej. `water` o el caso de orilla). */
export interface KeyedCell {
  readonly col: number;
  readonly row: number;
  readonly key: string;
}

/** Tramo: rectángulo de `cols × rows` celdas desde (col, row), todas con la misma clave. */
export interface TileRun {
  readonly col: number;
  readonly row: number;
  readonly cols: number;
  readonly rows: number;
  readonly key: string;
}

export type RunAxis = 'rows' | 'cols';

/** Une celdas contiguas de la misma clave a lo largo de filas (`rows`) o de columnas (`cols`). */
export function mergeTileRuns(cells: readonly KeyedCell[], axis: RunAxis): TileRun[] {
  const byRows = axis === 'rows';
  const major = (c: KeyedCell) => (byRows ? c.row : c.col);
  const minor = (c: KeyedCell) => (byRows ? c.col : c.row);
  const sorted = [...cells].sort((a, b) => major(a) - major(b) || minor(a) - minor(b));
  const runs: TileRun[] = [];
  let open: { start: KeyedCell; length: number } | null = null;
  const close = (): void => {
    if (!open) return;
    const { start, length } = open;
    runs.push({
      col: start.col,
      row: start.row,
      cols: byRows ? length : 1,
      rows: byRows ? 1 : length,
      key: start.key,
    });
  };
  for (const cell of sorted) {
    const continues =
      open !== null &&
      major(open.start) === major(cell) &&
      open.start.key === cell.key &&
      minor(open.start) + open.length === minor(cell);
    if (open && continues) {
      open.length += 1;
    } else {
      close();
      open = { start: cell, length: 1 };
    }
  }
  close();
  return runs;
}

/** Tramos por filas o por columnas, el agrupado con menos tramos (a igualdad, por filas). */
export function bestRuns(cells: readonly KeyedCell[]): TileRun[] {
  const rows = mergeTileRuns(cells, 'rows');
  const cols = mergeTileRuns(cells, 'cols');
  return cols.length < rows.length ? cols : rows;
}

/**
 * Celdas que pinta el agua con arte (design §12.2 B6): `water` y `bridge` y, si las orillas tienen
 * arte, también las celdas de orilla (el agua asoma por el margen transparente de su pieza).
 */
export function waterTileCells(map: MapSnapshot, withShores: boolean): KeyedCell[] {
  const out: KeyedCell[] = [];
  map.cells.forEach((t, i) => {
    if (t !== 'water' && t !== 'bridge') return;
    const col = i % map.cols;
    out.push({ col, row: (i - col) / map.cols, key: 'water' });
  });
  if (withShores) for (const s of shoreCells(map)) out.push({ ...s, key: 'water' });
  return out;
}

/** Celdas de orilla con su caso como clave (los tramos de orilla agrupan casos iguales). */
export function shoreTileCells(map: MapSnapshot): KeyedCell[] {
  return shoreCells(map).map(({ col, row, kind }) => ({ col, row, key: kind }));
}
