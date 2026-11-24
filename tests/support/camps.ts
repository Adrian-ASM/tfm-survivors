import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { MAP_STREAM, STRUCT_STREAM, deriveSeed } from '../../src/infrastructure/random/deriveSeed';
import type { DeclaredStructure, TerrainSource } from '../../src/domain/map/TerrainSource';
import { aBehaviorConfig, aProbeType } from './runs';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';
import type { EnemyTypeConfig } from '../../src/domain/enemy/EnemyType';
import { buildRunRules, type RunConfig } from '../../src/domain/run/RunConfig';
import type {
  StructureTypeConfig,
  StructuresConfig,
} from '../../src/domain/structure/StructureType';
import { DEFAULT_ENEMY_TYPES, aDefaultConfig } from './builders';

/**
 * Guardia de prueba de la spec enemy-behavior (0021): velocidad 60 (1 px por tick), radio 22,
 * contacto 15, patrulla de radio 60 con detección a 200 hacia la alerta; alerta con lanzamiento a
 * 100 hacia una carga de 20 ticks (dinamita de vuelo 40, radio 48 y daño 20) y abandono a 400 hacia
 * la vuelta; espera de 60 que vuelve a la alerta; vuelta con detección a 200 y, al llegar, patrulla.
 */
export const aGuardType = (
  o: {
    readonly id?: string;
    readonly speed?: number;
    readonly health?: number;
    readonly patrolRadius?: number;
    readonly detect?: number;
    readonly lose?: number;
  } = {},
): EnemyTypeConfig => ({
  id: o.id ?? 'guard',
  speed: o.speed ?? 60,
  radius: 22,
  cost: 3,
  damage: 15,
  health: o.health ?? 1e6,
  xp: 4,
  behavior: {
    initial: 'patrol',
    states: [
      {
        name: 'patrol',
        kind: 'patrol',
        radius: o.patrolRadius ?? 60,
        detect: { distance: o.detect ?? 200, to: 'alert' },
      },
      {
        name: 'alert',
        kind: 'alert',
        exit: { distance: 100, to: 'aim' },
        lose: { distance: o.lose ?? 400, to: 'return' },
      },
      {
        name: 'aim',
        kind: 'charge',
        ticks: 20,
        to: 'reload',
        dynamite: { flightTicks: 40, radius: 48, damage: 20 },
      },
      { name: 'reload', kind: 'wait', ticks: 60, to: 'alert' },
      {
        name: 'return',
        kind: 'return',
        detect: { distance: o.detect ?? 200, to: 'alert' },
        to: 'patrol',
      },
    ],
  },
});

/**
 * `goblin-tnt-guard` del design §2.2: los stats de `goblin-tnt` y el comportamiento de guardia por
 * defecto (patrulla 120, detección 240, lanzamiento 100, abandono 360). Mientras no esté en
 * content/enemies.json (tarea 5.2), lo añaden los escenarios que lo necesitan.
 */
export const TNT_GUARD: EnemyTypeConfig = Object.freeze<EnemyTypeConfig>({
  id: 'goblin-tnt-guard',
  speed: 45,
  radius: 22,
  cost: 3,
  damage: 15,
  health: 45,
  xp: 4,
  behavior: {
    initial: 'patrol',
    states: [
      { name: 'patrol', kind: 'patrol', radius: 120, detect: { distance: 240, to: 'alert' } },
      {
        name: 'alert',
        kind: 'alert',
        exit: { distance: 100, to: 'aim' },
        lose: { distance: 360, to: 'return' },
      },
      {
        name: 'aim',
        kind: 'charge',
        ticks: 30,
        to: 'reload',
        dynamite: { flightTicks: 45, radius: 56, damage: 15 },
      },
      { name: 'reload', kind: 'wait', ticks: 90, to: 'alert' },
      { name: 'return', kind: 'return', detect: { distance: 240, to: 'alert' }, to: 'patrol' },
    ],
  },
});

/** Casa del design §2.1 (con los cambios dados). */
export const aHouseType = (o: Partial<StructureTypeConfig> = {}): StructureTypeConfig => ({
  count: 4,
  footprint: { cols: 2, rows: 3 },
  radius: 48,
  health: 60,
  guards: { type: 'goblin-tnt-guard', max: 2, everyTicks: 900 },
  ...o,
});

/** Torre del design §2.1 (con los cambios dados). */
export const aTowerType = (o: Partial<StructureTypeConfig> = {}): StructureTypeConfig => ({
  count: 3,
  footprint: { cols: 2, rows: 3 },
  radius: 48,
  health: 90,
  ...o,
});

/**
 * Estructuras del design §2.1 (valores de partida; content/structures.json en la tarea 5.1), con
 * la casa y la torre cambiadas si se pide.
 */
export const aStructuresConfig = (
  o: {
    readonly house?: Partial<StructureTypeConfig>;
    readonly tower?: Partial<StructureTypeConfig>;
    readonly placement?: Partial<StructuresConfig['placement']>;
  } = {},
): StructuresConfig => ({
  placement: {
    minStartCells: 6,
    minCastleCells: 6,
    minWaterCells: 2,
    minGapCells: 4,
    maxAttempts: 2000,
    ...o.placement,
  },
  types: { 'goblin-house': aHouseType(o.house), 'goblin-tower': aTowerType(o.tower) },
});

/** Valores de partida de las estructuras (design §2.1). */
export const DEFAULT_STRUCTURES: StructuresConfig = aStructuresConfig();

/** Generador de la colocación de la semilla, como en producción (`STRUCT_STREAM`, ADR-0020). */
export const structureRandomFor = (seed: number): Mulberry32RandomGenerator =>
  new Mulberry32RandomGenerator(deriveSeed(seed, STRUCT_STREAM));

/**
 * Mapa generado de la semilla con sus casas y torres, como lo sembrará `seededRun` (tarea 5.3):
 * celdas con `MAP_STREAM` y estructuras con `STRUCT_STREAM`.
 */
export const campTerrain = (seed: number): TerrainSource => ({
  kind: 'generated',
  random: new Mulberry32RandomGenerator(deriveSeed(seed, MAP_STREAM)),
  structureRandom: structureRandomFor(seed),
});

/** Partida de la semilla con el mapa generado y sus estructuras (azar de la partida: `seed`). */
export function startCampRun(
  config: RunConfig,
  seed: number,
  setup: RunSetup = {},
  random: RandomGenerator = new Mulberry32RandomGenerator(seed),
): Run {
  const r = Run.start(config, random, setup, campTerrain(seed));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/**
 * Reglas de partida de `aCampsConfig(structures)` con sus reglas de estructuras (o excepción, para
 * preparar escenarios).
 */
export function campRules(structures: StructuresConfig = DEFAULT_STRUCTURES) {
  const r = buildRunRules(aCampsConfig(structures));
  if (!r.ok) throw new Error(r.error.message);
  const s = r.value.structures;
  if (!s) throw new Error('sin reglas de estructuras');
  return { ...r.value, structures: s };
}

/**
 * Contenido por defecto con campamentos: los tipos de content/ más `goblin-tnt-guard` y las
 * estructuras dadas (por defecto, las del design §2.1).
 */
export const aCampsConfig = (structures: StructuresConfig = DEFAULT_STRUCTURES): RunConfig => {
  const base = aDefaultConfig();
  const types = DEFAULT_ENEMY_TYPES.some((t) => t.id === TNT_GUARD.id)
    ? DEFAULT_ENEMY_TYPES
    : [...DEFAULT_ENEMY_TYPES, TNT_GUARD];
  return { ...base, enemies: { ...base.enemies, types }, structures };
};

/** Casa de prueba de auto-weapons: radio de impacto 40 y vida 30, sin nacimientos en la partida. */
export const TEST_HOUSE: Partial<StructureTypeConfig> = Object.freeze({
  radius: 40,
  health: 30,
  guards: { type: 'guard', max: 2, everyTicks: 1e9 },
});

/** Casa declarada en columnas 20–21 y filas 10–12: centro (1.260, 690) y puerta (1.290, 810). */
export const HOUSE_AT_20_10 = Object.freeze({
  type: 'goblin-house',
  col: 20,
  row: 10,
  cols: 2,
  rows: 3,
});

/**
 * Contenido de los escenarios con estructuras explícitas (0021): `aBehaviorConfig` (mundo del
 * contenido, jugador a 210 px/s y radio 16, sin armas ni presupuesto) con `probe` y el guardia de
 * prueba (`guard`) en el catálogo, más los tipos dados, y la casa y la torre dadas (por defecto, la
 * casa de prueba y la torre por defecto).
 */
export function aCampScenario(
  o: {
    readonly types?: readonly EnemyTypeConfig[];
    readonly house?: Partial<StructureTypeConfig>;
    readonly tower?: Partial<StructureTypeConfig>;
    readonly player?: Partial<RunConfig['player']>;
    readonly segments?: RunConfig['waves']['segments'];
    readonly maxAlive?: number;
  } = {},
): RunConfig {
  const types = [aProbeType(), aGuardType(), ...(o.types ?? [])];
  const base = aBehaviorConfig(types, {
    ...(o.player ? { player: o.player } : {}),
    ...(o.segments ? { segments: o.segments } : {}),
    ...(o.maxAlive === undefined ? {} : { maxAlive: o.maxAlive }),
  });
  const house = { ...TEST_HOUSE, ...o.house };
  return {
    ...base,
    structures: aStructuresConfig({ house, ...(o.tower ? { tower: o.tower } : {}) }),
  };
}

/** Partida en el mapa vacío con las estructuras declaradas (azar de la partida: semilla 42). */
export function startDeclared(
  config: RunConfig,
  structures: readonly DeclaredStructure[],
  setup: RunSetup = {},
  random: RandomGenerator = new Mulberry32RandomGenerator(42),
): Run {
  return startOn(config, { kind: 'open', structures }, setup, random);
}

/** Partida en el mapa dado (azar de la partida: semilla 42 salvo que se pase otro). */
export function startOn(
  config: RunConfig,
  terrain: TerrainSource,
  setup: RunSetup = {},
  random: RandomGenerator = new Mulberry32RandomGenerator(42),
): Run {
  const r = Run.start(config, random, setup, terrain);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

type SetupEnemy = NonNullable<RunSetup['enemies']>[number];

/**
 * Guardia de prueba de `RunSetup` en (x, y): puesto (1.000, 1.000) salvo que se pase otro o una casa
 * (`house`), en su estado inicial salvo que se pida otro (p. ej. `inState('return')`).
 */
export const aGuardAt = (
  x: number,
  y: number,
  o: Partial<Omit<SetupEnemy, 'x' | 'y'>> = {},
): SetupEnemy => ({
  type: 'guard',
  x,
  y,
  ...(o.house === undefined ? { post: { x: 1000, y: 1000 } } : {}),
  ...o,
});
