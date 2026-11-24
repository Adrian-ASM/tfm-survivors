import type { StructureSite } from '../structure/StructureSite';
import { chebyshevFrom, inCastle } from './chebyshev';
import type { GameMap } from './GameMap';

/** Distancias mínimas de Chebyshev, en celdas, a la zona de inicio y a la huella del castillo. */
export interface CellDistances {
  readonly minStartCells: number;
  readonly minCastleCells: number;
}

/**
 * Celdas base de una colocación (design 0022 §4 y 0023 §4.1), en orden de filas: `grass`, fuera de
 * las huellas y de las puertas de `sites` y, si se dan `distances`, a esas distancias de la zona de
 * inicio y del castillo. La usan las vetas y montones (ADR-0021) y las ovejas (ADR-0022). Pura.
 */
export function candidateCells(
  map: GameMap,
  sites: readonly StructureSite[],
  distances: CellDistances | null = null,
): number[] {
  const { cols, rows } = map;
  const toStart = distances ? chebyshevFrom(map, (c, r) => map.rules.inStartZone(c, r)) : null;
  const toCastle = distances ? chebyshevFrom(map, (c, r) => inCastle(map, c, r)) : null;
  const taken = new Uint8Array(cols * rows);
  for (const s of sites) {
    for (let r = s.row; r < s.row + s.rows; r++) {
      for (let c = s.col; c < s.col + s.cols; c++) taken[r * cols + c] = 1;
    }
    if (s.door) taken[s.door.row * cols + s.door.col] = 1;
  }
  const cells: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (map.typeAt(c, r) !== 'grass' || taken[i] === 1) continue;
      if (distances && toStart && toCastle) {
        if ((toStart[i] ?? 0) < distances.minStartCells) continue;
        if ((toCastle[i] ?? 0) < distances.minCastleCells) continue;
      }
      cells.push(i);
    }
  }
  return cells;
}

/** Centro de la celda `i` (de su rectángulo recortado en el borde del mundo). */
export function cellCenter(map: GameMap, i: number): { x: number; y: number } {
  const c = i % map.cols;
  const rect = map.cellRect(c, (i - c) / map.cols);
  return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
}
