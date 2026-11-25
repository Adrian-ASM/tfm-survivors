import type { GameMap } from '../map/GameMap';
import type { DeclaredSite, TerrainSource } from '../map/TerrainSource';
import { assertNever } from '../shared/assertNever';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { ACCESS_OFFSET_CELLS, type BuildingRules } from './BuildingRules';
import { placeSites, type PlacedBefore } from './placeSites';

export const MAP_SITE_OUTSIDE =
  'La huella y el acceso de un solar declarado deben caber en la rejilla y en el mundo';

/** ¿Caben la huella del ancla (col, row) en la rejilla y su acceso en el mundo? */
function fits(site: DeclaredSite, map: GameMap, rules: BuildingRules): boolean {
  const { col, row } = site;
  const { cols, rows } = rules.sites.footprint;
  const s = map.cellSize;
  const accessX = (col + cols / 2) * s;
  const accessY = (row + rows + ACCESS_OFFSET_CELLS) * s;
  return (
    Number.isInteger(col) &&
    Number.isInteger(row) &&
    col >= 0 &&
    row >= 0 &&
    col + cols <= map.cols &&
    row + rows <= map.rows &&
    accessX <= map.width &&
    accessY <= map.height
  );
}

/**
 * Anclas de los solares de la partida según el origen de su mapa (spec procedural-map 0026): las
 * que coloca su azar de los solares en el mapa generado (tras estructuras, recursos y ovejas), las
 * declaradas por un mapa dado (solo se comprueba que caben; si no, el error nombra
 * `map.sites.<i>`), o ninguna.
 */
export function resolveSites(
  source: TerrainSource,
  map: GameMap,
  rules: BuildingRules,
  before: PlacedBefore,
): Result<readonly DeclaredSite[], DomainError> {
  switch (source.kind) {
    case 'generated':
      return ok(placeSites(map, before, rules, source.siteRandom));
    case 'open':
    case 'cells': {
      const sites = source.sites ?? [];
      for (const [i, site] of sites.entries()) {
        if (!fits(site, map, rules)) {
          const at = `map.sites.${String(i)}`;
          return err(invalidConfig(at, `${MAP_SITE_OUTSIDE} (solar ${at})`));
        }
      }
      return ok(sites.map((s) => Object.freeze({ col: s.col, row: s.row })));
    }
    default:
      return assertNever(source);
  }
}
