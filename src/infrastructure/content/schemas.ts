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
  BEHAVIOR_INITIAL_UNKNOWN,
  BEHAVIOR_KIND_UNKNOWN,
  BEHAVIOR_TICKS_MUST_BE_INTEGER,
  BEHAVIOR_VALUE_MUST_BE_POSITIVE,
} from '../../domain/enemy/behavior/Behavior';
import {
  BLAST_TICKS_MUST_BE_INTEGER,
  DYNAMITE_RADIUS_MUST_BE_POSITIVE,
  MAX_DYNAMITES_MUST_BE_INTEGER,
} from '../../domain/hazard/HazardRules';
import {
  INVULNERABILITY_TICKS_MUST_BE_INTEGER,
  PICKUP_RADIUS_MUST_BE_POSITIVE,
  REGEN_INTERVAL_MUST_BE_INTEGER,
  PLAYER_HEALTH_MUST_BE_POSITIVE,
  SPEED_MUST_BE_POSITIVE,
} from '../../domain/run/RunConfig';
import {
  GEM_RADIUS_MUST_BE_POSITIVE,
  MAGNET_SPEED_MUST_BE_POSITIVE,
  MAX_GEMS_MUST_BE_INTEGER,
  MAX_GOLD_MUST_BE_INTEGER,
  MAX_MEAT_MUST_BE_INTEGER,
  MAX_WOOD_MUST_BE_INTEGER,
} from '../../domain/pickup/PickupRules';
import {
  MEAT_HEAL_PERCENT_OUT_OF_RANGE,
  RESOURCE_AMOUNT_MUST_BE_INTEGER,
  RESOURCE_COUNT_MUST_BE_INTEGER,
  RESOURCE_GOLD_PER_KILL_INVALID,
  RESOURCE_PLACEMENT_MUST_BE_INTEGER,
  VEIN_RADIUS_MUST_BE_POSITIVE,
} from '../../domain/resource/ResourceRules';
import {
  SHEEP_DISTANCE_MUST_BE_NON_NEGATIVE,
  SHEEP_HEALTH_MUST_BE_INTEGER,
  SHEEP_MAX_ALIVE_MUST_BE_INTEGER,
  SHEEP_PLACEMENT_MUST_BE_INTEGER,
  SHEEP_RADIUS_FIELD_MUST_BE_POSITIVE,
  SHEEP_RADIUS_MUST_BE_POSITIVE,
  SHEEP_SPEED_MUST_BE_POSITIVE,
  SHEEP_TICKS_MUST_BE_INTEGER,
} from '../../domain/sheep/SheepRules';
import { LEVEL_UP_HEAL_PERCENT_OUT_OF_RANGE } from '../../domain/progression/LevelUpHeal';
import {
  BASE_XP_MUST_BE_INTEGER,
  XP_GROWTH_MUST_BE_INTEGER,
} from '../../domain/progression/XpCurve';
import {
  UPGRADE_MAX_LEVEL_MUST_BE_INTEGER,
  UPGRADE_PRICES_INVALID,
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
import {
  SHOP_HEAL_MUST_BE_INTEGER,
  SHOP_RADIUS_MUST_BE_POSITIVE,
  SHOP_REARM_MUST_EXCEED_RADIUS,
} from '../../domain/shop/ShopRules';
import {
  STRUCTURE_COUNT_MUST_BE_INTEGER,
  STRUCTURE_FOOTPRINT_MUST_FIT,
  STRUCTURE_GUARDS_MUST_BE_INTEGER,
  STRUCTURE_PLACEMENT_MUST_BE_INTEGER,
  STRUCTURE_VALUE_MUST_BE_POSITIVE,
} from '../../domain/structure/StructureType';

// Forma y rangos por campo de cada fichero de content/ (AGENTS.md §3.5-6). Todos estrictos: un
// campo desconocido es un error. Los mensajes son los del dominio; las reglas cruzadas (encaje del
// radio, id únicos, orden de tramos, tipos existentes, maxBudget ≥ coste más caro) las aplica
// `buildRunRules` desde el superRefine del loader.

export const ENEMY_ID_FORMAT =
  'El id de un enemigo usa minúsculas, dígitos y guiones (p. ej. goblin-tnt).';

const EnemyId = z.string().regex(/^[a-z][a-z0-9-]*$/, { error: ENEMY_ID_FORMAT });
const Count = (error: string) => z.number().int({ error }).min(1, { error });
/** Como `Count`, pero un valor ausente o no numérico también da el mensaje del dominio (0020). */
const RequiredCount = (error: string) => z.number({ error }).int({ error }).min(1, { error });
const Distance = z.number().nonnegative({ error: SPAWN_DISTANCE_MUST_BE_NON_NEGATIVE });

export const PlayerSchema = z.strictObject({
  speed: z.number().positive({ error: SPEED_MUST_BE_POSITIVE }),
  radius: z.number().positive(),
  maxHealth: z.number().positive({ error: PLAYER_HEALTH_MUST_BE_POSITIVE }),
  invulnerabilityTicks: Count(INVULNERABILITY_TICKS_MUST_BE_INTEGER),
  pickupRadius: z.number().positive({ error: PICKUP_RADIUS_MUST_BE_POSITIVE }),
  regenIntervalTicks: RequiredCount(REGEN_INTERVAL_MUST_BE_INTEGER),
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

export const BEHAVIOR_REQUIRED = 'Cada tipo de enemigo debe declarar su comportamiento.';
export const BEHAVIOR_NEEDS_STATES = 'Un comportamiento debe declarar al menos un estado.';
export const BEHAVIOR_STATE_NAME_REQUIRED = 'El nombre de un estado no puede estar vacío.';

const StateName = z.string().min(1, { error: BEHAVIOR_STATE_NAME_REQUIRED });
const BehaviorValue = z.number({ error: BEHAVIOR_VALUE_MUST_BE_POSITIVE }).positive({
  error: BEHAVIOR_VALUE_MUST_BE_POSITIVE,
});
const BehaviorTicks = RequiredCount(BEHAVIOR_TICKS_MUST_BE_INTEGER);
/** Salida por distancia (`exit`, `detect`, `lose`): distancia > 0 y estado de destino. */
const DistanceTo = z.strictObject({ distance: BehaviorValue, to: StateName });

// Clases cerradas de estado (spec enemy-behavior, ADR-0019). Las referencias entre estados
// (inicial, destinos, nombres repetidos) las resuelve `Behavior.create` desde `buildRunRules`.
const StateSchema = z.discriminatedUnion(
  'kind',
  [
    z.strictObject({
      name: StateName,
      kind: z.literal('chase'),
      exit: z.strictObject({ distance: BehaviorValue, to: StateName }).optional(),
    }),
    z.strictObject({
      name: StateName,
      kind: z.literal('fuse'),
      ticks: BehaviorTicks,
      radius: BehaviorValue,
      damage: BehaviorValue,
    }),
    z.strictObject({
      name: StateName,
      kind: z.literal('charge'),
      ticks: BehaviorTicks,
      to: StateName,
      dynamite: z.strictObject({
        flightTicks: BehaviorTicks,
        radius: BehaviorValue,
        damage: BehaviorValue,
      }),
    }),
    z.strictObject({
      name: StateName,
      kind: z.literal('wait'),
      ticks: BehaviorTicks,
      to: StateName,
    }),
    // Clases de guardia (0021, ADR-0020): el inicial de patrulla y el abandono mayor que las
    // detecciones los comprueba `Behavior.create`.
    z.strictObject({
      name: StateName,
      kind: z.literal('patrol'),
      radius: BehaviorValue,
      detect: DistanceTo,
    }),
    z.strictObject({
      name: StateName,
      kind: z.literal('alert'),
      exit: DistanceTo,
      lose: DistanceTo,
    }),
    z.strictObject({
      name: StateName,
      kind: z.literal('return'),
      detect: DistanceTo,
      to: StateName,
    }),
  ],
  { error: (issue) => `${BEHAVIOR_KIND_UNKNOWN}: ${kindOf(issue.input)}` },
);

/** Valor de `kind` recibido (para el mensaje de una clase desconocida). */
function kindOf(input: unknown): string {
  if (typeof input !== 'object' || input === null || !('kind' in input)) return 'ausente';
  return String(input.kind);
}

const BehaviorSchema = z.strictObject(
  {
    initial: z.string({ error: BEHAVIOR_INITIAL_UNKNOWN }),
    states: z.array(StateSchema).min(1, { error: BEHAVIOR_NEEDS_STATES }),
  },
  { error: BEHAVIOR_REQUIRED },
);

const HazardsSchema = z.strictObject({
  maxDynamites: RequiredCount(MAX_DYNAMITES_MUST_BE_INTEGER),
  dynamiteRadius: z
    .number({ error: DYNAMITE_RADIUS_MUST_BE_POSITIVE })
    .positive({ error: DYNAMITE_RADIUS_MUST_BE_POSITIVE }),
  blastTicks: RequiredCount(BLAST_TICKS_MUST_BE_INTEGER),
});

export const EnemiesSchema = z.strictObject({
  hazards: HazardsSchema,
  types: z.array(
    z.strictObject({
      id: EnemyId,
      speed: z.number().positive({ error: ENEMY_SPEED_MUST_BE_POSITIVE }),
      radius: z.number().positive({ error: ENEMY_RADIUS_MUST_FIT }),
      cost: z.number().positive({ error: ENEMY_COST_MUST_BE_POSITIVE }),
      damage: z.number().positive({ error: ENEMY_DAMAGE_MUST_BE_POSITIVE }).optional(),
      health: z.number().positive({ error: ENEMY_HEALTH_MUST_BE_POSITIVE }),
      xp: Count(ENEMY_XP_MUST_BE_INTEGER),
      behavior: BehaviorSchema,
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
  maxGold: RequiredCount(MAX_GOLD_MUST_BE_INTEGER),
  maxWood: RequiredCount(MAX_WOOD_MUST_BE_INTEGER),
  maxMeat: RequiredCount(MAX_MEAT_MUST_BE_INTEGER),
  levelUpHealPercent: z
    .number({ error: LEVEL_UP_HEAL_PERCENT_OUT_OF_RANGE })
    .int({ error: LEVEL_UP_HEAL_PERCENT_OUT_OF_RANGE })
    .min(1, { error: LEVEL_UP_HEAL_PERCENT_OUT_OF_RANGE })
    .max(100, { error: LEVEL_UP_HEAL_PERCENT_OUT_OF_RANGE }),
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

// Las reglas cruzadas (ids únicos entre catálogos, catálogo de cada objetivo, arma existente,
// compatibilidad, incremento entero, precios por nivel, build de peor caso) las aplica
// `buildRunRules` desde el superRefine del loader.
const UpgradeFields = {
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, { error: UPGRADE_ID_FORMAT }),
  name: UpgradeText(UPGRADE_NAME_MAX),
  description: UpgradeText(UPGRADE_DESCRIPTION_MAX),
  target: UpgradeTargetSchema,
  stat: z.enum(UPGRADE_STATS),
  perLevel: z
    .number({ error: UPGRADE_STEP_MUST_NOT_BE_ZERO })
    .refine((v) => v !== 0, { error: UPGRADE_STEP_MUST_NOT_BE_ZERO }),
  maxLevel: Count(UPGRADE_MAX_LEVEL_MUST_BE_INTEGER),
};

/** Precio de un nivel de una mejora de arma (castle-shop 0024): entero ≥ 1. */
const UpgradePrice = RequiredCount(UPGRADE_PRICES_INVALID);

// Dos catálogos (ADR-0023): `character` (sin precios) y `weapons` (con un precio por nivel).
export const UpgradesSchema = z.strictObject({
  character: z.array(z.strictObject(UpgradeFields)).min(1, { error: UPGRADES_REQUIRED }),
  weapons: z
    .array(
      z.strictObject({
        ...UpgradeFields,
        prices: z.array(UpgradePrice, { error: UPGRADE_PRICES_INVALID }),
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

const NonNegativeInt = (error: string) => z.number({ error }).int({ error }).min(0, { error });
const StructureValue = z
  .number({ error: STRUCTURE_VALUE_MUST_BE_POSITIVE })
  .positive({ error: STRUCTURE_VALUE_MUST_BE_POSITIVE });
const FootprintSide = RequiredCount(STRUCTURE_FOOTPRINT_MUST_FIT);

/** Campos comunes de un tipo de estructura; la casa añade `guards` y la torre no lo admite (D4). */
const structureFields = {
  count: NonNegativeInt(STRUCTURE_COUNT_MUST_BE_INTEGER),
  footprint: z.strictObject({ cols: FootprintSide, rows: FootprintSide }),
  radius: StructureValue,
  health: StructureValue,
};

// Casas y torres goblin (content/structures.json, spec goblin-structures, ADR-0020). `types` es un
// objeto estricto por id: exactamente `goblin-house` y `goblin-tower`, en el orden de colocación.
// El encaje de la huella en la rejilla y el tipo de guardia (existe y empieza en patrulla) los
// comprueba `StructureRules` desde `buildRunRules`, en el superRefine del loader.
export const StructuresSchema = z.strictObject({
  placement: z.strictObject({
    minStartCells: NonNegativeInt(STRUCTURE_PLACEMENT_MUST_BE_INTEGER),
    minCastleCells: NonNegativeInt(STRUCTURE_PLACEMENT_MUST_BE_INTEGER),
    minWaterCells: NonNegativeInt(STRUCTURE_PLACEMENT_MUST_BE_INTEGER),
    minGapCells: NonNegativeInt(STRUCTURE_PLACEMENT_MUST_BE_INTEGER),
    maxAttempts: RequiredCount(STRUCTURE_PLACEMENT_MUST_BE_INTEGER),
  }),
  types: z.strictObject({
    'goblin-house': z.strictObject({
      ...structureFields,
      guards: z.strictObject({
        type: EnemyId,
        max: RequiredCount(STRUCTURE_GUARDS_MUST_BE_INTEGER),
        everyTicks: RequiredCount(STRUCTURE_GUARDS_MUST_BE_INTEGER),
      }),
    }),
    'goblin-tower': z.strictObject(structureFields),
  }),
});

const ResourceAmount = RequiredCount(RESOURCE_AMOUNT_MUST_BE_INTEGER);
const ResourceCount = NonNegativeInt(RESOURCE_COUNT_MUST_BE_INTEGER);
const ResourceDistance = NonNegativeInt(RESOURCE_PLACEMENT_MUST_BE_INTEGER);

// Fuentes de oro, madera y carne (content/resources.json, spec resources, ADR-0021 y 0023). Estricto
// en todos los niveles: un tipo de recogible que no sea `gold` o `wood` en un drop (p. ej.
// `potion`) o un campo de más (p. ej. `meatPerHouse`) es un campo desconocido y el error lo nombra. Que las claves de los drops existan en el catálogo de enemigos y en los
// tipos de estructura lo comprueba `ResourceRules` desde `buildRunRules`, igual que el cruce
// `progression.maxWood ≥ woodPiles.count`.
export const ResourcesSchema = z.strictObject({
  drops: z.strictObject({
    enemies: z.record(z.string(), z.strictObject({ wood: ResourceAmount })),
    structures: z.record(z.string(), z.strictObject({ gold: ResourceAmount })),
    goldPerKill: z.record(z.string(), NonNegativeInt(RESOURCE_GOLD_PER_KILL_INVALID)),
  }),
  woodPiles: z.strictObject({ count: ResourceCount, wood: ResourceAmount }),
  goldVeins: z.strictObject({
    count: ResourceCount,
    gold: ResourceAmount,
    radius: z
      .number({ error: VEIN_RADIUS_MUST_BE_POSITIVE })
      .positive({ error: VEIN_RADIUS_MUST_BE_POSITIVE }),
  }),
  placement: z.strictObject({
    minStartCells: ResourceDistance,
    minCastleCells: ResourceDistance,
    minGapCells: ResourceDistance,
  }),
  meat: z.strictObject({
    perSheep: ResourceAmount,
    healPercent: z
      .number({ error: MEAT_HEAL_PERCENT_OUT_OF_RANGE })
      .int({ error: MEAT_HEAL_PERCENT_OUT_OF_RANGE })
      .min(1, { error: MEAT_HEAL_PERCENT_OUT_OF_RANGE })
      .max(100, { error: MEAT_HEAL_PERCENT_OUT_OF_RANGE }),
  }),
});

const SheepTicks = RequiredCount(SHEEP_TICKS_MUST_BE_INTEGER);
const SheepPositive = (error: string) => z.number({ error }).positive({ error });
const SheepPlacement = NonNegativeInt(SHEEP_PLACEMENT_MUST_BE_INTEGER);

// Ovejas neutrales (content/sheep.json, spec sheep 0023, ADR-0022). Estricto en todos los niveles:
// un campo extra (p. ej. `contactDamage`) o ausente falla nombrándolo. `maxAlive` ≥ 0 sin máximo
// (0 = sin ovejas). Sin cruce con `map.cellSize` (apply de 0023): la colocación y la reaparición
// solo admiten celdas cuyo centro es posición legal del círculo de la oveja (`legalCells`).
export const SheepSchema = z.strictObject({
  maxAlive: NonNegativeInt(SHEEP_MAX_ALIVE_MUST_BE_INTEGER),
  radius: SheepPositive(SHEEP_RADIUS_MUST_BE_POSITIVE),
  health: RequiredCount(SHEEP_HEALTH_MUST_BE_INTEGER),
  graze: z.strictObject({
    ticks: SheepTicks,
    radius: SheepPositive(SHEEP_RADIUS_FIELD_MUST_BE_POSITIVE),
  }),
  wander: z.strictObject({ speed: SheepPositive(SHEEP_SPEED_MUST_BE_POSITIVE), ticks: SheepTicks }),
  flee: z.strictObject({
    radius: SheepPositive(SHEEP_RADIUS_FIELD_MUST_BE_POSITIVE),
    speed: SheepPositive(SHEEP_SPEED_MUST_BE_POSITIVE),
  }),
  respawn: z.strictObject({
    everyTicks: SheepTicks,
    minPlayerDistance: z
      .number({ error: SHEEP_DISTANCE_MUST_BE_NON_NEGATIVE })
      .nonnegative({ error: SHEEP_DISTANCE_MUST_BE_NON_NEGATIVE }),
  }),
  placement: z.strictObject({
    minStartCells: SheepPlacement,
    minCastleCells: SheepPlacement,
    minGapCells: SheepPlacement,
  }),
});

// Tienda del castillo (content/shop.json, spec castle-shop 0024). Estricto en todos los niveles
// (un campo extra como `discount` falla nombrándolo). El cruce `rearmDistance > radius` y que el id
// de la curación no sea el de una mejora los comprueba `buildRunRules` desde el superRefine.
export const ShopSchema = z.strictObject({
  door: z.strictObject({
    radius: z
      .number({ error: SHOP_RADIUS_MUST_BE_POSITIVE })
      .positive({ error: SHOP_RADIUS_MUST_BE_POSITIVE }),
    rearmDistance: z
      .number({ error: SHOP_REARM_MUST_EXCEED_RADIUS })
      .positive({ error: SHOP_REARM_MUST_EXCEED_RADIUS }),
  }),
  heal: z.strictObject({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/, { error: UPGRADE_ID_FORMAT }),
    name: UpgradeText(UPGRADE_NAME_MAX),
    description: UpgradeText(UPGRADE_DESCRIPTION_MAX),
    amount: RequiredCount(SHOP_HEAL_MUST_BE_INTEGER),
    price: RequiredCount(SHOP_HEAL_MUST_BE_INTEGER),
  }),
});
