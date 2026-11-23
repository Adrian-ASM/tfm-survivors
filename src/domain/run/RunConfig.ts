import { Arena } from '../arena/Arena';
import { EnemyCatalog } from '../enemy/EnemyCatalog';
import type { EnemyTypeConfig } from '../enemy/EnemyType';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { SpawnRules } from '../wave/SpawnRules';
import { WaveTable, type WaveSegmentConfig } from '../wave/WaveTable';
import { WeaponLoadout, type WeaponsConfig } from '../weapon/WeaponLoadout';
import {
  INVULNERABILITY_TICKS_MUST_BE_INTEGER,
  PICKUP_RADIUS_MUST_BE_POSITIVE,
  PLAYER_HEALTH_MUST_BE_POSITIVE,
  RADIUS_MUST_FIT,
  SPEED_MUST_BE_POSITIVE,
  checkPlayer,
  type PlayerRules,
} from '../player/PlayerRules';
import { GemRules, type GemRulesConfig } from '../progression/GemRules';
import { XpCurve, type XpCurveConfig } from '../progression/XpCurve';
import { UpgradeCatalog } from '../upgrade/UpgradeCatalog';
import type { UpgradeTypeConfig } from '../upgrade/UpgradeType';
import { RunDuration } from './RunDuration';
import { MapRules, type MapConfig } from '../map/MapRules';

export type { WeaponsConfig, PlayerRules };
export {
  INVULNERABILITY_TICKS_MUST_BE_INTEGER,
  PICKUP_RADIUS_MUST_BE_POSITIVE,
  PLAYER_HEALTH_MUST_BE_POSITIVE,
  RADIUS_MUST_FIT,
  SPEED_MUST_BE_POSITIVE,
  checkPlayer,
};

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
  readonly enemies: { readonly types: readonly EnemyTypeConfig[] };
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
  /** Curva de XP y gemas (fichero de progresión, plano). */
  readonly progression: XpCurveConfig & GemRulesConfig;
  readonly upgrades: UpgradesConfig;
  /** Duración objetivo de la partida (content/run.json). */
  readonly run: { readonly durationSeconds: number };
  /** Parámetros del mapa (content/map.json, spec procedural-map). */
  readonly map: MapConfig;
}

/** Forma del contenido de mejoras (content/upgrades.json). */
export interface UpgradesConfig {
  readonly upgrades: readonly UpgradeTypeConfig[];
}

/** Reglas de la partida ya construidas como value objects del dominio. */
export interface RunRules {
  readonly arena: Arena;
  readonly player: PlayerRules;
  readonly catalog: EnemyCatalog;
  readonly table: WaveTable;
  readonly spawn: SpawnRules;
  /** Armas equipadas al empezar, en el orden en que actúan. */
  readonly loadout: WeaponLoadout;
  readonly curve: XpCurve;
  readonly gems: GemRules;
  /** Catálogo de mejoras en el orden del contenido (ya validado con su build de peor caso). */
  readonly upgrades: UpgradeCatalog;
  /** Cota de pulsos visibles a la vez con la cadencia mínima alcanzable (ADR-0008). */
  readonly pulseCapacity: number;
  /** Duración objetivo: la partida se gana al completar el tick `duration.ticks`. */
  readonly duration: RunDuration;
  /** Rejilla del mapa y parámetros de su generación. */
  readonly map: MapRules;
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
  const gems = GemRules.create(config.progression);
  if (!gems.ok) return gems;
  const upgrades = UpgradeCatalog.create(
    config.upgrades.upgrades,
    loadout.value,
    config.player,
    arena.value,
  );
  if (!upgrades.ok) return upgrades;
  const duration = RunDuration.create(config.run.durationSeconds);
  if (!duration.ok) return duration;
  const map = MapRules.create(config.map, arena.value, config.player.radius);
  if (!map.ok) return map;
  return ok({
    arena: arena.value,
    player: config.player,
    catalog: catalog.value,
    table: table.value,
    spawn: spawn.value,
    loadout: loadout.value,
    curve: curve.value,
    gems: gems.value,
    upgrades: upgrades.value,
    pulseCapacity: upgrades.value.pulseCapacity,
    duration: duration.value,
    map: map.value,
  });
}
