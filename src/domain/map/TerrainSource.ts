import type { RandomGenerator } from '../shared/RandomGenerator';
import type { DomainError, Result } from '../shared/Result';
import { ok } from '../shared/Result';
import { assertNever } from '../shared/assertNever';
import type { CellType } from './CellType';
import { GameMap } from './GameMap';
import type { MapRules } from './MapRules';
import { generateMap } from './generateMap';

/**
 * De dónde sale el mapa de una partida (ADR-0013). Es un valor, no un puerto: la composición lo
 * resuelve junto con la semilla y el dominio nunca la conoce.
 * - `open`: mapa vacío, todo hierba (escenarios sin mapa declarado y `?e2e&map=empty`).
 * - `generated`: `generateMap` con un generador propio, distinto del de la partida.
 * - `cells`: mapa dado en orden de filas (tests); solo se le exigen las dimensiones.
 */
export type TerrainSource =
  | { readonly kind: 'open' }
  | { readonly kind: 'generated'; readonly random: RandomGenerator }
  | { readonly kind: 'cells'; readonly cells: readonly CellType[] };

export const OPEN_TERRAIN: TerrainSource = Object.freeze({ kind: 'open' });

/** Mapa de la partida a partir de su origen y de las reglas del contenido. */
export function resolveTerrain(
  source: TerrainSource,
  rules: MapRules,
): Result<GameMap, DomainError> {
  switch (source.kind) {
    case 'open':
      return ok(GameMap.open(rules));
    case 'generated':
      return ok(generateMap(rules, source.random));
    case 'cells':
      return GameMap.fromCells(source.cells, rules);
    default:
      return assertNever(source);
  }
}
