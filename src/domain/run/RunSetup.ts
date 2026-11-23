import type { Arena } from '../arena/Arena';
import { Enemy } from '../enemy/Enemy';
import type { GameMap } from '../map/GameMap';
import type { EnemyCatalog } from '../enemy/EnemyCatalog';
import { Player } from '../player/Player';
import { Experience } from '../progression/Experience';
import { GemField } from '../progression/GemField';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { Vector2 } from '../shared/Vector2';
import { UpgradeBoard } from '../upgrade/UpgradeBoard';
import { UNKNOWN_ENEMY_TYPE } from '../wave/WaveTable';
import type { RunRules } from './RunConfig';

export const SETUP_POSITION_MUST_BE_FINITE = 'La posición inicial debe ser finita.';
export const SETUP_HEALTH_OUT_OF_RANGE =
  'La vida inicial de un enemigo debe ser finita, positiva y no mayor que la de su tipo.';
export const SETUP_GEM_VALUE_MUST_BE_INTEGER =
  'El valor de una gema inicial debe ser un entero ≥ 1.';
export const SETUP_TOO_MANY_GEMS = 'Hay más gemas iniciales que el tope de gemas en el suelo.';
export const SETUP_EXPERIENCE_OUT_OF_RANGE =
  'La experiencia inicial necesita un nivel entero ≥ 1 y una XP entera en [0, xpToNext).';
export const SETUP_UNKNOWN_UPGRADE = 'Mejora inicial desconocida en el catálogo.';
export const SETUP_PLAYER_ON_BLOCKED_CELL =
  'El jugador inicial no puede solapar una celda no caminable del mapa.';
export const SETUP_KILLS_MUST_BE_INTEGER = 'Las bajas iniciales deben ser un entero ≥ 0.';
export const SETUP_UPGRADE_LEVEL_OUT_OF_RANGE =
  'El nivel inicial de una mejora debe ser un entero en [0, maxLevel].';

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Estado inicial opcional (tests, bench y futuros editores; la composición no lo usa): posición del
 * jugador, enemigos ya presentes, gemas en el suelo, experiencia y niveles de mejora. Los tipos se validan contra el
 * catálogo y las posiciones de jugador y enemigos se recortan a la arena.
 */
export interface RunSetup {
  readonly player?: Point;
  /** `health`: vida inicial opcional, 0 < health ≤ la del tipo (por defecto, la del tipo). */
  readonly enemies?: readonly (Point & { readonly type: string; readonly health?: number })[];
  /** Gemas en el suelo, en orden de creación (ids desde 0); `attracted` por defecto false. */
  readonly gems?: readonly (Point & { readonly value: number; readonly attracted?: boolean })[];
  /** Nivel y XP iniciales (por defecto, nivel 1 con XP 0), sin subidas pendientes. */
  readonly experience?: { readonly level: number; readonly xp: number };
  /**
   * Niveles iniciales de mejora por id (por defecto, 0), con sus efectos ya aplicados al empezar:
   * como si se hubieran elegido antes del tick 1 (la vida máxima sube y la vida empieza llena).
   */
  readonly upgrades?: Readonly<Record<string, number>>;
  /** Bajas ya acumuladas al empezar (entero ≥ 0; por defecto, 0). */
  readonly kills?: number;
}

const isFinitePoint = (p: Point): boolean => Number.isFinite(p.x) && Number.isFinite(p.y);

export function initialPlayer(
  rules: RunRules,
  setup: RunSetup,
  map: GameMap,
): Result<Player, DomainError> {
  const { arena, player } = rules;
  const at = setup.player;
  if (at && !isFinitePoint(at)) {
    return err(invalidConfig('setup.player', SETUP_POSITION_MUST_BE_FINITE));
  }
  const position = at ? arena.clampCircle(Vector2.of(at.x, at.y), player.radius) : arena.center;
  if (map.overlapsBlocked(position.x, position.y, player.radius)) {
    return err(invalidConfig('setup.player', SETUP_PLAYER_ON_BLOCKED_CELL));
  }
  return ok(Player.spawn(position, player));
}

export function initialEnemies(
  setup: RunSetup,
  catalog: EnemyCatalog,
  arena: Arena,
): Result<Enemy[], DomainError> {
  const enemies: Enemy[] = [];
  for (const [i, entry] of (setup.enemies ?? []).entries()) {
    const path = `setup.enemies.${String(i)}`;
    const type = catalog.get(entry.type);
    if (!type) return err(invalidConfig(`${path}.type`, `${UNKNOWN_ENEMY_TYPE}: ${entry.type}`));
    if (!isFinitePoint(entry)) return err(invalidConfig(path, SETUP_POSITION_MUST_BE_FINITE));
    const health = entry.health ?? type.health;
    if (!Number.isFinite(health) || health <= 0 || health > type.health) {
      return err(invalidConfig(`${path}.health`, SETUP_HEALTH_OUT_OF_RANGE));
    }
    enemies.push(Enemy.spawn(i, type, entry.x, entry.y, arena, health));
  }
  return ok(enemies);
}

export function initialGems(
  rules: RunRules,
  setup: RunSetup,
  map: GameMap,
): Result<GemField, DomainError> {
  const entries = setup.gems ?? [];
  if (entries.length > rules.gems.maxGems) {
    return err(invalidConfig('setup.gems', SETUP_TOO_MANY_GEMS));
  }
  const field = new GemField(rules.gems, map);
  for (const [i, g] of entries.entries()) {
    const path = `setup.gems.${String(i)}`;
    if (!isFinitePoint(g)) return err(invalidConfig(path, SETUP_POSITION_MUST_BE_FINITE));
    if (!Number.isInteger(g.value) || g.value < 1) {
      return err(invalidConfig(`${path}.value`, SETUP_GEM_VALUE_MUST_BE_INTEGER));
    }
    field.drop(g.x, g.y, g.value, g.attracted ?? false);
  }
  return ok(field);
}

export function initialBoard(rules: RunRules, setup: RunSetup): Result<UpgradeBoard, DomainError> {
  const start = setup.upgrades ?? {};
  const { upgrades } = rules.upgrades;
  for (const [id, level] of Object.entries(start)) {
    const u = upgrades.find((x) => x.id === id);
    if (!u) return err(invalidConfig(`setup.upgrades.${id}`, SETUP_UNKNOWN_UPGRADE));
    if (!Number.isInteger(level) || level < 0 || level > u.maxLevel) {
      return err(invalidConfig(`setup.upgrades.${id}`, SETUP_UPGRADE_LEVEL_OUT_OF_RANGE));
    }
  }
  return ok(
    new UpgradeBoard(
      rules.upgrades,
      upgrades.map((u) => start[u.id] ?? 0),
    ),
  );
}

export function initialExperience(
  rules: RunRules,
  setup: RunSetup,
): Result<Experience, DomainError> {
  const start = setup.experience;
  if (!start) return ok(new Experience(rules.curve));
  const { level, xp } = start;
  const valid =
    Number.isInteger(level) &&
    level >= 1 &&
    Number.isInteger(xp) &&
    xp >= 0 &&
    xp < rules.curve.toNext(level);
  if (!valid) return err(invalidConfig('setup.experience', SETUP_EXPERIENCE_OUT_OF_RANGE));
  return ok(new Experience(rules.curve, level, xp));
}

/** Estado inicial ya validado con el que arranca `Run`. */
export interface InitialState {
  readonly player: Player;
  readonly enemies: Enemy[];
  readonly gems: GemField;
  readonly experience: Experience;
  readonly board: UpgradeBoard;
  /** Bajas ya acumuladas (por defecto, 0). */
  readonly kills: number;
}

/** Valida el `RunSetup` contra las reglas y construye el estado inicial de la partida. */
export function initialState(
  rules: RunRules,
  setup: RunSetup,
  map: GameMap,
): Result<InitialState, DomainError> {
  const player = initialPlayer(rules, setup, map);
  if (!player.ok) return player;
  const enemies = initialEnemies(setup, rules.catalog, rules.arena);
  if (!enemies.ok) return enemies;
  const gems = initialGems(rules, setup, map);
  if (!gems.ok) return gems;
  const experience = initialExperience(rules, setup);
  if (!experience.ok) return experience;
  const board = initialBoard(rules, setup);
  if (!board.ok) return board;
  const kills = setup.kills ?? 0;
  if (!Number.isInteger(kills) || kills < 0) {
    return err(invalidConfig('setup.kills', SETUP_KILLS_MUST_BE_INTEGER));
  }
  return ok({
    player: player.value,
    enemies: enemies.value,
    gems: gems.value,
    experience: experience.value,
    board: board.value,
    kills,
  });
}
