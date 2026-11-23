import { z } from 'zod';
import { RUN_DURATION_MUST_BE_INTEGER } from '../../domain/run/RunDuration';
import {
  BRIDGES_OUT_OF_RANGE,
  CASTLE_SIZE_MUST_BE_INTEGER,
  CELL_SIZE_MUST_BE_INTEGER,
  CHANCE_OUT_OF_RANGE,
  MAP_LIMITS,
  PATCH_ATTEMPTS_MUST_BE_INTEGER,
  RIVERS_OUT_OF_RANGE,
  START_RADIUS_MUST_BE_POSITIVE,
  TRUNK_DENSITY_OUT_OF_RANGE,
  TRUNK_PATCH_OUT_OF_RANGE,
} from '../../domain/map/MapRules';
import {
  ENEMY_COST_MUST_BE_POSITIVE,
  ENEMY_DAMAGE_MUST_BE_POSITIVE,
  ENEMY_HEALTH_MUST_BE_POSITIVE,
  ENEMY_RADIUS_MUST_FIT,
  ENEMY_SPEED_MUST_BE_POSITIVE,
  ENEMY_XP_MUST_BE_INTEGER,
} from '../../domain/enemy/EnemyType';
import {
  INVULNERABILITY_TICKS_MUST_BE_INTEGER,
  PICKUP_RADIUS_MUST_BE_POSITIVE,
  PLAYER_HEALTH_MUST_BE_POSITIVE,
  SPEED_MUST_BE_POSITIVE,
} from '../../domain/run/RunConfig';
import {
  GEM_RADIUS_MUST_BE_POSITIVE,
  MAGNET_SPEED_MUST_BE_POSITIVE,
  MAX_GEMS_MUST_BE_INTEGER,
} from '../../domain/progression/GemRules';
import {
  BASE_XP_MUST_BE_INTEGER,
  XP_GROWTH_MUST_BE_INTEGER,
} from '../../domain/progression/XpCurve';
import {
  UPGRADE_MAX_LEVEL_MUST_BE_INTEGER,
  UPGRADE_STATS,
  UPGRADE_STEP_MUST_NOT_BE_ZERO,
} from '../../domain/upgrade/UpgradeType';
import {
  MAX_ALIVE_MUST_BE_INTEGER,
  MAX_BUDGET_MUST_BE_POSITIVE,
  MAX_ATTEMPTS_MUST_BE_INTEGER,
  RING_RADIUS_MUST_BE_POSITIVE,
  SPAWN_DISTANCE_MUST_BE_NON_NEGATIVE,
} from '../../domain/wave/SpawnRules';
import {
  BUDGET_MUST_BE_NON_NEGATIVE,
  SEGMENT_NEEDS_TYPES,
  WAVES_NEED_SEGMENTS,
} from '../../domain/wave/WaveTable';
import {
  HIT_FLASH_TICKS_MUST_BE_INTEGER,
  MAX_PROJECTILES_MUST_BE_INTEGER,
} from '../../domain/weapon/WeaponLoadout';
import {
  PROJECTILE_LIFETIME_MUST_BE_INTEGER,
  PROJECTILE_RADIUS_MUST_BE_POSITIVE,
  PROJECTILE_SPEED_MUST_BE_POSITIVE,
  PULSE_VISUAL_TICKS_MUST_BE_INTEGER,
  TARGETING_RADIUS_MUST_BE_POSITIVE,
  TARGETING_RANGE_MUST_BE_POSITIVE,
  WEAPON_COOLDOWN_MUST_BE_INTEGER,
  WEAPON_DAMAGE_MUST_BE_INTEGER,
} from '../../domain/weapon/WeaponType';

// Forma y rangos por campo de cada fichero de content/ (AGENTS.md §3.5-6). Todos estrictos: un
// campo desconocido es un error. Los mensajes son los del dominio; las reglas cruzadas (encaje del
// radio, id únicos, orden de tramos, tipos existentes, maxBudget ≥ coste más caro) las aplica
// `buildRunRules` desde el superRefine del loader.

export const ENEMY_ID_FORMAT =
  'El id de un enemigo usa minúsculas, dígitos y guiones (p. ej. goblin-tnt).';

const EnemyId = z.string().regex(/^[a-z][a-z0-9-]*$/, { error: ENEMY_ID_FORMAT });
const Count = (error: string) => z.number().int({ error }).min(1, { error });
const Distance = z.number().nonnegative({ error: SPAWN_DISTANCE_MUST_BE_NON_NEGATIVE });

export const PlayerSchema = z.strictObject({
  speed: z.number().positive({ error: SPEED_MUST_BE_POSITIVE }),
  radius: z.number().positive(),
  maxHealth: z.number().positive({ error: PLAYER_HEALTH_MUST_BE_POSITIVE }),
  invulnerabilityTicks: Count(INVULNERABILITY_TICKS_MUST_BE_INTEGER),
  pickupRadius: z.number().positive({ error: PICKUP_RADIUS_MUST_BE_POSITIVE }),
});

export const MAX_VIEW_MUST_BE_POSITIVE_INTEGER =
  'El tope de vista debe tener un ancho y un alto enteros y positivos.';
export const WORLD_NARROWER_THAN_VIEW =
  'El ancho del mundo debe ser al menos el del tope de vista.';
export const WORLD_LOWER_THAN_VIEW = 'El alto del mundo debe ser al menos el del tope de vista.';

/** Regla cruzada de infraestructura (ADR-0015): el anillo de aparición queda fuera del tope. */
export const SPAWN_RING_INSIDE_MAX_VIEW =
  'El radio del anillo de aparición debe ser mayor que la media diagonal del tope de vista.';

const MaxViewSide = z
  .number({ error: MAX_VIEW_MUST_BE_POSITIVE_INTEGER })
  .int({ error: MAX_VIEW_MUST_BE_POSITIVE_INTEGER })
  .positive({ error: MAX_VIEW_MUST_BE_POSITIVE_INTEGER });

/**
 * Mundo (`width` × `height`) y tope de vista del lienzo (`maxView`, 0017, ADR-0014). El mundo es al
 * menos tan grande como el tope: con unos límites menores que la vista, la cámara mostraría zonas
 * fuera del mundo. Sin `view`: la vista sale de la ventana, no del contenido.
 */
export const ArenaSchema = z
  .strictObject({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    maxView: z.strictObject({ width: MaxViewSide, height: MaxViewSide }),
  })
  .superRefine(({ width, height, maxView }, ctx) => {
    if (width < maxView.width) {
      ctx.addIssue({ code: 'custom', path: ['width'], message: WORLD_NARROWER_THAN_VIEW });
    }
    if (height < maxView.height) {
      ctx.addIssue({ code: 'custom', path: ['height'], message: WORLD_LOWER_THAN_VIEW });
    }
  });

export const EnemiesSchema = z.strictObject({
  types: z.array(
    z.strictObject({
      id: EnemyId,
      speed: z.number().positive({ error: ENEMY_SPEED_MUST_BE_POSITIVE }),
      radius: z.number().positive({ error: ENEMY_RADIUS_MUST_FIT }),
      cost: z.number().positive({ error: ENEMY_COST_MUST_BE_POSITIVE }),
      damage: z.number().positive({ error: ENEMY_DAMAGE_MUST_BE_POSITIVE }),
      health: z.number().positive({ error: ENEMY_HEALTH_MUST_BE_POSITIVE }),
      xp: Count(ENEMY_XP_MUST_BE_INTEGER),
    }),
  ),
});

export const WEAPONS_REQUIRED = 'El contenido debe definir al menos un arma.';
export const WEAPON_ID_REQUIRED = 'El id de un arma no puede estar vacío.';

const Positive = (error: string) => z.number().positive({ error });

const TargetingSchema = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z.literal('nearest-in-range'),
    range: Positive(TARGETING_RANGE_MUST_BE_POSITIVE),
  }),
  z.strictObject({
    mode: z.literal('any-in-radius'),
    radius: Positive(TARGETING_RADIUS_MUST_BE_POSITIVE),
  }),
]);

const AttackSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('projectile'),
    speed: Positive(PROJECTILE_SPEED_MUST_BE_POSITIVE),
    radius: Positive(PROJECTILE_RADIUS_MUST_BE_POSITIVE),
    lifetimeTicks: Count(PROJECTILE_LIFETIME_MUST_BE_INTEGER),
  }),
  z.strictObject({
    type: z.literal('pulse'),
    visualTicks: Count(PULSE_VISUAL_TICKS_MUST_BE_INTEGER),
  }),
]);

// La compatibilidad criterio ↔ ataque, los ids únicos y el resto de reglas cruzadas las aplica
// `buildRunRules` desde el superRefine del loader (una sola implementación, ADR-0007).
export const WeaponsSchema = z.strictObject({
  maxProjectiles: Count(MAX_PROJECTILES_MUST_BE_INTEGER),
  hitFlashTicks: Count(HIT_FLASH_TICKS_MUST_BE_INTEGER),
  weapons: z
    .array(
      z.strictObject({
        id: z.string().min(1, { error: WEAPON_ID_REQUIRED }),
        cooldownTicks: Count(WEAPON_COOLDOWN_MUST_BE_INTEGER),
        damage: Count(WEAPON_DAMAGE_MUST_BE_INTEGER),
        targeting: TargetingSchema,
        attack: AttackSchema,
      }),
    )
    .min(1, { error: WEAPONS_REQUIRED }),
});

export const ProgressionSchema = z.strictObject({
  baseXp: Count(BASE_XP_MUST_BE_INTEGER),
  xpGrowth: z
    .number()
    .int({ error: XP_GROWTH_MUST_BE_INTEGER })
    .min(0, { error: XP_GROWTH_MUST_BE_INTEGER }),
  gemRadius: Positive(GEM_RADIUS_MUST_BE_POSITIVE),
  magnetSpeed: Positive(MAGNET_SPEED_MUST_BE_POSITIVE),
  maxGems: Count(MAX_GEMS_MUST_BE_INTEGER),
});

export const UPGRADES_REQUIRED = 'El contenido debe definir al menos una mejora.';
export const UPGRADE_ID_FORMAT =
  'El id de una mejora usa minúsculas, dígitos y guiones (p. ej. fast-ci).';
export const UPGRADE_TEXT_REQUIRED =
  'El nombre y la descripción de una mejora no pueden estar vacíos.';
/** Longitudes máximas para que el texto quepa en la carta del overlay. */
export const UPGRADE_NAME_MAX = 40;
export const UPGRADE_DESCRIPTION_MAX = 120;
export const UPGRADE_TEXT_TOO_LONG = 'El texto de una mejora es demasiado largo para su carta.';

const UpgradeTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('weapon'),
    weapon: z.string().min(1, { error: WEAPON_ID_REQUIRED }),
  }),
  z.strictObject({ kind: z.literal('player') }),
]);

const UpgradeText = (max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: UPGRADE_TEXT_REQUIRED })
    .max(max, { error: UPGRADE_TEXT_TOO_LONG });

// Las reglas cruzadas (ids únicos, arma existente, compatibilidad, incremento entero en daño y
// cadencia, build de peor caso) las aplica `buildRunRules` desde el superRefine del loader.
export const UpgradesSchema = z.strictObject({
  upgrades: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[a-z][a-z0-9-]*$/, { error: UPGRADE_ID_FORMAT }),
        name: UpgradeText(UPGRADE_NAME_MAX),
        description: UpgradeText(UPGRADE_DESCRIPTION_MAX),
        target: UpgradeTargetSchema,
        stat: z.enum(UPGRADE_STATS),
        perLevel: z
          .number({ error: UPGRADE_STEP_MUST_NOT_BE_ZERO })
          .refine((v) => v !== 0, { error: UPGRADE_STEP_MUST_NOT_BE_ZERO }),
        maxLevel: Count(UPGRADE_MAX_LEVEL_MUST_BE_INTEGER),
      }),
    )
    .min(1, { error: UPGRADES_REQUIRED }),
});

export const WavesSchema = z.strictObject({
  maxAlive: Count(MAX_ALIVE_MUST_BE_INTEGER),
  maxBudget: z.number().positive({ error: MAX_BUDGET_MUST_BE_POSITIVE }),
  spawn: z.strictObject({
    ringRadius: z.number().positive({ error: RING_RADIUS_MUST_BE_POSITIVE }),
    minDistance: Distance,
    maxAttempts: Count(MAX_ATTEMPTS_MUST_BE_INTEGER),
  }),
  segments: z
    .array(
      z.strictObject({
        fromSecond: z.number().nonnegative(),
        budgetPerSecond: z.number().nonnegative({ error: BUDGET_MUST_BE_NON_NEGATIVE }),
        types: z.array(EnemyId).min(1, { error: SEGMENT_NEEDS_TYPES }),
      }),
    )
    .min(1, { error: WAVES_NEED_SEGMENTS }),
});

const IntRange = (top: number, error: string) =>
  z
    .strictObject({
      min: z.number().int({ error }).min(1, { error }).max(top, { error }),
      max: z.number().int({ error }).min(1, { error }).max(top, { error }),
    })
    .refine(({ min, max }) => min <= max, { error });

const Chance = z.number().min(0, { error: CHANCE_OUT_OF_RANGE }).max(1, {
  error: CHANCE_OUT_OF_RANGE,
});

// Parámetros del mapa (content/map.json, spec procedural-map). Las cruzadas con el mundo y el radio
// del jugador (cellSize ≥ 2r, startRadius ≤ lado menor / 2) las aplica `MapRules` desde
// `buildRunRules`, en el superRefine del loader.
export const MapSchema = z.strictObject({
  cellSize: Count(CELL_SIZE_MUST_BE_INTEGER),
  startRadius: Positive(START_RADIUS_MUST_BE_POSITIVE),
  trunkDensity: z
    .number()
    .min(0, { error: TRUNK_DENSITY_OUT_OF_RANGE })
    .max(MAP_LIMITS.trunkDensityMax, { error: TRUNK_DENSITY_OUT_OF_RANGE }),
  trunkPatch: IntRange(MAP_LIMITS.trunkPatchMax, TRUNK_PATCH_OUT_OF_RANGE),
  rivers: z
    .number()
    .int({ error: RIVERS_OUT_OF_RANGE })
    .min(0, { error: RIVERS_OUT_OF_RANGE })
    .max(MAP_LIMITS.riversMax, { error: RIVERS_OUT_OF_RANGE }),
  bridges: IntRange(MAP_LIMITS.bridgesMax, BRIDGES_OUT_OF_RANGE),
  // Huella del castillo: aquí solo enteros ≥ 1; el tope por rejilla y el encaje de huella y puerta
  // los comprueba `MapRules` (necesitan el mundo), con el campo `map.castle`.
  castle: z.strictObject({
    cols: Count(CASTLE_SIZE_MUST_BE_INTEGER),
    rows: Count(CASTLE_SIZE_MUST_BE_INTEGER),
  }),
  tuning: z.strictObject({
    riverVerticalChance: Chance,
    riverMeander: Chance,
    patchAttempts: Count(PATCH_ATTEMPTS_MUST_BE_INTEGER),
  }),
});

// Duración objetivo de la partida (content/run.json, spec run-outcome). `RunDuration` repite la
// regla en el dominio como defensa en `Run.start`.
export const RunSchema = z.strictObject({
  durationSeconds: Count(RUN_DURATION_MUST_BE_INTEGER),
});
