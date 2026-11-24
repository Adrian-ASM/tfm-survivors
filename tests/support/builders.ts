import arenaJson from '../../content/arena.json';
import mapJson from '../../content/map.json';
import playerJson from '../../content/player.json';
import wavesJson from '../../content/waves.json';
import enemiesJson from '../../content/enemies.json';
import progressionJson from '../../content/progression.json';
import upgradesJson from '../../content/upgrades.json';
import structuresJson from '../../content/structures.json';
import resourcesJson from '../../content/resources.json';
import sheepJson from '../../content/sheep.json';
import type { EnemyTypeConfig } from '../../src/domain/enemy/EnemyType';
import type { BehaviorConfig } from '../../src/domain/enemy/behavior/BehaviorConfig';
import type { HazardRulesConfig } from '../../src/domain/hazard/HazardRules';
import type { RunConfig, UpgradesConfig } from '../../src/domain/run/RunConfig';
import type { WeaponsConfig } from '../../src/domain/weapon/WeaponLoadout';
import type { WeaponTypeConfig } from '../../src/domain/weapon/WeaponType';
import type { UpgradeTypeConfig } from '../../src/domain/upgrade/UpgradeType';
import type { StructuresConfig } from '../../src/domain/structure/StructureType';
import type { ResourcesConfig } from '../../src/domain/resource/ResourceRules';
import type { SheepConfig } from '../../src/domain/sheep/SheepRules';

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
export const DEFAULT_CHARACTER_UPGRADES: readonly UpgradeTypeConfig[] = frozen(
  upgradesJson.character as UpgradeTypeConfig[],
);

/** Catálogo de arma por defecto (0024): las 6 mejoras de arma, con sus precios por nivel. */
export const DEFAULT_WEAPON_UPGRADES: readonly UpgradeTypeConfig[] = frozen(
  upgradesJson.weapons as UpgradeTypeConfig[],
);

/** Las 15 mejoras de los dos catálogos en el orden del vector de niveles: personaje y luego arma. */
export const DEFAULT_UPGRADE_LIST: readonly UpgradeTypeConfig[] = Object.freeze([
  ...DEFAULT_CHARACTER_UPGRADES,
  ...DEFAULT_WEAPON_UPGRADES,
]);

/** Contenido de mejoras por defecto (content/upgrades.json, dos catálogos desde 0024). */
export const DEFAULT_UPGRADES: UpgradesConfig = Object.freeze({
  character: DEFAULT_CHARACTER_UPGRADES,
  weapons: DEFAULT_WEAPON_UPGRADES,
});

/**
 * Sin mejoras: válido en el dominio (no en el fichero). Por defecto en `aRunConfig`, así que los
 * escenarios de 0001–0004 no se pausan: las subidas se registran sin oferta.
 */
export const NO_UPGRADES: UpgradesConfig = Object.freeze({ character: [], weapons: [] });

/**
 * Los dos catálogos a partir de una lista mezclada: las de objetivo jugador van al de personaje y
 * las de objetivo arma, al de arma (escenarios escritos con una sola lista antes de 0024).
 */
export const upgradesOf = (list: readonly UpgradeTypeConfig[]): UpgradesConfig => ({
  character: list.filter((u) => u.target.kind === 'player'),
  weapons: list.filter((u) => u.target.kind === 'weapon'),
});

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

/**
 * Tipos de enemigo por defecto (torch, tnt, barrel y, desde 0021, tnt-guard), leídos de
 * content/enemies.json (0019).
 */
export const DEFAULT_ENEMY_TYPES: readonly EnemyTypeConfig[] = frozen(
  enemiesJson.types as EnemyTypeConfig[],
);

/** ¿Es un tipo de guardia (empieza en patrulla, spec enemy-behavior 0021)? */
const isGuardType = (t: EnemyTypeConfig): boolean =>
  t.behavior.states.find((s) => s.name === t.behavior.initial)?.kind === 'patrol';

/** Casas y torres por defecto, leídas de content/structures.json (0021, una sola fuente). */
export const CONTENT_STRUCTURES: StructuresConfig = frozen(structuresJson);

/**
 * Sin tipos de estructura: válido en el dominio (no en el fichero). Por defecto en `aRunConfig`,
 * para que los escenarios de 0001–0020 sigan sin casas ni torres en cualquier mapa.
 */
export const NO_STRUCTURES: StructuresConfig = Object.freeze({
  placement: CONTENT_STRUCTURES.placement,
  types: Object.freeze({}),
});

/** Fuentes de oro y madera por defecto, leídas de content/resources.json (0022). */
export const CONTENT_RESOURCES: ResourcesConfig = frozen(resourcesJson);

/**
 * Sin fuentes de recursos (spec resources, "Recursos sin efecto en el combate"): 0 montones, 0 vetas
 * y mapas de drops vacíos, con las cantidades del contenido (que no pueden ser 0). Por defecto en
 * `aRunConfig`: los escenarios de 0001–0021 siguen sin oro ni madera.
 */
export const NO_RESOURCES: ResourcesConfig = Object.freeze({
  ...CONTENT_RESOURCES,
  drops: Object.freeze({ enemies: Object.freeze({}), structures: Object.freeze({}) }),
  woodPiles: Object.freeze({ ...CONTENT_RESOURCES.woodPiles, count: 0 }),
  goldVeins: Object.freeze({ ...CONTENT_RESOURCES.goldVeins, count: 0 }),
});

/** El mismo contenido con otras fuentes de recursos. */
export const withResources = (config: RunConfig, resources: ResourcesConfig): RunConfig => ({
  ...config,
  resources,
});

/**
 * El mismo contenido con estos drops y ningún otro (escenarios de 0022): madera por
 * `goblin-barrel` abatido y oro por casa y por torre destruidas.
 */
export const withDrops = (
  config: RunConfig,
  o: { readonly wood?: number; readonly house?: number; readonly tower?: number },
): RunConfig => {
  const structures: Record<string, { gold: number }> = {};
  if (o.house !== undefined) structures['goblin-house'] = { gold: o.house };
  if (o.tower !== undefined) structures['goblin-tower'] = { gold: o.tower };
  const enemies = o.wood === undefined ? {} : { 'goblin-barrel': { wood: o.wood } };
  return withResources(config, { ...config.resources, drops: { enemies, structures } });
};

/** Ovejas por defecto, leídas de content/sheep.json (0023, una sola fuente). */
export const CONTENT_SHEEP: SheepConfig = frozen(sheepJson);

/**
 * Sin ovejas en el mapa generado (tope 0, válido): por defecto en `aRunConfig`, para que los
 * escenarios de 0001–0022 sigan sin ovejas con cualquier mapa. Los mapas declarados solo tienen las
 * que declaran.
 */
export const NO_SHEEP: SheepConfig = Object.freeze({ ...CONTENT_SHEEP, maxAlive: 0 });

/**
 * Oveja de prueba de la spec `sheep` (0023): radio 20, vida 12, paseo 60 px/s × 60 ticks, huida
 * 180 px/s con radio 200, pasto de 120 ticks con radio 300 y reaparición cada 600 ticks a ≥ 500 px.
 */
export const TEST_SHEEP: SheepConfig = Object.freeze({
  ...CONTENT_SHEEP,
  radius: 20,
  health: 12,
  graze: Object.freeze({ ticks: 120, radius: 300 }),
  wander: Object.freeze({ speed: 60, ticks: 60 }),
  flee: Object.freeze({ radius: 200, speed: 180 }),
  respawn: Object.freeze({ everyTicks: 600, minPlayerDistance: 500 }),
});

/** El mismo contenido con la oveja de prueba y estos cambios (p. ej. `{ flee: { … } }`). */
export const withSheep = (config: RunConfig, patch: Partial<SheepConfig> = {}): RunConfig => ({
  ...config,
  sheep: { ...TEST_SHEEP, ...patch },
});

/** El mismo contenido con el tope de ovejas a 0 (lote "sin ovejas" del balance, 0023). */
export const withoutSheep = (config: RunConfig): RunConfig => ({
  ...config,
  sheep: { ...config.sheep, maxAlive: 0 },
});

/** El mismo contenido con la carne cambiada (0023: `perSheep` y `healPercent`). */
export const withMeat = (config: RunConfig, meat: Partial<ResourcesConfig['meat']>): RunConfig =>
  withResources(config, { ...config.resources, meat: { ...config.resources.meat, ...meat } });

/** El mismo contenido sin fuentes de recursos (design 0022 §10). */
export const withoutResourceSources = (config: RunConfig): RunConfig =>
  withResources(config, NO_RESOURCES);

/** Globales de los peligros por defecto (content/enemies.json, `hazards`; 0020). */
export const DEFAULT_HAZARDS: HazardRulesConfig = frozen(enemiesJson.hazards);

/**
 * Comportamiento de un tipo genérico de escenario (spec enemy-behavior, convención del delta 0020):
 * un único estado de persecución sin salida, como `goblin-torch`.
 */
export const CHASE_BEHAVIOR: BehaviorConfig = Object.freeze({
  initial: 'chase',
  states: Object.freeze([Object.freeze({ name: 'chase', kind: 'chase' as const })]),
});

/**
 * Tipos de escenario: los stats por defecto con `CHASE_BEHAVIOR` (los escenarios de 0001–0019 no
 * conocen mechas ni cargas), sin los guardias (solo nacen en casas, 0021). El contenido por
 * defecto (`aDefaultConfig`) usa los de content/.
 */
export const SCENARIO_ENEMY_TYPES: readonly EnemyTypeConfig[] = Object.freeze(
  DEFAULT_ENEMY_TYPES.filter((t) => !isGuardType(t)).map((t) =>
    Object.freeze({ ...t, behavior: CHASE_BEHAVIOR }),
  ),
);

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
    regenIntervalTicks: overrides.regenIntervalTicks ?? 60,
  },
  enemies: { hazards: DEFAULT_HAZARDS, types: SCENARIO_ENEMY_TYPES },
  waves: DEFAULT_WAVES,
  weapons: NO_WEAPONS,
  progression: SCENARIO_PROGRESSION,
  upgrades: NO_UPGRADES,
  run: DEFAULT_RUN,
  map: DEFAULT_MAP,
  structures: NO_STRUCTURES,
  resources: NO_RESOURCES,
  sheep: NO_SHEEP,
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
 * del jugador se lee de content/player.json (210 desde el gate de balance de 0015). Desde 0021,
 * con las casas y torres de content/structures.json.
 */
export const aDefaultConfig = (): RunConfig =>
  withUpgrades(
    withWeapons(
      {
        ...aRunConfig({
          pickupRadius: DEFAULT_PICKUP_RADIUS,
          speed: playerJson.speed,
          regenIntervalTicks: playerJson.regenIntervalTicks,
        }),
        arena: CONTENT_ARENA,
        progression: DEFAULT_PROGRESSION,
        enemies: { hazards: DEFAULT_HAZARDS, types: DEFAULT_ENEMY_TYPES },
        structures: CONTENT_STRUCTURES,
        resources: CONTENT_RESOURCES,
        sheep: CONTENT_SHEEP,
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
    enemies: { ...base.enemies, types: types ?? base.enemies.types },
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
  damage?: number;
  health: number;
  xp: number;
  behavior: { initial: string; states: Record<string, unknown>[] };
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
  prices?: number[];
}
/**
 * Contenido crudo con la forma de los ficheros de juego de content/, mutable para preparar casos
 * inválidos.
 */
export interface RawContent {
  player: {
    speed: number;
    radius: number;
    maxHealth: number;
    invulnerabilityTicks: number;
    pickupRadius: number;
    regenIntervalTicks: number;
  };
  arena: { width: number; height: number; maxView: { width: number; height: number } };
  enemies: {
    hazards: { maxDynamites: number; dynamiteRadius: number; blastTicks: number };
    types: [MutableType, MutableType, MutableType, MutableType];
  };
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
    maxGold: number;
    maxWood: number;
    maxMeat: number;
    levelUpHealPercent: number;
    [extra: string]: unknown;
  };
  upgrades: {
    character: [MutableUpgrade, ...MutableUpgrade[]];
    weapons: [MutableUpgrade, ...MutableUpgrade[]];
  };
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
  structures: {
    placement: Record<string, number>;
    types: { 'goblin-house': MutableStructureType; 'goblin-tower': MutableStructureType };
  };
  resources: {
    drops: {
      enemies: Record<string, { wood: number; [extra: string]: unknown }>;
      structures: Record<string, { gold: number; [extra: string]: unknown }>;
      [extra: string]: unknown;
    };
    woodPiles: { count: number; wood: number };
    goldVeins: { count: number; gold: number; radius: number; [extra: string]: unknown };
    placement: { minStartCells: number; minCastleCells: number; minGapCells: number };
    meat: { perSheep: number; healPercent: number; [extra: string]: unknown };
    [extra: string]: unknown;
  };
  sheep: {
    maxAlive: number;
    radius: number;
    health: number;
    graze: { ticks: number; radius: number };
    wander: { speed: number; ticks: number };
    flee: { radius: number; speed: number };
    respawn: { everyTicks: number; minPlayerDistance: number };
    placement: { minStartCells: number; minCastleCells: number; minGapCells: number };
    [extra: string]: unknown;
  };
}
interface MutableStructureType {
  count: number;
  footprint: { cols: number; rows: number };
  radius: number;
  health: number;
  guards?: { type: string; max: number; everyTicks: number };
  [extra: string]: unknown;
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

/** Tipo de escenario con comportamiento (0020): stats y estados de los escenarios de la spec. */
interface BehaviorTypeOptions {
  readonly id?: string;
  readonly speed?: number;
  readonly radius?: number;
  readonly health?: number;
  readonly xp?: number;
  readonly damage?: number;
}

/**
 * Barril de prueba de "Mecha y explosión con el jugador quieto" (spec enemy-behavior): velocidad 70,
 * radio 16, vida 20, xp 2, sin daño por contacto, activación a 40, mecha de 30 ticks, radio 56 y
 * daño 25.
 */
export const aBarrelType = (
  o: BehaviorTypeOptions & {
    readonly activation?: number;
    readonly fuseTicks?: number;
    readonly blastRadius?: number;
    readonly blastDamage?: number;
  } = {},
): EnemyTypeConfig => ({
  id: o.id ?? 'goblin-barrel',
  speed: o.speed ?? 70,
  radius: o.radius ?? 16,
  cost: 2,
  ...(o.damage === undefined ? {} : { damage: o.damage }),
  health: o.health ?? 20,
  xp: o.xp ?? 2,
  behavior: {
    initial: 'approach',
    states: [
      { name: 'approach', kind: 'chase', exit: { distance: o.activation ?? 40, to: 'fuse' } },
      {
        name: 'fuse',
        kind: 'fuse',
        ticks: o.fuseTicks ?? 30,
        radius: o.blastRadius ?? 56,
        damage: o.blastDamage ?? 25,
      },
    ],
  },
});

/**
 * TNT de prueba de "Ciclo completo de lanzamiento" (spec enemy-behavior): velocidad 45, radio 22,
 * vida 45, contacto 15, lanzamiento a 200, carga de 20, dinamita de vuelo 40, radio 48 y daño 20,
 * y espera de 60.
 */
export const aTntType = (
  o: BehaviorTypeOptions & {
    readonly launch?: number;
    readonly chargeTicks?: number;
    readonly flightTicks?: number;
    readonly blastRadius?: number;
    readonly blastDamage?: number;
    readonly waitTicks?: number;
  } = {},
): EnemyTypeConfig => ({
  id: o.id ?? 'goblin-tnt',
  speed: o.speed ?? 45,
  radius: o.radius ?? 22,
  cost: 3,
  damage: o.damage ?? 15,
  health: o.health ?? 45,
  xp: o.xp ?? 4,
  behavior: {
    initial: 'approach',
    states: [
      { name: 'approach', kind: 'chase', exit: { distance: o.launch ?? 200, to: 'aim' } },
      {
        name: 'aim',
        kind: 'charge',
        ticks: o.chargeTicks ?? 20,
        to: 'reload',
        dynamite: {
          flightTicks: o.flightTicks ?? 40,
          radius: o.blastRadius ?? 48,
          damage: o.blastDamage ?? 20,
        },
      },
      { name: 'reload', kind: 'wait', ticks: o.waitTicks ?? 60, to: 'approach' },
    ],
  },
});

/**
 * Tipo de "Salida por distancia justo en el límite": velocidad 60, persecución con salida a 100 px
 * hacia una espera de 600 ticks que vuelve a la persecución.
 */
export const aWaitType = (
  o: BehaviorTypeOptions & { readonly exit?: number; readonly waitTicks?: number } = {},
): EnemyTypeConfig => ({
  id: o.id ?? 'waiter',
  speed: o.speed ?? 60,
  radius: o.radius ?? 10,
  cost: 1,
  damage: o.damage ?? 10,
  health: o.health ?? 10,
  xp: o.xp ?? 1,
  behavior: {
    initial: 'chase',
    states: [
      { name: 'chase', kind: 'chase', exit: { distance: o.exit ?? 100, to: 'wait' } },
      { name: 'wait', kind: 'wait', ticks: o.waitTicks ?? 600, to: 'chase' },
    ],
  },
});

/**
 * Enemigo de prueba quieto ("quieto en …" de los escenarios de peligros): una espera que no acaba
 * en la partida. Sin daño por contacto salvo que se pida; radio 10, vida 50 y xp 1 por defecto.
 */
export const aStillType = (o: BehaviorTypeOptions = {}): EnemyTypeConfig => ({
  id: o.id ?? 'still',
  speed: o.speed ?? 60,
  radius: o.radius ?? 10,
  cost: 1,
  ...(o.damage === undefined ? {} : { damage: o.damage }),
  health: o.health ?? 50,
  xp: o.xp ?? 1,
  behavior: {
    initial: 'still',
    states: [{ name: 'still', kind: 'wait', ticks: 1_000_000, to: 'still' }],
  },
});

/** Estado inicial de un enemigo de `RunSetup`: `elapsed` ticks ya pasados en él (0020). */
export const inState = (state: string, elapsed = 0) => ({ state, elapsed });

/**
 * Dinamita de `RunSetup` (0020): lanzada "en el tick 0" desde (x, y) hacia el objetivo; explota en
 * el tick `ticksLeft`. Por defecto, radio 48 y daño 20 (la de "Posiciones del vuelo").
 */
export const aDynamite = (
  target: { readonly x: number; readonly y: number },
  ticksLeft: number,
  o: { readonly from?: { x: number; y: number }; radius?: number; damage?: number } = {},
) => ({
  x: o.from?.x ?? target.x,
  y: o.from?.y ?? target.y,
  targetX: target.x,
  targetY: target.y,
  ticksLeft,
  radius: o.radius ?? 48,
  damage: o.damage ?? 20,
});

/** Estado de un enemigo genérico de escenario en el snapshot (0020). */
export const CHASING = { state: 'chase', stateKind: 'chase' } as const;
