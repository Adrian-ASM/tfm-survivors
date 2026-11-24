import { chebyshevFrom, inCastle } from '../map/chebyshev';
import type { GameMap } from '../map/GameMap';
import type { RandomGenerator } from '../shared/RandomGenerator';
import type { StructureSite } from '../structure/StructureSite';
import type { ResourceRules } from './ResourceRules';
import type { ResourcePoint, ResourceSites } from './resolveResources';

/**
 * Celdas base de la colocación (design 0022 §4): `grass`, fuera de huellas y puertas de las
 * estructuras ya colocadas y a las distancias mínimas de la zona de inicio y del castillo.
 */
function baseCells(map: GameMap, sites: readonly StructureSite[], rules: ResourceRules): number[] {
  const { cols, rows } = map;
  const { minStartCells, minCastleCells } = rules.placement;
  const toStart = chebyshevFrom(map, (c, r) => map.rules.inStartZone(c, r));
  const toCastle = chebyshevFrom(map, (c, r) => inCastle(map, c, r));
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
      if ((toStart[i] ?? 0) < minStartCells || (toCastle[i] ?? 0) < minCastleCells) continue;
      cells.push(i);
    }
  }
  return cells;
}

/** Centro de la celda `i` (de su rectángulo recortado en el borde del mundo). */
function centerOf(map: GameMap, i: number): ResourcePoint {
  const c = i % map.cols;
  const rect = map.cellRect(c, (i - c) / map.cols);
  return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
}

/**
 * Vetas y montones de un mapa generado (design 0022 §4, ADR-0021), función pura del mapa, de sus
 * estructuras, de las reglas y de su propio generador: primero las `goldVeins.count` vetas y luego
 * los `woodPiles.count` montones; cada uno en una celda candidata (en orden de filas: las base a
 * distancia de Chebyshev ≥ `minGapCells`, y nunca la misma, de los ya colocados), elegida con
 * exactamente 1 valor del generador (`⌊next · candidatas⌋`). Sin candidatas, se dejan de colocar
 * recursos (mejor esfuerzo, sin error). El orden y el criterio son contrato de determinismo.
 */
export function placeResources(
  map: GameMap,
  sites: readonly StructureSite[],
  rules: ResourceRules,
  random: RandomGenerator,
): ResourceSites {
  const base = baseCells(map, sites, rules);
  const gap = Math.max(1, rules.placement.minGapCells);
  const { cols } = map;
  const placed: number[] = [];
  const total = rules.goldVeins.count + rules.woodPiles.count;
  const free = (i: number): boolean => {
    const c = i % cols;
    const r = (i - c) / cols;
    for (const j of placed) {
      const cj = j % cols;
      const rj = (j - cj) / cols;
      if (Math.max(Math.abs(c - cj), Math.abs(r - rj)) < gap) return false;
    }
    return true;
  };
  while (placed.length < total) {
    const candidates = base.filter(free);
    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(random.next() * candidates.length)];
    if (pick === undefined) break;
    placed.push(pick);
  }
  const points = placed.map((i) => centerOf(map, i));
  const veins = points.slice(0, rules.goldVeins.count);
  return { veins, woodPiles: points.slice(veins.length) };
}
