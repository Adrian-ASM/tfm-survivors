import arenaJson from '../../content/arena.json';
import mapJson from '../../content/map.json';
import playerJson from '../../content/player.json';
import wavesJson from '../../content/waves.json';
import enemiesJson from '../../content/enemies.json';
import progressionJson from '../../content/progression.json';
import upgradesJson from '../../content/upgrades.json';
import type { EnemyTypeConfig } from '../../src/domain/enemy/EnemyType';
import type { RunConfig, UpgradesConfig } from '../../src/domain/run/RunConfig';
import type { WeaponsConfig } from '../../src/domain/weapon/WeaponLoadout';
import type { WeaponTypeConfig } from '../../src/domain/weapon/WeaponType';
import type { UpgradeTypeConfig } from '../../src/domain/upgrade/UpgradeType';

/** Copia profunda congelada de un valor de content/ (los tests no pueden alterar el JSON). */
function frozen<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (v: unknown): void => {
    if (typeof v !== 'object' || v === null) return;
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  };
  freeze(copy);
  return copy;
}

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

/**
 * Catálogo de mejoras por defecto, leído de content/upgrades.json (una sola fuente para la
 * calibración, 0019); el esquema zod lo valida en `loadRunConfig` y builders-content.test lo
 * compara con lo cargado.
 */
export const DEFAULT_UPGRADE_LIST: readonly UpgradeTypeConfig[] = frozen(
  upgradesJson.upgrades as UpgradeTypeConfig[],
);

/** Contenido de mejoras por defecto (content/upgrades.json). */
export const DEFAULT_UPGRADES: UpgradesConfig = { upgrades: DEFAULT_UPGRADE_LIST };

/**
 * Sin mejoras: válido en el dominio (no en el fichero). Por defecto en `aRunConfig`, así que los
 * escenarios de 0001–0004 no se pausan: las subidas se registran sin oferta.
 */
export const NO_UPGRADES: UpgradesConfig = { upgrades: [] };

/** Curva y gemas por defecto, leídas de content/progression.json (0019). */
export const DEFAULT_PROGRESSION: RunConfig['progression'] = frozen(progressionJson);

/**
 * Curva de escenario (spec leveling 0019): baseXp 5 y xpGrowth 5, la anterior por defecto, con las
 * gemas por defecto. La usan los escenarios de `aRunConfig` con cifras de XP; el contenido por defecto
 * (`aDefaultConfig`) usa la de content/.
 */
export const SCENARIO_PROGRESSION: RunConfig['progression'] = Object.freeze({
  ...DEFAULT_PROGRESSION,
  baseXp: 5,
  xpGrowth: 5,
});

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

/** Tipos de enemigo por defecto (torch, tnt, barrel), leídos de content/enemies.json (0019). */
export const DEFAULT_ENEMY_TYPES: readonly EnemyTypeConfig[] = frozen(enemiesJson.types);

/**
 * Tabla de oleadas y parámetros de spawn, leídos de content/waves.json (una sola fuente: el radio
 * del anillo y la tabla calibrada viven solo en `content/`, spec run-outcome 0017).
 */
export const DEFAULT_WAVES: RunConfig['waves'] = structuredClone(wavesJson);

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
};

/**
 * Parámetros del mapa del contenido por defecto, leídos de content/map.json (una sola fuente,
 * spec run-outcome "Contenido de los tests igual al del juego"). También en `aRunConfig`: los
 * escenarios sin mapa declarado juegan con el mapa vacío, que solo necesita la rejilla.
 */
export const DEFAULT_MAP: RunConfig['map'] = structuredClone(mapJson);

/** Tope de vista del contenido por defecto (presentación, no llega al núcleo; 0017). */
export const DEFAULT_MAX_VIEW = { ...arenaJson.maxView } as const;

/** Mundo del contenido por defecto, leído de content/arena.json (una sola fuente). */
const CONTENT_ARENA: RunConfig['arena'] = { width: arenaJson.width, height: arenaJson.height };

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
  progression: SCENARIO_PROGRESSION,
  upgrades: NO_UPGRADES,
  run: DEFAULT_RUN,
  map: DEFAULT_MAP,
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

/**
 * Contenido por defecto completo: armas y mejoras de content/ (lo que carga el juego). La velocidad
 * del jugador se lee de content/player.json (210 desde el gate de balance de 0015).
 */
export const aDefaultConfig = (): RunConfig =>
  withUpgrades(
    withWeapons(
      {
        ...aRunConfig({ pickupRadius: DEFAULT_PICKUP_RADIUS, speed: playerJson.speed }),
        arena: CONTENT_ARENA,
        progression: DEFAULT_PROGRESSION,
      },
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
  arena: { width: number; height: number; maxView: { width: number; height: number } };
  enemies: { types: [MutableType, MutableType, MutableType] };
  waves: {
    maxAlive: number;
    maxBudget: number;
    spawn: { ringRadius: number; minDistance: number; maxAttempts: number };
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
  map: {
    cellSize: number;
    startRadius: number;
    trunkDensity: number;
    trunkPatch: { min: number; max: number };
    rivers: number;
    bridges: { min: number; max: number };
    castle: { cols: number; rows: number };
    tuning: { riverVerticalChance: number; riverMeander: number; patchAttempts: number };
  };
}

/** Copia nueva del contenido por defecto en forma de ficheros (cada llamada es independiente). */
export const rawContent = (): RawContent =>
  ({
    ...structuredClone(aDefaultConfig()),
    arena: structuredClone(arenaJson),
  }) as unknown as RawContent;

export const TICK_MS = 1000 / 60;

/**
 * El mismo contenido con la curva de escenario 5/5 (spec leveling 0019): para los escenarios con
 * cifras de XP escritos con la curva anterior por defecto.
 */
export const withScenarioCurve = (config: RunConfig): RunConfig => ({
  ...config,
  progression: { ...config.progression, baseXp: 5, xpGrowth: 5 },
});
