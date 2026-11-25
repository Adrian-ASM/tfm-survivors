import type { GameMap } from '../map/GameMap';
import type { DeclaredSite, TerrainSource } from '../map/TerrainSource';
import { assertNever } from '../shared/assertNever';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import type { BuildingRules } from './BuildingRules';
import type { BuildSite } from './BuildSite';
import { placeSites, type PlacedBefore } from './placeSites';

export const MAP_SITE_OUTSIDE = 'La huella de un solar declarado debe caber en la rejilla';
export const MAP_SITE_OVERLAPS_PLAYER =
  'La huella de un solar no puede solapar al jugador en su posición inicial';

/**
 * Primer solar cuya huella solapa el círculo (x, y, r) del jugador inicial (design 0027 §1.3): la
 * tangencia (g = 0) es legal. El error nombra `map.sites.<i>`; `null` si ninguno.
 */
export function siteOverlappingPlayer(
  sites: readonly BuildSite[],
  x: number,
  y: number,
  r: number,
): DomainError | null {
  const i = sites.findIndex((s) => s.gap(x, y, r) < 0);
  if (i < 0) return null;
  const at = `map.sites.${String(i)}`;
  return invalidConfig(at, `${MAP_SITE_OVERLAPS_PLAYER} (solar ${at})`);
}

/** ¿Cabe la huella del ancla (col, row) en la rejilla? (0027: sin acceso.) */
function fits(site: DeclaredSite, map: GameMap, rules: BuildingRules): boolean {
  const { col, row } = site;
  const { cols, rows } = rules.sites.footprint;
  return (
    Number.isInteger(col) &&
    Number.isInteger(row) &&
    col >= 0 &&
    row >= 0 &&
    col + cols <= map.cols &&
    row + rows <= map.rows
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
