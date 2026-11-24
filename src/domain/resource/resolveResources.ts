import type { GameMap } from '../map/GameMap';
import type { DeclaredStart, TerrainSource } from '../map/TerrainSource';
import { assertNever } from '../shared/assertNever';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import type { StructureSite } from '../structure/StructureSite';
import { placeResources } from './placeResources';
import type { ResourceRules } from './ResourceRules';

export const MAP_RESOURCE_OUT_OF_WORLD =
  'Una veta o un montón de madera declarado debe estar dentro del mundo';

/** Posición de una veta o de un montón (centro de su celda en el mapa generado). */
export interface ResourcePoint {
  readonly x: number;
  readonly y: number;
}

/** Vetas y montones de la partida, cada lista en su orden de colocación o de declaración. */
export interface ResourceSites {
  readonly veins: readonly ResourcePoint[];
  readonly woodPiles: readonly ResourcePoint[];
}

/** Copia de los puntos declarados, o el primero fuera del mundo como error que lo nombra. */
function declared(
  points: readonly DeclaredStart[] | undefined,
  map: GameMap,
  list: 'veins' | 'woodPiles',
): Result<ResourcePoint[], DomainError> {
  const out: ResourcePoint[] = [];
  for (const [i, p] of (points ?? []).entries()) {
    const inside = p.x >= 0 && p.x <= map.width && p.y >= 0 && p.y <= map.height;
    if (!inside) {
      const at = `map.resources.${list}.${String(i)}`;
      return err(invalidConfig(at, `${MAP_RESOURCE_OUT_OF_WORLD} (${at})`));
    }
    out.push({ x: p.x, y: p.y });
  }
  return ok(out);
}

/**
 * Vetas y montones de la partida según el origen de su mapa (spec procedural-map 0022, ADR-0021):
 * los que coloca el generador propio en un mapa generado (tras sus estructuras), los declarados en
 * un mapa dado (cada uno dentro del mundo) o ninguno.
 */
export function resolveResources(
  source: TerrainSource,
  map: GameMap,
  rules: ResourceRules,
  sites: readonly StructureSite[],
): Result<ResourceSites, DomainError> {
  switch (source.kind) {
    case 'generated':
      return ok(placeResources(map, sites, rules, source.resourceRandom));
    case 'open':
    case 'cells': {
      const veins = declared(source.resources?.veins, map, 'veins');
      if (!veins.ok) return veins;
      const woodPiles = declared(source.resources?.woodPiles, map, 'woodPiles');
      if (!woodPiles.ok) return woodPiles;
      return ok({ veins: veins.value, woodPiles: woodPiles.value });
    }
    default:
      return assertNever(source);
  }
}
