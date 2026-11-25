import { isWalkableCode } from './CellType';
import type { GameMap } from './GameMap';

/**
 * BFS 4-vecina sobre celdas caminables desde la celda `start` (índice en orden de filas), con los
 * buffers del llamador (sin asignar): marca con 1 en `seen` cada celda alcanzada y devuelve
 * cuántas son. `seen` debe llegar a 0 en las celdas por explorar; `queue` tiene longitud ≥ celdas.
 * Con `cellSize ≥ 2 · radio` (MapRules) equivale a la alcanzabilidad del círculo del jugador: dos
 * celdas que solo comparten esquina no comunican.
 */
export function reachableFrom(
  cells: ArrayLike<number>,
  cols: number,
  rows: number,
  start: number,
  seen: Uint8Array,
  queue: Int32Array,
): number {
  if (!isWalkableCode(cells[start] ?? -1) || seen[start] === 1) return 0;
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  seen[start] = 1;
  while (head < tail) {
    const i = queue[head++] ?? 0;
    const c = i % cols;
    const r = (i - c) / cols;
    if (c > 0) tail = visit(i - 1, cells, seen, queue, tail);
    if (c < cols - 1) tail = visit(i + 1, cells, seen, queue, tail);
    if (r > 0) tail = visit(i - cols, cells, seen, queue, tail);
    if (r < rows - 1) tail = visit(i + cols, cells, seen, queue, tail);
  }
  return tail;
}

/** Encola la celda j si es caminable y no vista; devuelve la cola nueva. */
function visit(
  j: number,
  cells: ArrayLike<number>,
  seen: Uint8Array,
  queue: Int32Array,
  tail: number,
) {
  if (seen[j] !== 0 || !isWalkableCode(cells[j] ?? -1)) return tail;
  seen[j] = 1;
  queue[tail] = j;
  return tail + 1;
}

/**
 * BFS 4-vecina con distancias (spec procedural-map, "Campo de distancias hacia una celda"): escribe
 * en `dist` los pasos hasta `start` de cada celda caminable conectada y −1 en el resto. Mismo orden
 * de vecinos que `reachableFrom` (izquierda, derecha, arriba, abajo). Buffers del llamador (sin
 * asignar): `dist` y `queue` con longitud ≥ celdas. Si `start` no es caminable, todo queda a −1.
 */
export function distancesFrom(
  cells: ArrayLike<number>,
  cols: number,
  rows: number,
  start: number,
  dist: Int32Array,
  queue: Int32Array,
): void {
  dist.fill(-1);
  if (start < 0 || start >= cells.length || !isWalkableCode(cells[start] ?? -1)) return;
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  dist[start] = 0;
  while (head < tail) {
    const i = queue[head++] ?? 0;
    const d = (dist[i] ?? 0) + 1;
    const c = i % cols;
    const r = (i - c) / cols;
    if (c > 0) tail = step(i - 1, d, cells, dist, queue, tail);
    if (c < cols - 1) tail = step(i + 1, d, cells, dist, queue, tail);
    if (r > 0) tail = step(i - cols, d, cells, dist, queue, tail);
    if (r < rows - 1) tail = step(i + cols, d, cells, dist, queue, tail);
  }
}

/** Fija la distancia `d` de la celda j si es caminable y no tiene; devuelve la cola nueva. */
function step(
  j: number,
  d: number,
  cells: ArrayLike<number>,
  dist: Int32Array,
  queue: Int32Array,
  tail: number,
): number {
  if (dist[j] !== -1 || !isWalkableCode(cells[j] ?? -1)) return tail;
  dist[j] = d;
  queue[tail] = j;
  return tail + 1;
}

/**
 * Códigos vivos de las celdas del mapa en orden de filas (copia; fuera del tick): el terreno con las
 * celdas construidas (ADR-0025). Sin obras, los del terreno.
 */
export function codesOf(map: GameMap): Uint8Array {
  return Uint8Array.from(map.liveCodes);
}

/** Celdas alcanzables (1) desde la celda (col, row), en orden de filas. */
export function reachableCellsFrom(map: GameMap, col: number, row: number): Uint8Array {
  const n = map.cols * map.rows;
  const seen = new Uint8Array(n);
  reachableFrom(codesOf(map), map.cols, map.rows, row * map.cols + col, seen, new Int32Array(n));
  return seen;
}

/** Celdas alcanzables (1) desde la de la salida del mapa (centro de su zona), en orden de filas. */
export function reachableCells(map: GameMap): Uint8Array {
  return reachableCellsFrom(map, map.colAt(map.start.x), map.rowAt(map.start.y));
}

/** ¿Es alcanzable toda celda caminable desde la celda (col, row)? */
export function isFullyConnectedFrom(map: GameMap, col: number, row: number): boolean {
  return allWalkableSeen(map, reachableCellsFrom(map, col, row));
}

/** ¿Es alcanzable toda celda caminable desde la posición inicial? (spec "Conectividad"). */
export function isFullyConnected(map: GameMap): boolean {
  return allWalkableSeen(map, reachableCells(map));
}

function allWalkableSeen(map: GameMap, seen: Uint8Array): boolean {
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (map.isWalkable(c, r) && seen[r * map.cols + c] !== 1) return false;
    }
  }
  return true;
}
