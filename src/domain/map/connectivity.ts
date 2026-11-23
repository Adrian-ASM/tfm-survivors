import { codeOf, isWalkableCode } from './CellType';
import type { GameMap } from './GameMap';

/**
 * BFS 4-vecina sobre celdas caminables desde la celda `start` (índice en orden de filas), con los
 * buffers del llamador (sin asignar): marca con 1 en `seen` cada celda alcanzada y devuelve
 * cuántas son. `seen` debe llegar a 0 en las celdas por explorar; `queue` tiene longitud ≥ celdas.
 * Con `cellSize ≥ 2 · radio` (MapRules) equivale a la alcanzabilidad del círculo del jugador: dos
 * celdas que solo comparten esquina no comunican.
 */
export function reachableFrom(
  cells: Uint8Array,
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
function visit(j: number, cells: Uint8Array, seen: Uint8Array, queue: Int32Array, tail: number) {
  if (seen[j] !== 0 || !isWalkableCode(cells[j] ?? -1)) return tail;
  seen[j] = 1;
  queue[tail] = j;
  return tail + 1;
}

/** Códigos de las celdas del mapa en orden de filas (copia; fuera del tick). */
function codesOf(map: GameMap): Uint8Array {
  const codes = new Uint8Array(map.cols * map.rows);
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) codes[r * map.cols + c] = codeOf(map.typeAt(c, r));
  }
  return codes;
}

/** Celdas alcanzables (1) desde la del centro de la zona de inicio, en orden de filas. */
export function reachableCells(map: GameMap): Uint8Array {
  const n = map.cols * map.rows;
  const seen = new Uint8Array(n);
  const start = map.rowAt(map.start.y) * map.cols + map.colAt(map.start.x);
  reachableFrom(codesOf(map), map.cols, map.rows, start, seen, new Int32Array(n));
  return seen;
}

/** ¿Es alcanzable toda celda caminable desde la posición inicial? (spec "Conectividad"). */
export function isFullyConnected(map: GameMap): boolean {
  const seen = reachableCells(map);
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (map.isWalkable(c, r) && seen[r * map.cols + c] !== 1) return false;
    }
  }
  return true;
}
