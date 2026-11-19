import type { Arena } from '../arena/Arena';
import { Enemy } from '../enemy/Enemy';
import type { EnemyCatalog } from '../enemy/EnemyCatalog';
import { Player } from '../player/Player';
import { Experience } from '../progression/Experience';
import { GemField } from '../progression/GemField';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { Vector2 } from '../shared/Vector2';
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

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Estado inicial opcional (tests, bench y futuros editores; la composición no lo usa): posición del
 * jugador, enemigos ya presentes, gemas en el suelo y experiencia. Los tipos se validan contra el
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
}

const isFinitePoint = (p: Point): boolean => Number.isFinite(p.x) && Number.isFinite(p.y);

export function initialPlayer(rules: RunRules, setup: RunSetup): Result<Player, DomainError> {
  const { arena, player } = rules;
  const at = setup.player;
  if (at && !isFinitePoint(at)) {
    return err(invalidConfig('setup.player', SETUP_POSITION_MUST_BE_FINITE));
  }
  const position = at ? arena.clampCircle(Vector2.of(at.x, at.y), player.radius) : arena.center;
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

export function initialGems(rules: RunRules, setup: RunSetup): Result<GemField, DomainError> {
  const entries = setup.gems ?? [];
  if (entries.length > rules.gems.maxGems) {
    return err(invalidConfig('setup.gems', SETUP_TOO_MANY_GEMS));
  }
  const field = new GemField(rules.gems);
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
