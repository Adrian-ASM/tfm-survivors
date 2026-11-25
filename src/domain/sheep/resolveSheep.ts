import { candidateCells } from '../map/candidateCells';
import type { GameMap } from '../map/GameMap';
import type { StructureSite } from '../structure/StructureSite';
import type { DeclaredStart, TerrainSource } from '../map/TerrainSource';
import type { RandomGenerator } from '../shared/RandomGenerator';
import { assertNever } from '../shared/assertNever';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { isLegalSheepAt, legalCells } from './legalPosition';
import { placeSheep, sheepCells } from './placeSheep';
import type { SheepRules } from './SheepRules';

/**
 * Vuelve a validar las ovejas declaradas de un mapa dado con la capa de obra ya marcada (design 0027
 * §1.3): una que solapa la huella de un solar no se recoloca; el error nombra `map.sheep.<i>`.
 */
export function revalidateDeclaredSheep(
  source: TerrainSource,
  map: GameMap,
  rules: SheepRules,
): DomainError | null {
  if (source.kind === 'generated') return null;
  for (const [i, p] of (source.sheep?.at ?? []).entries()) {
    if (isLegalSheepAt(map, p.x, p.y, rules.radius)) continue;
    const at = `map.sheep.${String(i)}`;
    return invalidConfig(at, `${MAP_SHEEP_ILLEGAL} (${at})`);
  }
  return null;
}

export const MAP_SHEEP_ILLEGAL =
  'Una oveja declarada debe estar en una posición legal de su círculo (dentro del mundo y sin ' +
  'solapar celdas no caminables)';

/** Ovejas iniciales de la partida y su azar (spec procedural-map 0023, ADR-0022). */
export interface SheepSites {
  /** Posiciones en el orden de la lista de ovejas del tick 0. */
  readonly at: readonly DeclaredStart[];
  /** Ovejas vivas como mucho: el tope del mapa generado o el número de declaradas. */
  readonly capacity: number;
  /** Azar de las ovejas (paseos y reapariciones); null si la partida no tiene ovejas. */
  readonly random: RandomGenerator | null;
  /** Celdas base de reaparición (orden de filas, centros legales para la oveja). */
  readonly respawnCells: readonly number[];
  /** Último tick del primer pasto de cada oveja (mapa generado); sin él, pasto completo. */
  readonly phaseEnds?: readonly number[];
}

const NONE: SheepSites = Object.freeze({
  at: Object.freeze([]),
  capacity: 0,
  random: null,
  respawnCells: Object.freeze([]),
});

/**
 * Primer pasto de las ovejas colocadas (fase 2 del azar de las ovejas, design 0023 §4): 1 valor
 * por oveja, en orden de lista; dura `1 + ⌊next · graze.ticks⌋` ticks desde el tick 1.
 */
function firstGrazes(count: number, rules: SheepRules, random: RandomGenerator): number[] {
  const g = rules.config.graze.ticks;
  return Array.from({ length: count }, () => 1 + Math.floor(random.next() * g));
}

/**
 * Ovejas de la partida según el origen de su mapa: en un mapa generado, las que coloca su azar de
 * las ovejas (fase 1) y su primer pasto (fase 2), con tope `maxAlive`; las declaradas por un mapa
 * dado (cada una en una posición legal, si no el error nombra `map.sheep.<i>`), sin tope, o
 * ninguna. En un mapa dado reaparecen en `grass` fuera de huellas y puertas, sin distancias
 * (design 0023 §4.2); en el generado, en las celdas de colocación.
 */
export function resolveSheep(
  source: TerrainSource,
  map: GameMap,
  rules: SheepRules,
  sites: readonly StructureSite[] = [],
): Result<SheepSites, DomainError> {
  switch (source.kind) {
    case 'generated': {
      const random = source.sheepRandom;
      const base = sheepCells(map, sites, rules);
      const at = placeSheep(base, map, rules, random);
      const phaseEnds = firstGrazes(at.length, rules, random);
      return ok({ at, capacity: rules.maxAlive, random, respawnCells: base, phaseEnds });
    }
    case 'open':
    case 'cells': {
      const declared = source.sheep;
      if (!declared || declared.at.length === 0) return ok(NONE);
      for (const [i, p] of declared.at.entries()) {
        if (!isLegalSheepAt(map, p.x, p.y, rules.radius)) {
          const at = `map.sheep.${String(i)}`;
          return err(invalidConfig(at, `${MAP_SHEEP_ILLEGAL} (${at})`));
        }
      }
      const at = declared.at.map((p) => Object.freeze({ x: p.x, y: p.y }));
      const respawnCells = legalCells(map, candidateCells(map, sites), rules.radius);
      return ok({ at, capacity: at.length, random: declared.random, respawnCells });
    }
    default:
      return assertNever(source);
  }
}
