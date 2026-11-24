import type { GameMap } from './GameMap';

/** Distancia de una celda sin fuentes (mayor que cualquier distancia de la rejilla). */
export const FAR = 0x7fffffff;

/**
 * Distancia de Chebyshev en celdas de cada celda al conjunto `isSource` (BFS de 8 vecinos desde
 * todas las fuentes a la vez; `FAR` si no hay ninguna). O(celdas). La usan la colocación de
 * estructuras (ADR-0020) y la de recursos (ADR-0021).
 */
export function chebyshevFrom(
  map: GameMap,
  isSource: (c: number, r: number) => boolean,
): Int32Array {
  const { cols, rows } = map;
  const dist = new Int32Array(cols * rows).fill(FAR);
  const queue = new Int32Array(cols * rows);
  let tail = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isSource(c, r)) continue;
      dist[r * cols + c] = 0;
      queue[tail++] = r * cols + c;
    }
  }
  for (let head = 0; head < tail; head++) {
    const i = queue[head] ?? 0;
    const c = i % cols;
    const r = (i - c) / cols;
    const d = (dist[i] ?? 0) + 1;
    for (let rr = Math.max(0, r - 1); rr <= Math.min(rows - 1, r + 1); rr++) {
      for (let cc = Math.max(0, c - 1); cc <= Math.min(cols - 1, c + 1); cc++) {
        const j = rr * cols + cc;
        if ((dist[j] ?? 0) !== FAR) continue;
        dist[j] = d;
        queue[tail++] = j;
      }
    }
  }
  return dist;
}

/** ¿Está (c, r) en la huella del castillo del mapa (ninguna en el vacío y en los explícitos)? */
export function inCastle(map: GameMap, c: number, r: number): boolean {
  const castle = map.castle;
  return (
    castle !== null &&
    c >= castle.firstCol &&
    c <= castle.lastCol &&
    r >= castle.firstRow &&
    r <= castle.lastRow
  );
}
