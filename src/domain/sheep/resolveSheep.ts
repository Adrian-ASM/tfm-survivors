import type { GameMap } from '../map/GameMap';
import type { DeclaredStart, TerrainSource } from '../map/TerrainSource';
import type { RandomGenerator } from '../shared/RandomGenerator';
import { assertNever } from '../shared/assertNever';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import type { SheepRules } from './SheepRules';

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
}

const NONE: SheepSites = Object.freeze({ at: Object.freeze([]), capacity: 0, random: null });

/** ¿Es (x, y) una posición legal del círculo de radio r? La tangencia es legal. */
export function isLegalSheepAt(map: GameMap, x: number, y: number, r: number): boolean {
  const inside = x >= r && x <= map.width - r && y >= r && y <= map.height - r;
  return inside && !map.overlapsBlocked(x, y, r);
}

/**
 * Ovejas de la partida según el origen de su mapa: las declaradas por un mapa dado (cada una en una
 * posición legal, si no el error nombra `map.sheep.<i>`), sin tope, o ninguna.
 */
export function resolveSheep(
  source: TerrainSource,
  map: GameMap,
  rules: SheepRules,
): Result<SheepSites, DomainError> {
  switch (source.kind) {
    case 'generated':
      return ok(NONE);
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
      return ok({ at, capacity: at.length, random: declared.random });
    }
    default:
      return assertNever(source);
  }
}
