import type { CellType } from '../../src/domain/map/CellType';
import type { GameMap } from '../../src/domain/map/GameMap';
import { generateMap } from '../../src/domain/map/generateMap';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { buildRunRules } from '../../src/domain/run/RunConfig';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { MAP_STREAM, deriveSeed } from '../../src/infrastructure/random/deriveSeed';

/**
 * Mapa que genera el núcleo para una semilla de partida, con la misma siembra que la composición
 * (ADR-0013): `Mulberry32(deriveSeed(seed, MAP_STREAM))`.
 */
export function mapForSeed(config: RunConfig, seed: number): GameMap {
  const rules = buildRunRules(config);
  if (!rules.ok) throw new Error(rules.error.message);
  return generateMap(rules.value.map, new Mulberry32RandomGenerator(deriveSeed(seed, MAP_STREAM)));
}

/** Tipos del mapa en orden de filas. */
export function typesOf(map: GameMap): CellType[] {
  const out: CellType[] = [];
  for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) out.push(map.typeAt(c, r));
  return out;
}

export function countOf(map: GameMap, type: CellType): number {
  return typesOf(map).filter((t) => t === type).length;
}

/** Componentes 4-conexas de las celdas cuyo tipo cumple `match` (listas de índices). */
export function components(map: GameMap, match: (t: CellType) => boolean): number[][] {
  const types = typesOf(map);
  const seen = new Uint8Array(types.length);
  const out: number[][] = [];
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    if (seen[i] || t === undefined || !match(t)) continue;
    const comp: number[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length > 0) {
      const j = stack.pop() ?? 0;
      comp.push(j);
      for (const k of neighbours(map, j)) {
        const tk = types[k];
        if (!seen[k] && tk !== undefined && match(tk)) {
          seen[k] = 1;
          stack.push(k);
        }
      }
    }
    out.push(comp.sort((a, b) => a - b));
  }
  return out;
}

/** Índices de las vecinas 4-conexas de la celda i dentro de la rejilla. */
export function neighbours(map: GameMap, i: number): number[] {
  const c = i % map.cols;
  const r = (i - c) / map.cols;
  const out: number[] = [];
  if (c > 0) out.push(i - 1);
  if (c < map.cols - 1) out.push(i + 1);
  if (r > 0) out.push(i - map.cols);
  if (r < map.rows - 1) out.push(i + map.cols);
  return out;
}

const isRiver = (t: CellType): boolean => t === 'water' || t === 'bridge';

export interface RiverStats {
  readonly cells: number[];
  readonly bridges: number;
  /** Toca izquierda y derecha ('h') o arriba y abajo ('v'); null si no toca dos bordes opuestos. */
  readonly spans: 'h' | 'v' | null;
  readonly hasBlock2x2: boolean;
  /** Puentes cuyas dos vecinas del río están en el mismo eje (y solo dos). */
  readonly straightBridges: boolean;
}

/** Ríos del mapa: componentes 4-conexas de `water` + `bridge`. */
export function rivers(map: GameMap): RiverStats[] {
  const types = typesOf(map);
  return components(map, isRiver).map((cells) => {
    const set = new Set(cells);
    const cols = cells.map((i) => i % map.cols);
    const rows = cells.map((i) => Math.floor(i / map.cols));
    const h = cols.includes(0) && cols.includes(map.cols - 1);
    const v = rows.includes(0) && rows.includes(map.rows - 1);
    const block = cells.some(
      (i) =>
        i % map.cols < map.cols - 1 &&
        set.has(i + 1) &&
        set.has(i + map.cols) &&
        set.has(i + map.cols + 1),
    );
    const bridgeCells = cells.filter((i) => types[i] === 'bridge');
    const straight = bridgeCells.every((i) => {
      const n = neighbours(map, i).filter((k) => set.has(k));
      const [a, b] = n;
      if (n.length !== 2 || a === undefined || b === undefined) return false;
      return Math.abs(a - b) === 2 || Math.abs(a - b) === 2 * map.cols;
    });
    return {
      cells,
      bridges: bridgeCells.length,
      spans: v ? 'v' : h ? 'h' : null,
      hasBlock2x2: block,
      straightBridges: straight,
    };
  });
}

/** Celdas de la zona de inicio que no son hierba. */
export function blockedInStartZone(map: GameMap): number {
  let n = 0;
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (!map.rules.inStartZone(c, r)) continue;
      const type = map.typeAt(c, r);
      if (type !== 'grass' && !(type === 'castle' && inFootprint(map, c, r))) n++;
    }
  }
  return n;
}

/** ¿Está la celda (c, r) en la huella del castillo del mapa? */
export function inFootprint(map: GameMap, c: number, r: number): boolean {
  const f = map.castle;
  return f !== null && c >= f.firstCol && c <= f.lastCol && r >= f.firstRow && r <= f.lastRow;
}

/** Celdas `castle` del mapa como `'c,r'`, en orden de filas. */
export function castleCells(map: GameMap): string[] {
  const out: string[] = [];
  typesOf(map).forEach((t, i) => {
    if (t === 'castle') out.push(`${String(i % map.cols)},${String(Math.floor(i / map.cols))}`);
  });
  return out;
}

/** Celdas de un rectángulo de columnas c0..c1 y filas r0..r1 como `'c,r'`, en orden de filas. */
export function blockCells(c0: number, c1: number, r0: number, r1: number): string[] {
  const out: string[] = [];
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) out.push(`${String(c)},${String(r)}`);
  return out;
}

/** Huella del castillo del contenido por defecto: columnas 14–18 y filas 6–9 (20 celdas). */
export const FOOTPRINT_CELLS: readonly string[] = blockCells(14, 18, 6, 9);

/** Celdas `trunk` en la vecindad 3 × 3 de algún puente. */
export function trunksNextToBridges(map: GameMap): number {
  const types = typesOf(map);
  let n = 0;
  types.forEach((t, i) => {
    if (t !== 'bridge') return;
    const c = i % map.cols;
    const r = (i - c) / map.cols;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const cc = c + dc;
        const rr = r + dr;
        if (
          cc >= 0 &&
          rr >= 0 &&
          cc < map.cols &&
          rr < map.rows &&
          map.typeAt(cc, rr) === 'trunk'
        ) {
          n++;
        }
      }
    }
  });
  return n;
}
