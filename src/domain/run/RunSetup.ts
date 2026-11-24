import type { Arena } from '../arena/Arena';
import { Enemy } from '../enemy/Enemy';
import type { GameMap } from '../map/GameMap';
import type { EnemyCatalog } from '../enemy/EnemyCatalog';
import type { EnemyType } from '../enemy/EnemyType';
import { Player } from '../player/Player';
import { Experience } from '../progression/Experience';
import { GemField } from '../progression/GemField';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { Vector2 } from '../shared/Vector2';
import { UpgradeBoard } from '../upgrade/UpgradeBoard';
import { UNKNOWN_ENEMY_TYPE } from '../wave/WaveTable';
import type { RunRules } from './RunConfig';
import { Structure } from '../structure/Structure';
import type { StructureSite } from '../structure/StructureSite';

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
export const SETUP_STATE_UNKNOWN = 'Estado de comportamiento inicial que el tipo no declara.';
export const SETUP_ELAPSED_OUT_OF_RANGE =
  'Los ticks ya pasados en el estado inicial deben ser un entero en [0, duración del estado).';
export const SETUP_TOO_MANY_DYNAMITES = 'Hay más dinamitas iniciales que el tope de dinamitas.';
export const SETUP_DYNAMITE_TICKS_LEFT =
  'Los ticks que le quedan a una dinamita inicial deben ser un entero ≥ 1.';
export const SETUP_DYNAMITE_BLAST_MUST_BE_POSITIVE =
  'El radio y el daño de una dinamita inicial deben ser positivos.';
export const SETUP_TOO_MANY_STRUCTURES =
  'Hay más estructuras iniciales que estructuras en el mapa.';
export const SETUP_STRUCTURE_HEALTH_OUT_OF_RANGE =
  'La vida inicial de una estructura debe ser finita y estar entre 0 y la de su tipo.';
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
  readonly enemies?: readonly (Point & {
    readonly type: string;
    readonly health?: number;
    /** Estado inicial por nombre (por defecto, el inicial del tipo) y ticks ya pasados en él. */
    readonly state?: string;
    readonly elapsed?: number;
  })[];
  /**
   * Dinamitas en vuelo (como mucho `maxDynamites`): lanzadas "en el tick 0" desde (x, y) hacia
   * (targetX, targetY); explotan en el tick `ticksLeft` con su radio y daño.
   */
  readonly dynamites?: readonly SetupDynamite[];
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
  /**
   * Por índice de la lista de estructuras de la partida (tests): vida inicial en [0, la de su tipo]
   * (0 = ya destruida). Como mucho tantas entradas como estructuras.
   */
  readonly structures?: readonly { readonly health?: number }[];
}

/** Dinamita inicial de `RunSetup` (tests y bench). */
export interface SetupDynamite extends Point {
  readonly targetX: number;
  readonly targetY: number;
  readonly ticksLeft: number;
  readonly radius: number;
  readonly damage: number;
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
  // Sin posición dada, el jugador nace en la salida del mapa (spec player-movement 0016): el
  // centro del mundo en el mapa vacío y en los explícitos sin salida declarada.
  const position = at
    ? arena.clampCircle(Vector2.of(at.x, at.y), player.radius)
    : Vector2.of(map.start.x, map.start.y);
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
    const state = initialStateOf(type, entry.state, entry.elapsed, path);
    if (!state.ok) return state;
    const { index, since } = state.value;
    enemies.push(Enemy.spawn(i, type, entry.x, entry.y, arena, health, index, since));
  }
  return ok(enemies);
}

/** Estado de comportamiento inicial de un enemigo de `RunSetup`: `since` = −elapsed. */
function initialStateOf(
  type: EnemyType,
  name: string | undefined,
  elapsed: number | undefined,
  path: string,
): Result<{ index: number; since: number }, DomainError> {
  const b = type.behavior;
  const index = name === undefined ? b.initial : b.names.indexOf(name);
  if (index < 0) return err(invalidConfig(`${path}.state`, SETUP_STATE_UNKNOWN));
  const passed = elapsed ?? 0;
  const ticks = b.ticks[index] ?? 0;
  const valid = Number.isInteger(passed) && passed >= 0 && (ticks === 0 || passed < ticks);
  if (!valid) return err(invalidConfig(`${path}.elapsed`, SETUP_ELAPSED_OUT_OF_RANGE));
  return ok({ index, since: -passed });
}

/** Valida las dinamitas iniciales contra el tope (sin crearlas: las crea `HazardField`). */
export function initialDynamites(
  rules: RunRules,
  setup: RunSetup,
): Result<readonly SetupDynamite[], DomainError> {
  const entries = setup.dynamites ?? [];
  if (entries.length > rules.hazards.maxDynamites) {
    return err(invalidConfig('setup.dynamites', SETUP_TOO_MANY_DYNAMITES));
  }
  for (const [i, d] of entries.entries()) {
    const path = `setup.dynamites.${String(i)}`;
    const target = { x: d.targetX, y: d.targetY };
    if (!isFinitePoint(d) || !isFinitePoint(target)) {
      return err(invalidConfig(path, SETUP_POSITION_MUST_BE_FINITE));
    }
    if (!Number.isInteger(d.ticksLeft) || d.ticksLeft < 1) {
      return err(invalidConfig(`${path}.ticksLeft`, SETUP_DYNAMITE_TICKS_LEFT));
    }
    const positive = (v: number) => Number.isFinite(v) && v > 0;
    if (!positive(d.radius) || !positive(d.damage)) {
      return err(invalidConfig(path, SETUP_DYNAMITE_BLAST_MUST_BE_POSITIVE));
    }
  }
  return ok(entries);
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

/** Casas y torres de la partida con la vida de su tipo o la de `RunSetup`. */
export function initialStructures(
  setup: RunSetup,
  sites: readonly StructureSite[],
): Result<Structure[], DomainError> {
  const entries = setup.structures ?? [];
  if (entries.length > sites.length) {
    return err(invalidConfig('setup.structures', SETUP_TOO_MANY_STRUCTURES));
  }
  const structures: Structure[] = [];
  for (const [i, site] of sites.entries()) {
    const health = entries[i]?.health ?? site.type.health;
    if (!Number.isFinite(health) || health < 0 || health > site.type.health) {
      const field = `setup.structures.${String(i)}.health`;
      return err(invalidConfig(field, SETUP_STRUCTURE_HEALTH_OUT_OF_RANGE));
    }
    structures.push(new Structure(site, health));
  }
  return ok(structures);
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
  /** Dinamitas en vuelo ya validadas. */
  readonly dynamites: readonly SetupDynamite[];
  /** Casas y torres en el orden de la lista (ruinas incluidas). */
  readonly structures: Structure[];
}

/** Valida el `RunSetup` contra las reglas y construye el estado inicial de la partida. */
export function initialState(
  rules: RunRules,
  setup: RunSetup,
  map: GameMap,
  sites: readonly StructureSite[] = [],
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
  const dynamites = initialDynamites(rules, setup);
  if (!dynamites.ok) return dynamites;
  const structures = initialStructures(setup, sites);
  if (!structures.ok) return structures;
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
    dynamites: dynamites.value,
    structures: structures.value,
  });
}
