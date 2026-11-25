import type { MapSnapshot } from '../../../domain/map/MapSnapshot';
import type { DecorAppearance, DecorItem } from '../../content/appearanceSchema';
import { deriveSeed } from '../../random/deriveSeed';
import { shoreCells } from './shoreTiles';

// Decoración del mapa generado (change 0029, design §Colocación): celdas válidas, huella de la base y
// elección por hash de la semilla de decoración y de la celda, sin PRNG ni orden de recorrido. Puro:
// no consume ningún `RandomGenerator`, no depende del tick, de la cámara ni de la carga de hojas.

/**
 * Sales de hash de la decoración (no son contenido de juego, como `FLIP_BIT`): por encima de 2¹⁶
 * para no coincidir con ningún índice de celda (el árbol usa `deriveSeed(decorSeed, índice)`).
 */
export const DECOR_PLACE_KEY = 0x10000;
export const DECOR_KIND_KEY = 0x10001;
/** Sal de la fase de las torres goblin intactas (0029, decisión 8). */
export const TOWER_PHASE_KEY = 0x10002;

/** Área mínima (px²) que una celda comparte con la base para contar en su huella (spec, > 1 px). */
const MIN_SHARED_AREA = 1;

/** Una decoración colocada: celda de anclaje, aspecto, origen en mundo y huella de su base. */
export interface PlacedDecor {
  readonly col: number;
  readonly row: number;
  /** Índice del aspecto en `map.decor.items`. */
  readonly item: number;
  /** Hoja del aspecto: lo identifica. */
  readonly file: string;
  readonly x: number;
  readonly y: number;
  readonly tall: boolean;
  /** Objetos de escena nominales: 1 si es baja, 2 si es alta. */
  readonly pieces: number;
  /** Índices (orden de filas) de las celdas de la huella de su base. */
  readonly base: readonly number[];
}

/** Caja de mundo de un rectángulo (x0, y0)–(x1, y1). */
interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Fila del frame donde empieza la celda de anclaje: `origin.y · alto − cellSize / escala`. */
export function decorCut(item: DecorItem, cellSize: number): number {
  const h = item.sheet.frameHeight;
  return Math.min(Math.max(item.origin.y * h - cellSize / item.scale, 0), h);
}

/** Caja de la base: el dibujo entero si es baja; desde el corte hasta abajo si es alta. */
export function decorBaseRect(item: DecorItem, x: number, y: number, cellSize: number): Rect {
  const { frameWidth: w, frameHeight: h } = item.sheet;
  const k = item.scale;
  const top = item.tall ? decorCut(item, cellSize) : 0;
  return {
    x0: x - item.origin.x * w * k,
    x1: x + (1 - item.origin.x) * w * k,
    y0: y + (top - item.origin.y * h) * k,
    y1: y + (1 - item.origin.y) * h * k,
  };
}

/**
 * Celdas de la huella de la base (las que comparten > 1 px² con ella), o `null` si alguna cae fuera
 * de la rejilla.
 */
export function baseCells(map: MapSnapshot, r: Rect): number[] | null {
  const s = map.cellSize;
  const out: number[] = [];
  for (let row = Math.floor(r.y0 / s); row <= Math.floor(r.y1 / s); row++) {
    const dy = Math.min(r.y1, (row + 1) * s) - Math.max(r.y0, row * s);
    for (let col = Math.floor(r.x0 / s); col <= Math.floor(r.x1 / s); col++) {
      const dx = Math.min(r.x1, (col + 1) * s) - Math.max(r.x0, col * s);
      if (dx <= 0 || dy <= 0 || dx * dy <= MIN_SHARED_AREA) continue;
      if (col < 0 || row < 0 || col >= map.cols || row >= map.rows) return null;
      out.push(row * map.cols + col);
    }
  }
  return out;
}

/** ¿Está la celda en la zona de inicio? Misma regla que `MapRules.inStartZone` (con `map.start`). */
export function inStartZone(map: MapSnapshot, col: number, row: number): boolean {
  const s = map.cellSize;
  const width = map.cols * s;
  const height = map.rows * s;
  const { x, y, radius } = map.start;
  const nx = Math.max(col * s, Math.min(x, Math.min((col + 1) * s, width)));
  const ny = Math.max(row * s, Math.min(y, Math.min((row + 1) * s, height)));
  const dx = x - nx;
  const dy = y - ny;
  return dx * dx + dy * dy < radius * radius;
}

/**
 * Máscara de celdas válidas para decoración (spec "Celda válida para decoración"): `grass` fuera de la
 * zona de inicio, de la huella del castillo ampliada `castleMargin`, de solares, casas y torres, de
 * la orilla y de las celdas de recurso. Sin huella de castillo (vacío y explícitos), ninguna.
 */
export function validDecorCells(map: MapSnapshot, castleMargin: number): Uint8Array {
  const { cols, rows } = map;
  const mask = new Uint8Array(cols * rows);
  const castle = map.castle;
  if (!castle) return mask;
  map.cells.forEach((t, i) => {
    const col = i % cols;
    if (t === 'grass' && !inStartZone(map, col, (i - col) / cols)) mask[i] = 1;
  });
  const clear = (c0: number, r0: number, c1: number, r1: number) => {
    for (let r = Math.max(r0, 0); r <= Math.min(r1, rows - 1); r++)
      for (let c = Math.max(c0, 0); c <= Math.min(c1, cols - 1); c++) mask[r * cols + c] = 0;
  };
  const m = castleMargin;
  clear(castle.firstCol - m, castle.firstRow - m, castle.lastCol + m, castle.lastRow + m);
  for (const f of [...map.sites, ...map.structures])
    clear(f.col, f.row, f.col + f.cols - 1, f.row + f.rows - 1);
  for (const { col, row } of shoreCells(map)) clear(col, row, col, row);
  const s = map.cellSize;
  for (const p of map.woodPiles) {
    const col = Math.floor(p.x / s);
    const row = Math.floor(p.y / s);
    clear(col, row, col, row);
  }
  for (const v of map.veins) clear(v.col, v.row, v.col, v.row);
  return mask;
}

/**
 * Decoración del mapa (design §Colocación, pasos 3–5): `n = ⌊válidas / densidad⌋` intentos sobre las
 * celdas válidas en orden de menor hash `deriveSeed(placeSeed, i)` (empate por índice); el tipo por
 * `deriveSeed(kindSeed, i) mod aspectos`. Entra si toda su huella de base es válida y libre y cabe
 * en el tope de objetos (sobre los datos, no sobre la carga).
 */
export function placeDecor(
  map: MapSnapshot,
  decor: DecorAppearance,
  decorSeed: number,
): PlacedDecor[] {
  const valid = validDecorCells(map, decor.castleMargin);
  const candidates: { i: number; h: number }[] = [];
  const placeSeed = deriveSeed(decorSeed, DECOR_PLACE_KEY);
  valid.forEach((v, i) => {
    if (v === 1) candidates.push({ i, h: deriveSeed(placeSeed, i) });
  });
  candidates.sort((a, b) => a.h - b.h || a.i - b.i);
  const attempts = Math.floor(candidates.length / decor.density);
  const kindSeed = deriveSeed(decorSeed, DECOR_KIND_KEY);
  const taken = new Uint8Array(valid.length);
  const out: PlacedDecor[] = [];
  const s = map.cellSize;
  let objects = 0;
  for (const { i } of candidates.slice(0, attempts)) {
    const item = deriveSeed(kindSeed, i) % decor.items.length;
    const aspect = decor.items[item];
    if (!aspect) continue;
    const pieces = aspect.tall ? 2 : 1;
    if (objects + pieces > decor.maxObjects) continue;
    const col = i % map.cols;
    const row = (i - col) / map.cols;
    const x = (col + 0.5) * s;
    const y = (row + 1) * s;
    const base = baseCells(map, decorBaseRect(aspect, x, y, s));
    if (!base || base.some((c) => valid[c] !== 1 || taken[c] === 1)) continue;
    for (const c of base) taken[c] = 1;
    objects += pieces;
    out.push({ col, row, item, file: aspect.sheet.file, x, y, tall: aspect.tall, pieces, base });
  }
  return out;
}
