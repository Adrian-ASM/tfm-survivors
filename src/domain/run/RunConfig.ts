import { Arena } from '../arena/Arena';
import { EnemyCatalog } from '../enemy/EnemyCatalog';
import type { EnemyTypeConfig } from '../enemy/EnemyType';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { SpawnRules } from '../wave/SpawnRules';
import { WaveTable, type WaveSegmentConfig } from '../wave/WaveTable';
import { WeaponLoadout, type WeaponsConfig } from '../weapon/WeaponLoadout';
import {
  INVULNERABILITY_TICKS_MUST_BE_INTEGER,
  REGEN_INTERVAL_MUST_BE_INTEGER,
  PICKUP_RADIUS_MUST_BE_POSITIVE,
  PLAYER_HEALTH_MUST_BE_POSITIVE,
  RADIUS_MUST_FIT,
  SPEED_MUST_BE_POSITIVE,
  checkPlayer,
  type PlayerRules,
} from '../player/PlayerRules';
import { PickupRules, type PickupRulesConfig } from '../pickup/PickupRules';
import { ResourceRules, type ResourcesConfig } from '../resource/ResourceRules';
import { XpCurve, type XpCurveConfig } from '../progression/XpCurve';
import { checkLevelUpHeal, type LevelUpHealConfig } from '../progression/LevelUpHeal';
import { UpgradeCatalog, type UpgradeLists } from '../upgrade/UpgradeCatalog';
import { RunDuration } from './RunDuration';
import { MapRules, type MapConfig } from '../map/MapRules';
import { HazardRules, type HazardRulesConfig } from '../hazard/HazardRules';
import { StructureRules } from '../structure/StructureRules';
import type { StructuresConfig } from '../structure/StructureType';
import { SheepRules, type SheepConfig } from '../sheep/SheepRules';
import { SHOP_HEAL_ID_TAKEN, ShopRules, type ShopConfig } from '../shop/ShopRules';
import { BuildingRules, type BuildingsConfig } from '../site/BuildingRules';
import { CombatRules, type CombatConfig } from '../combat/CombatRules';

export type { WeaponsConfig, PlayerRules };
export {
  INVULNERABILITY_TICKS_MUST_BE_INTEGER,
  REGEN_INTERVAL_MUST_BE_INTEGER,
  PICKUP_RADIUS_MUST_BE_POSITIVE,
  PLAYER_HEALTH_MUST_BE_POSITIVE,
  RADIUS_MUST_FIT,
  SPEED_MUST_BE_POSITIVE,
  checkPlayer,
};

/** Regla cruzada (spec xp-gems): ningún montón de madera se funde con otro al crear la partida. */
export const MAX_WOOD_BELOW_WOOD_PILES =
  'El tope de recogibles de madera debe ser ≥ el número de montones de madera por mapa.';

/** Regla cruzada: con un máximo menor, el tipo más caro nunca reuniría su coste. */
export const MAX_BUDGET_BELOW_MAX_COST =
  'El máximo de presupuesto debe ser ≥ el coste del tipo de enemigo más caro';

/**
 * Configuración de partida ya validada en forma (zod, infraestructura); aquí se validan
 * invariantes.
 */
export interface RunConfig {
  readonly arena: {
    readonly width: number;
    readonly height: number;
  };
  readonly player: PlayerRules;
  /** Globales de los peligros y tipos de enemigo (content/enemies.json). */
  readonly enemies: {
    readonly hazards: HazardRulesConfig;
    readonly types: readonly EnemyTypeConfig[];
  };
  readonly waves: {
    readonly maxAlive: number;
    readonly maxBudget: number;
    readonly spawn: {
      readonly ringRadius: number;
      readonly minDistance: number;
      readonly maxAttempts: number;
    };
    readonly segments: readonly WaveSegmentConfig[];
  };
  readonly weapons: WeaponsConfig;
  /** Curva de XP, recogibles y curación por subida (fichero de progresión, plano). */
  readonly progression: XpCurveConfig & PickupRulesConfig & LevelUpHealConfig;
  readonly upgrades: UpgradesConfig;
  /** Duración objetivo de la partida (content/run.json). */
  readonly run: { readonly durationSeconds: number };
  /** Parámetros del mapa (content/map.json, spec procedural-map). */
  readonly map: MapConfig;
  /**
   * Casas y torres goblin (content/structures.json, spec goblin-structures). Sin tipos (válido en
   * el dominio, no en el fichero), ningún mapa tiene estructuras ni se pueden declarar.
   */
  readonly structures: StructuresConfig;
  /** Fuentes de oro, madera y carne (content/resources.json, spec resources, 0022 y 0023). */
  readonly resources: ResourcesConfig;
  /** Ovejas neutrales (content/sheep.json, spec sheep, 0023). */
  readonly sheep: SheepConfig;
  /** Tienda del castillo (content/shop.json, spec castle-shop, 0024). */
  readonly shop: ShopConfig;
  /** Solares y edificios (content/buildings.json, spec build-sites, 0026). */
  readonly buildings: BuildingsConfig;
  /** Ventana y tope del registro de golpes (content/combat.json, 0031). */
  readonly combat: CombatConfig;
}

/** Forma del contenido de mejoras (content/upgrades.json): personaje y arma (ADR-0023). */
export type UpgradesConfig = UpgradeLists;

/** Reglas de la partida ya construidas como value objects del dominio. */
export interface RunRules {
  readonly arena: Arena;
  readonly player: PlayerRules;
  readonly catalog: EnemyCatalog;
  /** Tope de dinamitas, radio visual y duración visible de las explosiones (spec enemy-hazards). */
  readonly hazards: HazardRules;
  readonly table: WaveTable;
  readonly spawn: SpawnRules;
  /** Armas equipadas al empezar, en el orden en que actúan. */
  readonly loadout: WeaponLoadout;
  readonly curve: XpCurve;
  /** Radio, imán y topes por tipo de los recogibles. */
  readonly pickups: PickupRules;
  /** % de la vida máxima que cura cada subida sin mejoras de personaje disponibles (0024). */
  readonly levelUpHealPercent: number;
  /** Catálogo de mejoras en el orden del contenido (ya validado con su build de peor caso). */
  readonly upgrades: UpgradeCatalog;
  /** Cota de pulsos visibles a la vez con la cadencia mínima alcanzable (ADR-0008). */
  readonly pulseCapacity: number;
  /** Duración objetivo: la partida se gana al completar el tick `duration.ticks`. */
  readonly duration: RunDuration;
  /** Rejilla del mapa y parámetros de su generación. */
  readonly map: MapRules;
  /** Tipos de estructura y su colocación. */
  readonly structures: StructureRules;
  /** Drops, montones, vetas, carne y su colocación. */
  readonly resources: ResourceRules;
  /** Ovejas: tope, movimiento, vida, reaparición y colocación. */
  readonly sheep: SheepRules;
  /** Puerta (radio y re-armado) y curación de pago de la tienda. */
  readonly shop: ShopRules;
  /** Solares (colocación y acceso), costes, ingreso de la casa y arma de la torre (0026). */
  readonly buildings: BuildingRules;
  /** Ventana de golpes del snapshot y tope de golpes por tick (0031, ADR-0027). */
  readonly combat: CombatRules;
}

function checkBudgetCoversCatalog(spawn: SpawnRules, catalog: EnemyCatalog): DomainError | null {
  const top = catalog.mostExpensive;
  if (!top || spawn.maxBudget >= top.cost) return null;
  const message = `${MAX_BUDGET_BELOW_MAX_COST}: ${String(top.cost)} (${top.id})`;
  return invalidConfig('waves.maxBudget', message);
}

/**
 * Única implementación de las invariantes y referencias cruzadas del contenido. La usan `Run.start`
 * (defensa) y el `superRefine` de zod (infraestructura), así que las reglas no se duplican.
 */
export function buildRunRules(config: RunConfig): Result<RunRules, DomainError> {
  const arena = Arena.create(config.arena.width, config.arena.height);
  if (!arena.ok) return arena;
  const playerError = checkPlayer(config.player, arena.value);
  if (playerError) return err(playerError);
  const catalog = EnemyCatalog.create(config.enemies.types, arena.value);
  if (!catalog.ok) return catalog;
  const hazards = HazardRules.create(config.enemies.hazards);
  if (!hazards.ok) return hazards;
  const table = WaveTable.create(config.waves.segments, catalog.value);
  if (!table.ok) return table;
  const { maxAlive, maxBudget } = config.waves;
  const spawn = SpawnRules.create({ maxAlive, maxBudget, ...config.waves.spawn });
  if (!spawn.ok) return spawn;
  const budgetError = checkBudgetCoversCatalog(spawn.value, catalog.value);
  if (budgetError) return err(budgetError);
  const loadout = WeaponLoadout.create(config.weapons);
  if (!loadout.ok) return loadout;
  const curve = XpCurve.create(config.progression);
  if (!curve.ok) return curve;
  const pickups = PickupRules.create(config.progression);
  if (!pickups.ok) return pickups;
  const healError = checkLevelUpHeal(config.progression);
  if (healError) return err(healError);
  const upgrades = UpgradeCatalog.create(
    config.upgrades,
    loadout.value,
    config.player,
    arena.value,
  );
  if (!upgrades.ok) return upgrades;
  const duration = RunDuration.create(config.run.durationSeconds);
  if (!duration.ok) return duration;
  const map = MapRules.create(config.map, arena.value, config.player.radius);
  if (!map.ok) return map;
  const structures = StructureRules.create(config.structures, map.value, catalog.value);
  if (!structures.ok) return structures;
  const resources = ResourceRules.create(config.resources, catalog.value, structures.value);
  if (!resources.ok) return resources;
  const meatError = upgrades.value.checkMeatHeal(resources.value.meat.healPercent);
  if (meatError) return err(meatError);
  if (pickups.value.maxWood < resources.value.woodPiles.count) {
    return err(invalidConfig('progression.maxWood', MAX_WOOD_BELOW_WOOD_PILES));
  }
  const sheep = SheepRules.create(config.sheep);
  if (!sheep.ok) return sheep;
  const shop = ShopRules.create(config.shop);
  if (!shop.ok) return shop;
  if (upgrades.value.indexOf(shop.value.heal.id) >= 0) {
    const message = `${SHOP_HEAL_ID_TAKEN}: ${shop.value.heal.id}`;
    return err(invalidConfig('shop.heal.id', message));
  }
  const buildings = BuildingRules.create(config.buildings);
  if (!buildings.ok) return buildings;
  const combat = CombatRules.create(config.combat);
  if (!combat.ok) return combat;
  return ok({
    arena: arena.value,
    player: config.player,
    catalog: catalog.value,
    hazards: hazards.value,
    table: table.value,
    spawn: spawn.value,
    loadout: loadout.value,
    curve: curve.value,
    pickups: pickups.value,
    levelUpHealPercent: config.progression.levelUpHealPercent,
    upgrades: upgrades.value,
    pulseCapacity: upgrades.value.pulseCapacity,
    duration: duration.value,
    map: map.value,
    structures: structures.value,
    resources: resources.value,
    sheep: sheep.value,
    shop: shop.value,
    buildings: buildings.value,
    combat: combat.value,
  });
}
