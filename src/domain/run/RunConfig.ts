import { Arena } from '../arena/Arena';
import { View } from '../arena/View';
import { EnemyCatalog } from '../enemy/EnemyCatalog';
import type { EnemyTypeConfig } from '../enemy/EnemyType';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { SpawnRules } from '../wave/SpawnRules';
import { WaveTable, type WaveSegmentConfig } from '../wave/WaveTable';

/** Mensajes de las invariantes del jugador; la validación de contenido (zod) usa los mismos. */
export const SPEED_MUST_BE_POSITIVE = 'La velocidad del jugador debe ser positiva.';
export const RADIUS_MUST_FIT = 'El radio del jugador no cabe en la arena.';
export const PLAYER_HEALTH_MUST_BE_POSITIVE = 'La vida máxima del jugador debe ser positiva.';
export const INVULNERABILITY_TICKS_MUST_BE_INTEGER =
  'La invulnerabilidad tras un golpe debe durar un número entero de ticks ≥ 1.';
/** Regla cruzada: con un máximo menor, el tipo más caro nunca reuniría su coste. */
export const MAX_BUDGET_BELOW_MAX_COST =
  'El máximo de presupuesto debe ser ≥ el coste del tipo de enemigo más caro';

/** Parámetros del jugador en el contenido (content/player.json). */
export interface PlayerRules {
  readonly speed: number;
  readonly radius: number;
  readonly maxHealth: number;
  /** N: tras un golpe en el tick t, los contactos de t + 1 a t + N no hacen daño. */
  readonly invulnerabilityTicks: number;
}

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
}

/** Reglas de la partida ya construidas como value objects del dominio. */
export interface RunRules {
  readonly arena: Arena;
  readonly view: View;
  readonly player: PlayerRules;
  readonly catalog: EnemyCatalog;
  readonly table: WaveTable;
  readonly spawn: SpawnRules;
}

function checkPlayer(config: RunConfig, arena: Arena): DomainError | null {
  const { speed, radius, maxHealth, invulnerabilityTicks } = config.player;
  if (!Number.isFinite(speed) || speed <= 0) {
    return invalidConfig('player.speed', SPEED_MUST_BE_POSITIVE);
  }
  if (!arena.fits(radius)) return invalidConfig('player.radius', RADIUS_MUST_FIT);
  if (!Number.isFinite(maxHealth) || maxHealth <= 0) {
    return invalidConfig('player.maxHealth', PLAYER_HEALTH_MUST_BE_POSITIVE);
  }
  if (!Number.isInteger(invulnerabilityTicks) || invulnerabilityTicks < 1) {
    return invalidConfig('player.invulnerabilityTicks', INVULNERABILITY_TICKS_MUST_BE_INTEGER);
  }
  return null;
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
  const playerError = checkPlayer(config, arena.value);
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
  return ok({
    arena: arena.value,
    view: view.value,
    player: config.player,
    catalog: catalog.value,
    table: table.value,
    spawn: spawn.value,
  });
}
