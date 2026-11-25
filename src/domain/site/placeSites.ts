import { chebyshevFrom, FAR, inCastle } from '../map/chebyshev';
import { distancesFrom } from '../map/connectivity';
import type { GameMap } from '../map/GameMap';
import type { DeclaredSite } from '../map/TerrainSource';
import type { RandomGenerator } from '../shared/RandomGenerator';
import type { StructureSite } from '../structure/StructureSite';
import type { BuildingRules } from './BuildingRules';

/** Punto del mundo. */
interface Point {
  readonly x: number;
  readonly y: number;
}

/** Lo ya colocado en el mapa antes que los solares (estructuras, recursos y ovejas iniciales). */
export interface PlacedBefore {
  readonly structures: readonly StructureSite[];
  readonly veins: readonly Point[];
  readonly woodPiles: readonly Point[];
  readonly sheep: readonly Point[];
}

/** Celda del acceso de un solar con ancla (c, r): columna del centro, fila r + rows + 1. */
export const accessCellOf = (
  c: number,
  r: number,
  cols: number,
  rows: number,
): [number, number] => [c + Math.floor(cols / 2), r + rows + 1];

/** Máscara de las celdas ocupadas por lo colocado antes (huellas y puertas, vetas, montones, ovejas). */
function takenCells(map: GameMap, before: PlacedBefore): Uint8Array {
  const { cols } = map;
  const taken = new Uint8Array(cols * map.rows);
  const mark = (p: Point) => (taken[map.rowAt(p.y) * cols + map.colAt(p.x)] = 1);
  for (const s of before.structures) {
    for (let r = s.row; r < s.row + s.rows; r++) {
      for (let c = s.col; c < s.col + s.cols; c++) taken[r * cols + c] = 1;
    }
    if (s.door) taken[s.door.row * cols + s.door.col] = 1;
  }
  [...before.veins, ...before.woodPiles, ...before.sheep].forEach(mark);
  return taken;
}

/** Distancia de ruta (pasos 4-vecinos sobre el terreno) desde la celda de la puerta, o `null`. */
function routeField(map: GameMap): Int32Array | null {
  const { door } = map;
  if (!door) return null;
  const n = map.cols * map.rows;
  const dist = new Int32Array(n);
  const start = map.rowAt(door.y) * map.cols + map.colAt(door.x);
  distancesFrom(map.liveCodes, map.cols, map.rows, start, dist, new Int32Array(n));
  return dist;
}

/**
 * Anclas candidatas en orden de filas (design 0026 §3, reglas 1–3): toda la zona (huella, anillo de
 * 1 celda y fila de acceso) en la rejilla, `grass` y libre de lo colocado antes; la huella y la
 * celda del acceso a las distancias de Chebyshev del contenido del agua y los puentes, del
 * castillo, de la zona de inicio y de las estructuras (huella y puerta); acceso dentro del mundo y
 * distancia de ruta hasta la puerta en [min, max] (sin puerta, no aplica).
 */
function candidateAnchors(map: GameMap, before: PlacedBefore, rules: BuildingRules): number[] {
  const p = rules.sites;
  const { cols: fc, rows: fr } = p.footprint;
  const { cols, rows } = map;
  const taken = takenCells(map, before);
  const toWater = chebyshevFrom(map, (c, r) => {
    const t = map.typeAt(c, r);
    return t === 'water' || t === 'bridge';
  });
  const toCastle = chebyshevFrom(map, (c, r) => inCastle(map, c, r));
  const toStart = chebyshevFrom(map, (c, r) => map.rules.inStartZone(c, r));
  const structureCells = new Uint8Array(cols * rows);
  for (const s of before.structures) {
    for (let r = s.row; r < s.row + s.rows; r++) {
      for (let c = s.col; c < s.col + s.cols; c++) structureCells[r * cols + c] = 1;
    }
    if (s.door) structureCells[s.door.row * cols + s.door.col] = 1;
  }
  const toStructure = chebyshevFrom(map, (c, r) => structureCells[r * cols + c] === 1);
  const route = routeField(map);
  const free = (c: number, r: number) =>
    c >= 0 &&
    r >= 0 &&
    c < cols &&
    r < rows &&
    map.typeAt(c, r) === 'grass' &&
    taken[r * cols + c] !== 1;
  const far = (i: number) =>
    (toWater[i] ?? FAR) >= p.minWaterCells &&
    (toCastle[i] ?? FAR) >= p.minCastleCells &&
    (toStart[i] ?? FAR) >= p.minStartCells &&
    (toStructure[i] ?? FAR) >= p.minStructureCells;
  const out: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!zoneIsFree(c, r, fc, fr, free)) continue;
      const [ac, ar] = accessCellOf(c, r, fc, fr);
      const access = ar * cols + ac;
      let ok = far(access);
      for (let rr = r; ok && rr < r + fr; rr++) {
        for (let cc = c; ok && cc < c + fc; cc++) ok = far(rr * cols + cc);
      }
      if (!ok || (r + fr + 1 + ACCESS_HALF) * map.cellSize > map.height) continue;
      if (route) {
        const d = route[access] ?? -1;
        if (d < p.route.min || d > p.route.max) continue;
      }
      out.push(r * cols + c);
    }
  }
  return out;
}

/** Media celda: el acceso está en el centro de su fila. */
const ACCESS_HALF = 0.5;

/** Huella, anillo de 1 celda y fila de acceso (bajo la huella, tras la fila del anillo) libres. */
function zoneIsFree(
  c: number,
  r: number,
  fc: number,
  fr: number,
  free: (c: number, r: number) => boolean,
): boolean {
  for (let rr = r - 1; rr <= r + fr; rr++) {
    for (let cc = c - 1; cc <= c + fc; cc++) if (!free(cc, rr)) return false;
  }
  for (let cc = c; cc < c + fc; cc++) if (!free(cc, r + fr + 1)) return false;
  return true;
}

/**
 * Solares de un mapa generado (design 0026 §3), función pura del mapa, de lo colocado antes, de las
 * reglas y de su propio generador (`SITE_STREAM` 7): hasta `sites.count` anclas, cada una entre las
 * candidatas (en orden de filas) cuya huella está a Chebyshev ≥ `minGapCells` de las ya colocadas,
 * elegida con exactamente 1 valor del generador (`⌊next · candidatas⌋`). Sin candidatas, se dejan
 * de colocar (mejor esfuerzo, sin error). No cambia ninguna celda. Orden y criterio son contrato de
 * determinismo.
 */
export function placeSites(
  map: GameMap,
  before: PlacedBefore,
  rules: BuildingRules,
  random: RandomGenerator,
): DeclaredSite[] {
  const p = rules.sites;
  if (p.count === 0) return [];
  const { cols } = map;
  const { cols: fc, rows: fr } = p.footprint;
  const base = candidateAnchors(map, before, rules);
  const placed: DeclaredSite[] = [];
  const apart = (i: number): boolean => {
    const c = i % cols;
    const r = (i - c) / cols;
    return placed.every((s) => {
      const dx = Math.max(0, Math.abs(c - s.col) - (fc - 1));
      const dy = Math.max(0, Math.abs(r - s.row) - (fr - 1));
      return Math.max(dx, dy) >= p.minGapCells;
    });
  };
  while (placed.length < p.count) {
    const candidates = base.filter(apart);
    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(random.next() * candidates.length)];
    if (pick === undefined) break;
    const c = pick % cols;
    placed.push(Object.freeze({ col: c, row: (pick - c) / cols }));
  }
  return placed;
}
