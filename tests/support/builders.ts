import arenaJson from '../../content/arena.json';
import type { RunConfig, UpgradesConfig } from '../../src/domain/run/RunConfig';
import type { WeaponsConfig } from '../../src/domain/weapon/WeaponLoadout';
import type { WeaponTypeConfig } from '../../src/domain/weapon/WeaponType';
import type { UpgradeTypeConfig } from '../../src/domain/upgrade/UpgradeType';

/** Linter del contenido por defecto (spec auto-weapons): proyectil al más cercano en alcance. */
export const LINTER: WeaponTypeConfig = {
  id: 'linter',
  cooldownTicks: 30,
  damage: 6,
  targeting: { mode: 'nearest-in-range', range: 400 },
  attack: { type: 'projectile', speed: 480, radius: 4, lifetimeTicks: 60 },
};

/** Tests del contenido por defecto: pulso de área alrededor del jugador. */
export const TESTS: WeaponTypeConfig = {
  id: 'tests',
  cooldownTicks: 90,
  damage: 4,
  targeting: { mode: 'any-in-radius', radius: 90 },
  attack: { type: 'pulse', visualTicks: 8 },
};

/** Catálogo de mejoras por defecto (content/upgrades.json), en el orden de la spec. */
export const DEFAULT_UPGRADE_LIST: readonly UpgradeTypeConfig[] = [
  {
    id: 'strict-rules',
    name: 'Puntas de acero',
    description: 'Las flechas del arco hacen más daño.',
    target: { kind: 'weapon', weapon: 'linter' },
    stat: 'damage',
    perLevel: 3,
    maxLevel: 5,
  },
  {
    id: 'fast-ci',
    name: 'Tensado rápido',
    description: 'El arco dispara más a menudo.',
    target: { kind: 'weapon', weapon: 'linter' },
    stat: 'cooldownTicks',
    perLevel: -4,
    maxLevel: 5,
  },
  {
    id: 'wide-analysis',
    name: 'Ojo de halcón',
    description: 'El arco alcanza objetivos más lejanos.',
    target: { kind: 'weapon', weapon: 'linter' },
    stat: 'range',
    perLevel: 60,
    maxLevel: 5,
  },
  {
    id: 'hard-asserts',
    name: 'Filo templado',
    description: 'El tajo hace más daño.',
    target: { kind: 'weapon', weapon: 'tests' },
    stat: 'damage',
    perLevel: 2,
    maxLevel: 5,
  },
  {
    id: 'watch-mode',
    name: 'Brazo incansable',
    description: 'El tajo se lanza más a menudo.',
    target: { kind: 'weapon', weapon: 'tests' },
    stat: 'cooldownTicks',
    perLevel: -12,
    maxLevel: 5,
  },
  {
    id: 'coverage',
    name: 'Barrido amplio',
    description: 'El tajo llega más lejos a tu alrededor.',
    target: { kind: 'weapon', weapon: 'tests' },
    stat: 'radius',
    perLevel: 15,
    maxLevel: 5,
  },
  {
    id: 'guardrail',
    name: 'Cota de malla',
    description: 'Más vida máxima (y la misma cantidad de vida actual).',
    target: { kind: 'player' },
    stat: 'maxHealth',
    perLevel: 20,
    maxLevel: 5,
  },
  {
    id: 'shortcuts',
    name: 'Botas de viajero',
    description: 'Te mueves más rápido.',
    target: { kind: 'player' },
    stat: 'speed',
    perLevel: 20,
    maxLevel: 5,
  },
  {
    id: 'context-window',
    name: 'Amuleto del saqueador',
    description: 'Atraes las gemas desde más lejos.',
    target: { kind: 'player' },
    stat: 'pickupRadius',
    perLevel: 32,
    maxLevel: 5,
  },
];

/** Contenido de mejoras por defecto (content/upgrades.json). */
export const DEFAULT_UPGRADES: UpgradesConfig = { upgrades: DEFAULT_UPGRADE_LIST };

/**
 * Sin mejoras: válido en el dominio (no en el fichero). Por defecto en `aRunConfig`, así que los
 * escenarios de 0001–0004 no se pausan: las subidas se registran sin oferta.
 */
export const NO_UPGRADES: UpgradesConfig = { upgrades: [] };

/** Curva y gemas por defecto (content/progression.json). */
export const DEFAULT_PROGRESSION: RunConfig['progression'] = {
  baseXp: 5,
  xpGrowth: 5,
  gemRadius: 5,
  magnetSpeed: 360,
  maxGems: 300,
};

/** Mejora de la lista por defecto por id, con cambios (para casos inválidos o de límite). */
export const anUpgrade = (
  id: string,
  patch: Partial<UpgradeTypeConfig> = {},
): UpgradeTypeConfig => {
  const base = DEFAULT_UPGRADE_LIST.find((u) => u.id === id);
  if (!base) throw new Error(`mejora desconocida: ${id}`);
  return { ...base, ...patch };
};

/** Contenido de armas por defecto (content/weapons.json). */
export const DEFAULT_WEAPONS: WeaponsConfig = {
  maxProjectiles: 32,
  hitFlashTicks: 4,
  weapons: [LINTER, TESTS],
};

/**
 * Sin armas: válido en el dominio (no en el fichero). Por defecto en `aRunConfig` para que los
 * escenarios de 0001–0003 sigan aislados de las armas.
 */
export const NO_WEAPONS: WeaponsConfig = { maxProjectiles: 32, hitFlashTicks: 4, weapons: [] };

/** Tipos de enemigo de la spec (goblin-torch, goblin-tnt, goblin-barrel) con los valores del design. */
export const DEFAULT_ENEMY_TYPES = [
  { id: 'goblin-torch', speed: 90, radius: 10, cost: 1, damage: 5, health: 10, xp: 1 },
  { id: 'goblin-tnt', speed: 45, radius: 22, cost: 3, damage: 15, health: 45, xp: 4 },
  { id: 'goblin-barrel', speed: 70, radius: 16, cost: 2, damage: 8, health: 20, xp: 2 },
] as const;

const ALL = ['goblin-torch', 'goblin-barrel', 'goblin-tnt'];

/**
 * Tabla de oleadas y parámetros de spawn (espejo de content/waves.json). Desde 0010, los tramos de
 * 300 y 480 s están calibrados con el bot de referencia sobre las semillas 1..50.
 */
export const DEFAULT_WAVES: RunConfig['waves'] = {
  maxAlive: 200,
  maxBudget: 10,
  spawn: { margin: 32, minDistance: 200, maxAttempts: 8 },
  segments: [
    { fromSecond: 0, budgetPerSecond: 1, types: ['goblin-torch'] },
    { fromSecond: 60, budgetPerSecond: 2, types: ['goblin-torch', 'goblin-barrel'] },
    { fromSecond: 180, budgetPerSecond: 2.5, types: ALL },
    { fromSecond: 300, budgetPerSecond: 4, types: ALL },
    { fromSecond: 480, budgetPerSecond: 5.6, types: ALL },
  ],
};

/**
 * Vida del jugador para pruebas que miden el spawn y no el daño (long-run, bench): finita y válida,
 * pero inalcanzable en las duraciones de los tests.
 */
export const LONG_RUN_HEALTH = 1e9;

/** Duración objetivo por defecto (content/run.json): 600 s = 36.000 ticks. */
export const DEFAULT_RUN: RunConfig['run'] = { durationSeconds: 600 };

type PlayerConfig = RunConfig['player'];

/**
 * Radio de recogida de content/player.json: 128 (64 en el design original; lo subió el usuario tras
 * la medición del punto de control 0.3 para cumplir la primera oferta ≤ 3.600 ticks).
 */
export const DEFAULT_PICKUP_RADIUS = 128;

/**
 * Geometría de los escenarios unitarios (arena 960 × 540 igual a la vista), NO el mundo del juego:
 * los escenarios de `aRunConfig` (posiciones 480, 270, 944…) están escritos sobre ella. El mundo
 * del contenido por defecto vive en content/arena.json y lo toma `aDefaultConfig` (0013, D6).
 */
export const SCENARIO_ARENA: RunConfig['arena'] = {
  width: 960,
  height: 540,
  view: { width: 960, height: 540 },
};

/** Mundo y vista del contenido por defecto, leídos de content/arena.json (una sola fuente). */
const CONTENT_ARENA: RunConfig['arena'] = {
  width: arenaJson.width,
  height: arenaJson.height,
  view: { width: arenaJson.view.width, height: arenaJson.view.height },
};

/**
 * Contenido de partida de la spec (arena de escenario 960 × 540, radio 16, velocidad 200 px/s, vida 100,
 * invulnerabilidad de 30 ticks y radio de recogida 64). El 64 es la geometría fija con la que están
 * escritos los escenarios del imán (p. ej. "Límite exacto del radio", "Más radio de recogida" = 96),
 * no el valor del contenido: el contenido por defecto usa `DEFAULT_PICKUP_RADIUS` (ver `aDefaultConfig`).
 */
export const aRunConfig = (overrides: Partial<PlayerConfig> = {}): RunConfig => ({
  arena: SCENARIO_ARENA,
  player: {
    speed: overrides.speed ?? 200,
    radius: overrides.radius ?? 16,
    maxHealth: overrides.maxHealth ?? 100,
    invulnerabilityTicks: overrides.invulnerabilityTicks ?? 30,
    pickupRadius: overrides.pickupRadius ?? 64,
  },
  enemies: { types: DEFAULT_ENEMY_TYPES },
  waves: DEFAULT_WAVES,
  weapons: NO_WEAPONS,
  progression: DEFAULT_PROGRESSION,
  upgrades: NO_UPGRADES,
  run: DEFAULT_RUN,
});

/** El mismo contenido con otra duración objetivo en segundos (p. ej. 2 ⇒ 120 ticks). */
export const withDuration = (config: RunConfig, durationSeconds: number): RunConfig => ({
  ...config,
  run: { durationSeconds },
});

/** El mismo contenido con otras armas (p. ej. `withWeapons(aRunConfig(), DEFAULT_WEAPONS)`). */
export const withWeapons = (config: RunConfig, weapons: WeaponsConfig): RunConfig => ({
  ...config,
  weapons,
});

/** El mismo contenido con otras mejoras (p. ej. `withUpgrades(config, DEFAULT_UPGRADES)`). */
export const withUpgrades = (config: RunConfig, upgrades: UpgradesConfig): RunConfig => ({
  ...config,
  upgrades,
});

/** Contenido por defecto completo: armas y mejoras de content/ (lo que carga el juego). */
export const aDefaultConfig = (): RunConfig =>
  withUpgrades(
    withWeapons(
      { ...aRunConfig({ pickupRadius: DEFAULT_PICKUP_RADIUS }), arena: CONTENT_ARENA },
      DEFAULT_WEAPONS,
    ),
    DEFAULT_UPGRADES,
  );

type Waves = RunConfig['waves'];
type EnemyTypes = RunConfig['enemies']['types'];

/** Contenido por defecto con la tabla de oleadas, el spawn o el catálogo sustituidos. */
export const aWavesConfig = (
  overrides: Partial<Omit<Waves, 'spawn'>> & {
    spawn?: Partial<Waves['spawn']>;
    types?: EnemyTypes;
  } = {},
): RunConfig => {
  const { spawn, types, ...waves } = overrides;
  const base = aRunConfig();
  return {
    ...base,
    enemies: { types: types ?? base.enemies.types },
    waves: { ...base.waves, ...waves, spawn: { ...base.waves.spawn, ...spawn } },
  };
};

/** El mismo contenido con el jugador cambiado (p. ej. `{ maxHealth: LONG_RUN_HEALTH }`). */
export const withPlayer = (config: RunConfig, player: Partial<PlayerConfig>): RunConfig => ({
  ...config,
  player: { ...config.player, ...player },
});

/** Tramo único desde 0 s con los tipos y el presupuesto dados. */
export const aSegment = (
  types: readonly string[],
  budgetPerSecond: number,
  fromSecond = 0,
): Waves['segments'][number] => ({ fromSecond, budgetPerSecond, types });

interface MutableType {
  id: string;
  speed: number;
  radius: number;
  cost: number;
  damage: number;
  health: number;
  xp: number;
}
interface MutableSegment {
  fromSecond: number;
  budgetPerSecond: number;
  types: string[];
}
interface MutableWeapon {
  id: string;
  cooldownTicks: number;
  damage: number;
  targeting: Record<string, unknown>;
  attack: Record<string, unknown>;
}
interface MutableUpgrade {
  id: string;
  name: string;
  description: string;
  target: Record<string, unknown>;
  stat: string;
  perLevel: number;
  maxLevel: number;
}
/**
 * Contenido crudo con la forma de los 8 ficheros de content/, mutable para preparar casos
 * inválidos.
 */
export interface RawContent {
  player: {
    speed: number;
    radius: number;
    maxHealth: number;
    invulnerabilityTicks: number;
    pickupRadius: number;
  };
  arena: { width: number; height: number; view: { width: number; height: number } };
  enemies: { types: [MutableType, MutableType, MutableType] };
  waves: {
    maxAlive: number;
    maxBudget: number;
    spawn: { margin: number; minDistance: number; maxAttempts: number };
    segments: [MutableSegment, MutableSegment, ...MutableSegment[]];
  };
  weapons: {
    maxProjectiles: number;
    hitFlashTicks: number;
    weapons: [MutableWeapon, MutableWeapon];
  };
  progression: {
    baseXp: number;
    xpGrowth: number;
    gemRadius: number;
    magnetSpeed: number;
    maxGems: number;
  };
  upgrades: { upgrades: [MutableUpgrade, MutableUpgrade, ...MutableUpgrade[]] };
  run: { durationSeconds: number };
}

/** Copia nueva del contenido por defecto en forma de ficheros (cada llamada es independiente). */
export const rawContent = (): RawContent =>
  structuredClone(aDefaultConfig()) as unknown as RawContent;

export const TICK_MS = 1000 / 60;
