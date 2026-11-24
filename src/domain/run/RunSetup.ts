import type { Arena } from '../arena/Arena';
import { Enemy } from '../enemy/Enemy';
import type { GameMap } from '../map/GameMap';
import type { EnemyCatalog } from '../enemy/EnemyCatalog';
import type { EnemyType } from '../enemy/EnemyType';
import { GuardPost } from '../enemy/GuardPost';
import { Player } from '../player/Player';
import { Experience } from '../progression/Experience';
import { PickupField } from '../pickup/PickupField';
import type { PickupKind } from '../pickup/PickupKind';
import { Stockpile } from '../resource/Stockpile';
import { GoldVein } from '../resource/GoldVein';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { Vector2 } from '../shared/Vector2';
import { UpgradeBoard } from '../upgrade/UpgradeBoard';
import { maxHealthBonus } from '../upgrade/upgradeStats';
import { UNKNOWN_ENEMY_TYPE } from '../wave/WaveTable';
import type { RunRules } from './RunConfig';
import { Structure } from '../structure/Structure';
import type { StructureSite } from '../structure/StructureSite';
import { Flock } from '../sheep/Flock';
import type { SheepSites } from '../sheep/resolveSheep';

export const SETUP_POSITION_MUST_BE_FINITE = 'La posición inicial debe ser finita.';
export const SETUP_HEALTH_OUT_OF_RANGE =
  'La vida inicial de un enemigo debe ser finita, positiva y no mayor que la de su tipo.';
export const SETUP_GEM_VALUE_MUST_BE_INTEGER =
  'El valor de una gema inicial debe ser un entero ≥ 1.';
export const SETUP_TOO_MANY_GEMS =
  'Hay más recogibles iniciales de un tipo que el tope de ese tipo en el suelo.';
export const SETUP_RESOURCES_MUST_BE_INTEGER =
  'El oro y la madera iniciales deben ser enteros ≥ 0.';
export const SETUP_TOO_MANY_VEINS = 'Hay más vetas iniciales que vetas en el mapa.';
export const SETUP_VEIN_GOLD_MUST_BE_INTEGER = 'El oro de una veta inicial debe ser un entero ≥ 1.';
export const SETUP_EXPERIENCE_OUT_OF_RANGE =
  'La experiencia inicial necesita un nivel entero ≥ 1 y una XP entera en [0, xpToNext).';
export const SETUP_UNKNOWN_UPGRADE = 'Mejora inicial desconocida en el catálogo.';
export const SETUP_PLAYER_ON_BLOCKED_CELL =
  'El jugador inicial no puede solapar una celda no caminable del mapa.';
export const SETUP_PLAYER_HEALTH_OUT_OF_RANGE =
  'La vida inicial del jugador debe ser un entero entre 1 y su vida máxima efectiva.';
export const SETUP_TOO_MANY_SHEEP = 'Hay más ovejas iniciales que ovejas en el mapa.';
export const SETUP_SHEEP_HEALTH_OUT_OF_RANGE =
  'La vida inicial de una oveja debe ser un entero entre 1 y la del contenido.';
export const SETUP_KILLS_MUST_BE_INTEGER = 'Las bajas iniciales deben ser un entero ≥ 0.';
export const SETUP_STATE_UNKNOWN = 'Estado de comportamiento inicial que el tipo no declara.';
export const SETUP_ELAPSED_OUT_OF_RANGE =
  'Los ticks ya pasados en el estado inicial deben ser un entero en [0, duración del estado).';
export const SETUP_TOO_MANY_DYNAMITES = 'Hay más dinamitas iniciales que el tope de dinamitas.';
export const SETUP_DYNAMITE_TICKS_LEFT =
  'Los ticks que le quedan a una dinamita inicial deben ser un entero ≥ 1.';
export const SETUP_DYNAMITE_BLAST_MUST_BE_POSITIVE =
  'El radio y el daño de una dinamita inicial deben ser positivos.';
export const SETUP_GUARD_NEEDS_POST =
  'Un guardia (tipo que empieza en patrulla) necesita exactamente uno: puesto (post) o casa (house).';
export const SETUP_POST_NOT_GUARD = 'Solo un guardia puede tener puesto o casa.';
export const SETUP_HOUSE_UNKNOWN = 'La casa de un guardia debe ser una casa de la partida.';
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
  /**
   * Posición del jugador y, opcional, su vida actual al empezar (entero en [1, vida máxima
   * efectiva], tras las mejoras iniciales; por defecto, llena). Escenarios de curación (0023).
   */
  readonly player?: Point & { readonly health?: number };
  /** `health`: vida inicial opcional, 0 < health ≤ la del tipo (por defecto, la del tipo). */
  readonly enemies?: readonly (Point & {
    readonly type: string;
    readonly health?: number;
    /** Estado inicial por nombre (por defecto, el inicial del tipo) y ticks ya pasados en él. */
    readonly state?: string;
    readonly elapsed?: number;
    /**
     * Solo los guardias (tipos que empiezan en patrulla), y exactamente uno de los dos: su puesto
     * (`post`) o el índice de su casa en la lista de estructuras (`house`, cuenta en su tope).
     */
    readonly post?: Point;
    readonly house?: number;
  })[];
  /**
   * Dinamitas en vuelo (como mucho `maxDynamites`): lanzadas "en el tick 0" desde (x, y) hacia
   * (targetX, targetY); explotan en el tick `ticksLeft` con su radio y daño.
   */
  readonly dynamites?: readonly SetupDynamite[];
  /**
   * Recogibles en el suelo, en orden de creación (ids tras los montones del mapa); `kind` por
   * defecto `xp` (gemas) y `attracted` por defecto false.
   */
  readonly gems?: readonly (Point & {
    readonly value: number;
    readonly attracted?: boolean;
    readonly kind?: PickupKind;
  })[];
  /** Oro y madera ya acumulados al empezar (enteros ≥ 0; por defecto, 0). */
  readonly resources?: { readonly gold: number; readonly wood: number };
  /**
   * Por índice de la lista de vetas de la partida (tests): oro (entero ≥ 1; por defecto, el del
   * contenido) y si ya está agotada (por defecto, activa). Como mucho tantas entradas como vetas.
   */
  readonly veins?: readonly { readonly gold?: number; readonly depleted?: boolean }[];
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
  /**
   * Por índice de la lista de ovejas del tick 0 (tests, 0023): vida inicial (entero en [1, la del
   * contenido]) y punto de origen (por defecto, su posición). Como mucho tantas entradas como ovejas.
   */
  readonly sheep?: readonly { readonly health?: number; readonly origin?: Point }[];
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

type SetupEnemy = NonNullable<RunSetup['enemies']>[number];

/**
 * Puesto de un enemigo de `RunSetup` (ADR-0020): un guardia necesita exactamente uno de `post` o
 * `house` (que cuenta en el tope de esa casa) y cualquier otro tipo no puede tener ninguno.
 */
function postOf(
  entry: SetupEnemy,
  type: EnemyType,
  path: string,
  map: GameMap,
  arena: Arena,
  structures: readonly Structure[],
): Result<GuardPost | null, DomainError> {
  const given = (entry.post ? 1 : 0) + (entry.house === undefined ? 0 : 1);
  if (!type.behavior.isGuard) {
    return given === 0 ? ok(null) : err(invalidConfig(path, SETUP_POST_NOT_GUARD));
  }
  if (given !== 1) return err(invalidConfig(path, SETUP_GUARD_NEEDS_POST));
  if (entry.post) {
    if (!isFinitePoint(entry.post)) {
      return err(invalidConfig(`${path}.post`, SETUP_POSITION_MUST_BE_FINITE));
    }
    return ok(new GuardPost(entry.post.x, entry.post.y, type, map, arena));
  }
  const house = structures[entry.house ?? -1]?.post;
  if (!house) return err(invalidConfig(`${path}.house`, SETUP_HOUSE_UNKNOWN));
  house.take();
  return ok(house);
}

export function initialEnemies(
  setup: RunSetup,
  catalog: EnemyCatalog,
  arena: Arena,
  map: GameMap,
  structures: readonly Structure[] = [],
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
    const post = postOf(entry, type, path, map, arena, structures);
    if (!post.ok) return post;
    const { index, since } = state.value;
    enemies.push(Enemy.spawn(i, type, entry.x, entry.y, arena, health, index, since, post.value));
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

/**
 * Recogibles iniciales: primero un `wood` por montón del mapa (`piles`, en su orden y con la madera
 * por montón), después los de `RunSetup.gems`. Cada tipo, como mucho su tope.
 */
export function initialPickups(
  rules: RunRules,
  setup: RunSetup,
  map: GameMap,
  piles: readonly Point[] = [],
): Result<PickupField, DomainError> {
  const entries = setup.gems ?? [];
  const field = new PickupField(rules.pickups, map);
  for (const p of piles) field.drop('wood', p.x, p.y, rules.resources.woodPiles.wood);
  for (const [i, g] of entries.entries()) {
    const path = `setup.gems.${String(i)}`;
    if (!isFinitePoint(g)) return err(invalidConfig(path, SETUP_POSITION_MUST_BE_FINITE));
    if (!Number.isInteger(g.value) || g.value < 1) {
      return err(invalidConfig(`${path}.value`, SETUP_GEM_VALUE_MUST_BE_INTEGER));
    }
    const kind = g.kind ?? 'xp';
    if (field.count(kind) >= rules.pickups.max(kind)) {
      return err(invalidConfig('setup.gems', SETUP_TOO_MANY_GEMS));
    }
    field.drop(kind, g.x, g.y, g.value, g.attracted ?? false);
  }
  return ok(field);
}

/** Vetas de la partida en su orden, con el oro y el radio del contenido o los de `RunSetup`. */
export function initialVeins(
  rules: RunRules,
  setup: RunSetup,
  sites: readonly Point[],
): Result<GoldVein[], DomainError> {
  const entries = setup.veins ?? [];
  if (entries.length > sites.length) {
    return err(invalidConfig('setup.veins', SETUP_TOO_MANY_VEINS));
  }
  const { gold, radius } = rules.resources.goldVeins;
  const veins: GoldVein[] = [];
  for (const [i, p] of sites.entries()) {
    const entry = entries[i] ?? {};
    const value = entry.gold ?? gold;
    if (!Number.isInteger(value) || value < 1) {
      return err(invalidConfig(`setup.veins.${String(i)}.gold`, SETUP_VEIN_GOLD_MUST_BE_INTEGER));
    }
    veins.push(new GoldVein(i, p.x, p.y, radius, value, entry.depleted ?? false));
  }
  return ok(veins);
}

/** Oro y madera iniciales (por defecto, 0). */
export function initialStockpile(setup: RunSetup): Result<Stockpile, DomainError> {
  const { gold, wood } = setup.resources ?? { gold: 0, wood: 0 };
  const valid = [gold, wood].every((v) => Number.isInteger(v) && v >= 0);
  if (!valid) return err(invalidConfig('setup.resources', SETUP_RESOURCES_MUST_BE_INTEGER));
  return ok(new Stockpile(gold, wood));
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

/**
 * Casas y torres de la partida con la vida de su tipo o la de `RunSetup`; cada casa, con el puesto
 * de sus guardias en su puerta.
 */
export function initialStructures(
  setup: RunSetup,
  sites: readonly StructureSite[],
  map: GameMap,
  arena: Arena,
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
    const guard = site.type.guards?.type;
    const post =
      guard && site.door ? new GuardPost(site.door.x, site.door.y, guard, map, arena) : null;
    structures.push(new Structure(site, health, post));
  }
  return ok(structures);
}

/** Estado inicial ya validado con el que arranca `Run`. */
export interface InitialState {
  readonly player: Player;
  readonly enemies: Enemy[];
  readonly pickups: PickupField;
  readonly stock: Stockpile;
  /** Vetas en su orden fijo (agotadas incluidas). */
  readonly veins: GoldVein[];
  readonly experience: Experience;
  readonly board: UpgradeBoard;
  /** Bajas ya acumuladas (por defecto, 0). */
  readonly kills: number;
  /** Dinamitas en vuelo ya validadas. */
  readonly dynamites: readonly SetupDynamite[];
  /** Casas y torres en el orden de la lista (ruinas incluidas). */
  readonly structures: Structure[];
  /** Ovejas de la partida (lista del tick 0, pool y azar). */
  readonly flock: Flock;
  /** Vida actual del jugador al empezar (ya validada), o null si empieza llena. */
  readonly playerHealth: number | null;
}

/** Valida el `RunSetup` contra las reglas y construye el estado inicial de la partida. */
export function initialState(
  rules: RunRules,
  setup: RunSetup,
  map: GameMap,
  sites: readonly StructureSite[] = [],
  piles: readonly Point[] = [],
  veinSites: readonly Point[] = [],
  sheepSites: SheepSites = { at: [], capacity: 0, random: null, respawnCells: [] },
): Result<InitialState, DomainError> {
  const player = initialPlayer(rules, setup, map);
  if (!player.ok) return player;
  const structures = initialStructures(setup, sites, map, rules.arena);
  if (!structures.ok) return structures;
  const enemies = initialEnemies(setup, rules.catalog, rules.arena, map, structures.value);
  if (!enemies.ok) return enemies;
  const pickups = initialPickups(rules, setup, map, piles);
  if (!pickups.ok) return pickups;
  const stock = initialStockpile(setup);
  if (!stock.ok) return stock;
  const veins = initialVeins(rules, setup, veinSites);
  if (!veins.ok) return veins;
  const experience = initialExperience(rules, setup);
  if (!experience.ok) return experience;
  const board = initialBoard(rules, setup);
  if (!board.ok) return board;
  const dynamites = initialDynamites(rules, setup);
  if (!dynamites.ok) return dynamites;
  const flock = initialFlock(rules, setup, map, sheepSites);
  if (!flock.ok) return flock;
  const playerHealth = initialPlayerHealth(rules, setup, board.value);
  if (!playerHealth.ok) return playerHealth;
  const kills = setup.kills ?? 0;
  if (!Number.isInteger(kills) || kills < 0) {
    return err(invalidConfig('setup.kills', SETUP_KILLS_MUST_BE_INTEGER));
  }
  return ok({
    player: player.value,
    enemies: enemies.value,
    pickups: pickups.value,
    stock: stock.value,
    veins: veins.value,
    experience: experience.value,
    board: board.value,
    kills,
    dynamites: dynamites.value,
    structures: structures.value,
    flock: flock.value,
    playerHealth: playerHealth.value,
  });
}

/** Ovejas del tick 0 con la vida y el origen del contenido o los de `RunSetup.sheep`. */
function initialFlock(
  rules: RunRules,
  setup: RunSetup,
  map: GameMap,
  sites: SheepSites,
): Result<Flock, DomainError> {
  const entries = setup.sheep ?? [];
  if (entries.length > sites.at.length) {
    return err(invalidConfig('setup.sheep', SETUP_TOO_MANY_SHEEP));
  }
  const max = rules.sheep.health;
  for (const [i, e] of entries.entries()) {
    const h = e.health;
    if (h !== undefined && !(Number.isInteger(h) && h >= 1 && h <= max)) {
      return err(invalidConfig(`setup.sheep.${String(i)}.health`, SETUP_SHEEP_HEALTH_OUT_OF_RANGE));
    }
    if (e.origin && !isFinitePoint(e.origin)) {
      return err(invalidConfig(`setup.sheep.${String(i)}.origin`, SETUP_POSITION_MUST_BE_FINITE));
    }
  }
  const spawns = sites.at.map((p, i) => ({ ...p, ...entries[i] }));
  const ground = { map, cells: sites.respawnCells };
  return ok(new Flock(rules.sheep, spawns, sites.capacity, sites.random, ground));
}

/** Vida inicial del jugador de `RunSetup`: entero en [1, vida máxima con las mejoras iniciales]. */
function initialPlayerHealth(
  rules: RunRules,
  setup: RunSetup,
  board: UpgradeBoard,
): Result<number | null, DomainError> {
  const health = setup.player?.health;
  if (health === undefined) return ok(null);
  const max = rules.player.maxHealth + maxHealthBonus(rules.upgrades, board.levels);
  if (!Number.isInteger(health) || health < 1 || health > max) {
    return err(invalidConfig('setup.player.health', SETUP_PLAYER_HEALTH_OUT_OF_RANGE));
  }
  return ok(health);
}
