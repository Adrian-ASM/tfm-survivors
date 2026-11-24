import type { CellType } from '../../src/domain/map/CellType';
import type { DeclaredStart, TerrainSource } from '../../src/domain/map/TerrainSource';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot, SheepSnapshot } from '../../src/domain/run/RunSnapshot';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { SHEEP_STREAM, deriveSeed } from '../../src/infrastructure/random/deriveSeed';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import {
  NO_UPGRADES,
  NO_WEAPONS,
  TESTS,
  aDefaultConfig,
  aSegment,
  aWavesConfig,
  withDuration,
  withSheep,
  withWeapons,
} from './builders';
import { weaponsOf } from './weapons';

/** Posición por defecto de la oveja de prueba (spec sheep): celda (16, 16) del mapa vacío. */
export const SHEEP_AT = { x: 1000, y: 1000 } as const;

/** Salida del mapa vacío del contenido por defecto, donde está quieto el jugador (spec sheep). */
export const EXIT = { x: 1920, y: 1080 } as const;

/** Azar de las ovejas de un mapa declarado (design 0023 §4.3): el flujo 5 de la semilla. */
export const sheepRandom = (seed = 42): RandomGenerator =>
  new Mulberry32RandomGenerator(deriveSeed(seed, SHEEP_STREAM));

/**
 * Mapa vacío (o de celdas, con `cells`) con estas ovejas declaradas, en orden, y su azar del flujo
 * de las ovejas de `seed` (spec procedural-map, "Mapa explícito y mapa vacío").
 */
export function declaredSheep(
  at: readonly DeclaredStart[],
  options: { seed?: number; cells?: readonly CellType[]; random?: RandomGenerator } = {},
): TerrainSource {
  const sheep = { at, random: options.random ?? sheepRandom(options.seed) };
  return options.cells ? { kind: 'cells', cells: options.cells, sheep } : { kind: 'open', sheep };
}

/**
 * Contenido de los escenarios de la oveja de prueba: el mundo y los tipos por defecto con la oveja de
 * prueba (y `patch`), sin armas ni oleadas salvo que se pidan.
 */
export function aSheepConfig(
  patch: Parameters<typeof withSheep>[1] = {},
  base: RunConfig = { ...aDefaultConfig(), weapons: NO_WEAPONS, upgrades: NO_UPGRADES },
): RunConfig {
  return withSheep(
    { ...base, waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves },
    patch,
  );
}

/** Partida con ovejas declaradas en el mapa vacío (o de celdas) y el azar de la partida 42. */
export function startWithSheep(
  config: RunConfig,
  at: readonly DeclaredStart[] = [SHEEP_AT],
  setup: RunSetup = {},
  options: Parameters<typeof declaredSheep>[1] = {},
): Run {
  const r = Run.start(config, new Mulberry32RandomGenerator(42), setup, declaredSheep(at, options));
  if (!r.ok) throw new Error(`${r.error.field}: ${r.error.message}`);
  return r.value;
}

/** La oveja del snapshot por id (falla si no está). */
export function sheepById(s: RunSnapshot, id: number): SheepSnapshot {
  const o = s.sheep.find((x) => x.id === id);
  if (!o) throw new Error(`se esperaba la oveja ${String(id)}`);
  return o;
}

/** Redondeo a milésimas (error ≤ 0,001 de las specs). */
export const r3 = (v: number | undefined): number => Math.round((v ?? Number.NaN) * 1000) / 1000;

/** Posición redondeada de la primera oveja del snapshot. */
export const firstAt = (s: RunSnapshot | undefined): [number, number] => [
  r3(s?.sheep[0]?.x),
  r3(s?.sheep[0]?.y),
];

/**
 * Partida terminada (victoria en el tick 60) en la que han muerto 6 ovejas y se han recogido 3
 * piezas de carne (spec sheep, "Resultados sin ovejas"): un pulso de Tests mata en el tick 1 a 6
 * ovejas de vida 4; la carne de las 3 pegadas al jugador se recoge y la de las otras 3 queda en el
 * suelo (radio de recogida 1). Devuelve el snapshot del tick 1 y el final.
 */
export function sheepFeast(): { first: RunSnapshot; final: RunSnapshot } {
  const base = withDuration(
    withWeapons(aSheepConfig(), weaponsOf([TESTS])),
    1,
  );
  const config = { ...base, player: { ...base.player, pickupRadius: 1 } };
  const near = [-5, 0, 5].map((d) => ({ x: 1000 + d, y: 1005 }));
  const far = [-60, 0, 60].map((d) => ({ x: 1000 + d, y: 1060 }));
  const run = startWithSheep(config, [...near, ...far], {
    player: { ...SHEEP_AT, health: 50 },
    sheep: Array.from({ length: 6 }, () => ({ health: 4 })),
  });
  run.tick(PlayerInput.NONE);
  const first = run.snapshot();
  while (run.status === 'running') run.tick(PlayerInput.NONE);
  return { first, final: run.snapshot() };
}
