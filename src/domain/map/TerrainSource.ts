import type { RandomGenerator } from '../shared/RandomGenerator';
import type { DomainError, Result } from '../shared/Result';
import { err, invalidConfig, ok } from '../shared/Result';
import { assertNever } from '../shared/assertNever';
import type { CellType } from './CellType';
import { GameMap } from './GameMap';
import type { MapRules } from './MapRules';
import { generateMap } from './generateMap';

export const MAP_START_ILLEGAL =
  'El punto de salida declarado no es una posición legal del jugador en ese mapa.';

/** Punto de salida declarado por un mapa dado (spec procedural-map 0016). */
export interface DeclaredStart {
  readonly x: number;
  readonly y: number;
}

/**
 * Estructura declarada por un mapa dado (spec procedural-map 0021): tipo de contenido y huella
 * completa (primera columna y fila, columnas y filas), sin reglas de colocación.
 */
export interface DeclaredStructure {
  readonly type: string;
  readonly col: number;
  readonly row: number;
  readonly cols: number;
  readonly rows: number;
}

/**
 * Vetas y montones de madera declarados por un mapa dado (spec procedural-map 0022): posiciones en
 * px, en orden, sin reglas de colocación; el valor es el del contenido.
 */
export interface DeclaredResources {
  readonly veins?: readonly DeclaredStart[];
  readonly woodPiles?: readonly DeclaredStart[];
}

/**
 * Ovejas declaradas por un mapa dado (spec procedural-map 0023): posiciones en px, en el orden de la
 * lista de ovejas, sin reglas de colocación ni tope, y el azar de las ovejas que usa la partida
 * (paseos y reapariciones; ADR-0022). Cada posición debe ser legal para el círculo de la oveja.
 */
export interface DeclaredSheep {
  readonly at: readonly DeclaredStart[];
  readonly random: RandomGenerator;
}

/**
 * De dónde sale el mapa de una partida (ADR-0013). Es un valor, no un puerto: la composición lo
 * resuelve junto con la semilla y el dominio nunca la conoce.
 * - `open`: mapa vacío, todo hierba (escenarios sin mapa declarado y `?e2e&map=empty`).
 * - `generated`: `generateMap` con un generador propio, distinto del de la partida, y casas y
 *   torres con otro (`structureRandom`, ADR-0020), y vetas y montones con otro (`resourceRandom`,
 *   ADR-0021).
 * - `cells`: mapa dado en orden de filas (tests); solo se le exigen las dimensiones.
 * `open` y `cells` pueden declarar su salida (`start`); sin ella, el centro del mundo. También sus
 * estructuras (`structures`), sus vetas y montones (`resources`) y sus ovejas (`sheep`); sin ellos,
 * ninguno.
 */
export type TerrainSource =
  | {
      readonly kind: 'open';
      readonly start?: DeclaredStart;
      readonly structures?: readonly DeclaredStructure[];
      readonly resources?: DeclaredResources;
      readonly sheep?: DeclaredSheep;
    }
  | {
      readonly kind: 'generated';
      readonly random: RandomGenerator;
      readonly structureRandom: RandomGenerator;
      /** Vetas y montones (ADR-0021), con su propio flujo. */
      readonly resourceRandom: RandomGenerator;
    }
  | {
      readonly kind: 'cells';
      readonly cells: readonly CellType[];
      readonly start?: DeclaredStart;
      readonly structures?: readonly DeclaredStructure[];
      readonly resources?: DeclaredResources;
      readonly sheep?: DeclaredSheep;
    };

export const OPEN_TERRAIN: TerrainSource = Object.freeze({ kind: 'open' });

/**
 * ¿Es legal la salida declarada? El círculo del jugador (radio de las reglas) dentro del mundo y
 * sin solapar celdas no caminables; la tangencia es legal.
 */
function checkStart(map: GameMap, declared: DeclaredStart | undefined) {
  if (!declared) return ok(map);
  const r = map.rules.playerRadius;
  const { x, y } = declared;
  const inside = x >= r && x <= map.width - r && y >= r && y <= map.height - r;
  if (!inside || map.overlapsBlocked(x, y, r)) {
    return err(invalidConfig('map.start', MAP_START_ILLEGAL));
  }
  return ok(map);
}

/** Mapa de la partida a partir de su origen y de las reglas del contenido. */
export function resolveTerrain(
  source: TerrainSource,
  rules: MapRules,
): Result<GameMap, DomainError> {
  switch (source.kind) {
    case 'open':
      return checkStart(GameMap.open(rules, source.start), source.start);
    case 'generated':
      return ok(generateMap(rules, source.random));
    case 'cells': {
      const map = GameMap.fromCells(source.cells, rules, source.start);
      return map.ok ? checkStart(map.value, source.start) : map;
    }
    default:
      return assertNever(source);
  }
}
