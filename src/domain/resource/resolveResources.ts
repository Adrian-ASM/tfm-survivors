import type { DeclaredStart, TerrainSource } from '../map/TerrainSource';
import { assertNever } from '../shared/assertNever';
import { ok, type DomainError, type Result } from '../shared/Result';

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

const copy = (points: readonly DeclaredStart[] | undefined): ResourcePoint[] =>
  (points ?? []).map((p) => ({ x: p.x, y: p.y }));

/**
 * Vetas y montones de la partida según el origen de su mapa (spec procedural-map 0022): los
 * declarados en un mapa dado; ninguno en el mapa vacío sin declaración.
 */
export function resolveResources(source: TerrainSource): Result<ResourceSites, DomainError> {
  switch (source.kind) {
    case 'generated':
      return ok({ veins: [], woodPiles: [] });
    case 'open':
    case 'cells':
      return ok({
        veins: copy(source.resources?.veins),
        woodPiles: copy(source.resources?.woodPiles),
      });
    default:
      return assertNever(source);
  }
}
