import { Arena } from '../arena/Arena';
import { View } from '../arena/View';
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
    readonly view: { readonly width: number; readonly height: number };
  };
  readonly player: PlayerRules;
  readonly enemies: { readonly types: readonly EnemyTypeConfig[] };
  readonly waves: {
    readonly maxAlive: number;
    readonly maxBudget: number;
    readonly spawn: {
      readonly margin: number;
      readonly minDistance: number;
      readonly maxAttempts: number;
    };
    readonly segments: readonly WaveSegmentConfig[];
  };
  readonly weapons: WeaponsConfig;
}

/** Reglas de la partida ya construidas como value objects del dominio. */
export interface RunRules {
  readonly arena: Arena;
  readonly view: View;
  readonly player: PlayerRules;
  readonly catalog: EnemyCatalog;
  readonly table: WaveTable;
  readonly spawn: SpawnRules;
  /** Armas equipadas al empezar, en el orden en que actúan. */
  readonly loadout: WeaponLoadout;
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
  const view = View.create(config.arena.view.width, config.arena.view.height);
  if (!view.ok) return view;
  const playerError = checkPlayer(config.player, arena.value);
  if (playerError) return err(playerError);
  const catalog = EnemyCatalog.create(config.enemies.types, arena.value);
  if (!catalog.ok) return catalog;
  const table = WaveTable.create(config.waves.segments, catalog.value);
  if (!table.ok) return table;
  const { maxAlive, maxBudget } = config.waves;
  const spawn = SpawnRules.create({ maxAlive, maxBudget, ...config.waves.spawn }, view.value);
  if (!spawn.ok) return spawn;
  const budgetError = checkBudgetCoversCatalog(spawn.value, catalog.value);
  if (budgetError) return err(budgetError);
  const loadout = WeaponLoadout.create(config.weapons);
  if (!loadout.ok) return loadout;
  return ok({
    arena: arena.value,
    view: view.value,
    player: config.player,
    catalog: catalog.value,
    table: table.value,
    spawn: spawn.value,
    loadout: loadout.value,
  });
}
