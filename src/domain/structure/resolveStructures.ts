import type { GameMap } from '../map/GameMap';
import type { DeclaredStructure, TerrainSource } from '../map/TerrainSource';
import { assertNever } from '../shared/assertNever';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { placeStructures } from './placeStructures';
import type { StructureRules } from './StructureRules';
import { structureSite, type StructureSite } from './StructureSite';

export const MAP_STRUCTURE_OUT_OF_GRID =
  'Una estructura declarada debe caber en la rejilla, y una casa también con su puerta';
export const MAP_STRUCTURE_UNKNOWN = 'Tipo de estructura que el contenido no declara';

const isInt = (v: number, min: number): boolean => Number.isInteger(v) && v >= min;

/** Sitios de las estructuras declaradas por un mapa dado, en orden de declaración. */
function declared(
  entries: readonly DeclaredStructure[],
  map: GameMap,
  rules: StructureRules | null,
): Result<StructureSite[], DomainError> {
  const sites: StructureSite[] = [];
  for (const [i, d] of entries.entries()) {
    const at = `map.structures.${String(i)}`;
    const type = rules?.byId(d.type);
    if (!type) return err(invalidConfig(`${at}.type`, `${MAP_STRUCTURE_UNKNOWN}: ${d.type}`));
    const door = type.kind === 'house' ? 1 : 0;
    const fits =
      isInt(d.col, 0) &&
      isInt(d.row, 0) &&
      isInt(d.cols, 1) &&
      isInt(d.rows, 1) &&
      d.col + d.cols <= map.cols &&
      d.row + d.rows + door <= map.rows;
    if (!fits) return err(invalidConfig(at, `${MAP_STRUCTURE_OUT_OF_GRID}: ${d.type} (${at})`));
    sites.push(structureSite(i, type, d.col, d.row, d.cols, d.rows, map));
  }
  return ok(sites);
}

/**
 * Estructuras de la partida según el origen de su mapa (ADR-0020): las que coloca el generador
 * propio en un mapa generado, las declaradas en un mapa dado o ninguna. Vida y radio, del tipo.
 */
export function resolveStructures(
  source: TerrainSource,
  map: GameMap,
  rules: StructureRules | null,
): Result<readonly StructureSite[], DomainError> {
  switch (source.kind) {
    case 'generated':
      return ok(
        rules && source.structureRandom ? placeStructures(map, rules, source.structureRandom) : [],
      );
    case 'open':
    case 'cells':
      return declared(source.structures ?? [], map, rules);
    default:
      return assertNever(source);
  }
}
