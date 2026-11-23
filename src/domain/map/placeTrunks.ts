import type { RandomGenerator } from '../shared/RandomGenerator';
import { GRASS, TRUNK, isWalkableCode } from './CellType';
import type { MapRules } from './MapRules';
import { reachableFrom } from './connectivity';

/** Buffers de la colocación de troncos (una asignación por mapa, ninguna por mancha). */
class TrunkDraft {
  readonly cols: number;
  readonly rows: number;
  /** Mancha a la que pertenece cada tronco (0 = ninguna). */
  readonly owner: Int32Array;
  readonly patch: Int32Array;
  readonly frontier: Int32Array;
  readonly seen: Uint8Array;
  readonly queue: Int32Array;
  readonly start: number;
  walkable = 0;

  constructor(
    readonly cells: Uint8Array,
    readonly noTrunk: Uint8Array,
    rules: MapRules,
  ) {
    const n = cells.length;
    this.cols = rules.cols;
    this.rows = rules.rows;
    this.owner = new Int32Array(n);
    this.patch = new Int32Array(rules.config.trunkPatch.max);
    this.frontier = new Int32Array(n);
    this.seen = new Uint8Array(n);
    this.queue = new Int32Array(n);
    this.start = Math.floor(rules.start.y / rules.cellSize) * rules.cols;
    this.start += Math.floor(rules.start.x / rules.cellSize);
    for (const code of cells) if (isWalkableCode(code)) this.walkable++;
  }

  /** ¿Puede la celda i entrar en la mancha `id`? Hierba, no vetada y sin tocar otra mancha. */
  eligible(i: number, id: number): boolean {
    if (this.cells[i] !== GRASS || this.noTrunk[i] === 1) return false;
    const c = i % this.cols;
    const r = (i - c) / this.cols;
    return (
      (c === 0 || this.free(i - 1, id)) &&
      (c === this.cols - 1 || this.free(i + 1, id)) &&
      (r === 0 || this.free(i - this.cols, id)) &&
      (r === this.rows - 1 || this.free(i + this.cols, id))
    );
  }

  private free(j: number, id: number): boolean {
    return this.cells[j] !== TRUNK || this.owner[j] === id;
  }

  set(i: number, id: number): void {
    this.cells[i] = id === 0 ? GRASS : TRUNK;
    this.owner[i] = id;
  }

  /** ¿Siguen alcanzables desde el centro todas las celdas caminables? */
  connected(): boolean {
    this.seen.fill(0);
    const reached = reachableFrom(
      this.cells,
      this.cols,
      this.rows,
      this.start,
      this.seen,
      this.queue,
    );
    return reached === this.walkable;
  }
}

/** Frontera de la mancha: vecinas 4-conexas elegibles, sin repetir. Devuelve cuántas hay. */
function collectFrontier(d: TrunkDraft, size: number, id: number): number {
  let count = 0;
  const add = (j: number): void => {
    if (!d.eligible(j, id)) return;
    for (let k = 0; k < count; k++) if (d.frontier[k] === j) return;
    d.frontier[count++] = j;
  };
  for (let p = 0; p < size; p++) {
    const i = d.patch[p] ?? 0;
    const c = i % d.cols;
    const r = (i - c) / d.cols;
    if (c > 0) add(i - 1);
    if (c < d.cols - 1) add(i + 1);
    if (r > 0) add(i - d.cols);
    if (r < d.rows - 1) add(i + d.cols);
  }
  return count;
}

/**
 * Intenta una mancha de `target` celdas desde una semilla al azar, creciendo por su frontera. Si no
 * llega al tamaño o desconecta alguna celda caminable, se revierte entera. Devuelve su tamaño (0 si
 * se revierte).
 */
function tryPatch(d: TrunkDraft, rules: MapRules, random: RandomGenerator, id: number): number {
  const { min, max } = rules.config.trunkPatch;
  const target = min + Math.floor(random.next() * (max - min + 1));
  const seed = Math.floor(random.next() * d.cells.length);
  if (!d.eligible(seed, id)) return 0;
  d.patch[0] = seed;
  d.set(seed, id);
  let size = 1;
  while (size < target) {
    const options = collectFrontier(d, size, id);
    if (options === 0) break;
    const next = d.frontier[Math.floor(random.next() * options)] ?? 0;
    d.patch[size++] = next;
    d.set(next, id);
  }
  d.walkable -= size;
  if (size === target && d.connected()) return size;
  for (let p = 0; p < size; p++) d.set(d.patch[p] ?? 0, 0);
  d.walkable += size;
  return 0;
}

/**
 * Troncos (design 0015 §3.2 paso 3): manchas de [min, max] celdas que no se fusionan ni tocan las
 * celdas vetadas, hasta alcanzar `round(trunkDensity · N)` o agotar `patchAttempts`. Rechazo por
 * BFS: ninguna mancha deja una celda caminable sin alcanzar. Devuelve los troncos colocados.
 */
export function placeTrunks(
  cells: Uint8Array,
  noTrunk: Uint8Array,
  rules: MapRules,
  random: RandomGenerator,
): number {
  const target = trunkTarget(rules);
  if (target === 0) return 0;
  const d = new TrunkDraft(cells, noTrunk, rules);
  let trunks = 0;
  for (
    let attempt = 1;
    attempt <= rules.config.tuning.patchAttempts && trunks < target;
    attempt++
  ) {
    trunks += tryPatch(d, rules, random, attempt);
  }
  return trunks;
}

/** Objetivo de troncos: `round(trunkDensity · N)`. */
export function trunkTarget(rules: MapRules): number {
  return Math.round(rules.config.trunkDensity * rules.cellCount);
}
