import { candidateCells, cellCenter } from '../map/candidateCells';
import type { GameMap } from '../map/GameMap';
import type { DeclaredStart } from '../map/TerrainSource';
import type { RandomGenerator } from '../shared/RandomGenerator';
import type { StructureSite } from '../structure/StructureSite';
import { legalCells } from './legalPosition';
import type { SheepRules } from './SheepRules';

/**
 * Celdas base de las ovejas de un mapa generado (design 0023 §4.1 y §4.2), en orden de filas:
 * `grass` fuera de huellas y puertas, a las distancias de colocación de la zona de inicio y del
 * castillo, y con el centro en una posición legal de la oveja. Son las de colocación y las de
 * reaparición. No excluyen vetas ni montones.
 */
export function sheepCells(
  map: GameMap,
  sites: readonly StructureSite[],
  rules: SheepRules,
): number[] {
  return legalCells(map, candidateCells(map, sites, rules.config.placement), rules.radius);
}

/**
 * Colocación inicial de las ovejas (spec procedural-map 0023, ADR-0022), fase 1 del azar de las
 * ovejas: hasta `maxAlive`, cada una en una celda de `base` a distancia de Chebyshev ≥
 * `max(1, minGapCells)` de las ya colocadas (nunca la misma), elegida con exactamente 1 valor
 * (`⌊next · candidatas⌋`). Sin candidatas se para (mejor esfuerzo, sin error). Posición = centro.
 */
export function placeSheep(
  base: readonly number[],
  map: GameMap,
  rules: SheepRules,
  random: RandomGenerator,
): DeclaredStart[] {
  const gap = Math.max(1, rules.config.placement.minGapCells);
  const { cols } = map;
  const placed: number[] = [];
  const free = (i: number): boolean => {
    const c = i % cols;
    const r = (i - c) / cols;
    for (const j of placed) {
      const cj = j % cols;
      if (Math.max(Math.abs(c - cj), Math.abs(r - (j - cj) / cols)) < gap) return false;
    }
    return true;
  };
  while (placed.length < rules.maxAlive) {
    const candidates = base.filter(free);
    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(random.next() * candidates.length)];
    if (pick === undefined) break;
    placed.push(pick);
  }
  return placed.map((i) => cellCenter(map, i));
}
