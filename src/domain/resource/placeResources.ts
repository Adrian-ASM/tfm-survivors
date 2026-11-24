import { candidateCells, cellCenter } from '../map/candidateCells';
import type { GameMap } from '../map/GameMap';
import type { RandomGenerator } from '../shared/RandomGenerator';
import type { StructureSite } from '../structure/StructureSite';
import type { ResourceRules } from './ResourceRules';
import type { ResourceSites } from './resolveResources';

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
  const base = candidateCells(map, sites, rules.placement);
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
  const points = placed.map((i) => cellCenter(map, i));
  const veins = points.slice(0, rules.goldVeins.count);
  return { veins, woodPiles: points.slice(veins.length) };
}
