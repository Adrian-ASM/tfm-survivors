import { Arena } from '../../src/domain/arena/Arena';
import { GameMap } from '../../src/domain/map/GameMap';
import { MapRules } from '../../src/domain/map/MapRules';
import type { MapSnapshot } from '../../src/domain/map/MapSnapshot';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { TICK_SECONDS } from '../../src/domain/shared/Tick';
import type { OfferSnapshot, RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { RunConfig } from '../../src/domain/run/RunConfig';

/**
 * Prioridad de mejoras del bot de referencia (spec run-outcome, 0010). Cambiarla exige un change
 * que revise los requisitos de balance.
 */
export const REFERENCE_UPGRADE_PRIORITY: readonly string[] = [
  'guardrail',
  'strict-rules',
  'fast-ci',
  'hard-asserts',
  'watch-mode',
];

/**
 * Índice de la opción cuyo id aparece antes en `priority`, sea cual sea su posición en la oferta;
 * 0 si la oferta no contiene ninguno.
 */
export function pickByPriority(
  offer: readonly OfferSnapshot[],
  priority: readonly string[] = REFERENCE_UPGRADE_PRIORITY,
): number {
  for (const id of priority) {
    const index = offer.findIndex((o) => o.id === id);
    if (index >= 0) return index;
  }
  return 0;
}

/** Radio en el que un enemigo repele al jugador (px). */
export const FLEE_ENEMY_RANGE = 150;
/** Distancia a una pared desde la que esta repele al jugador (px). */
export const FLEE_WALL_RANGE = 64;
/** Distancia a una celda no caminable desde la que esta repele al jugador (px, 0015). */
export const FLEE_CELL_RANGE = 64;

/** Paredes del mundo en el que se juega (la `arena` de la configuración de la partida). */
export interface Bounds {
  readonly width: number;
  readonly height: number;
}

/**
 * Lo que el bot sabe de la partida (spec run-outcome, 0013 y 0015): las paredes del mundo y el
 * mapa de esa partida, y su velocidad efectiva según las mejoras del snapshot. Nunca un tamaño ni
 * un mapa fijos.
 */
export interface BotWorld {
  readonly arena: Bounds;
  readonly map: GameMap;
  readonly radius: number;
  speedOf(snapshot: RunSnapshot): number;
}

const EIGHTH = Math.PI / 4;
/** Giros a probar si la dirección está bloqueada, en octavos (positivo = horario en pantalla). */
const TURNS = [1, -1, 2, -2, 3, -3] as const;

/** Repulsión 1/d² de una pared a distancia d (0 fuera de rango). */
const wallPush = (d: number): number => (d < FLEE_WALL_RANGE ? 1 / Math.max(d, 1) ** 2 : 0);

/** Distancia de v al intervalo cerrado [lo, hi] con signo hacia v (0 dentro). */
const offset = (v: number, lo: number, hi: number): number =>
  v < lo ? v - lo : v > hi ? v - hi : 0;

/** Suma de la repulsión 1/d² de las celdas no caminables a menos de `FLEE_CELL_RANGE` px. */
function cellPush(world: BotWorld, x: number, y: number): [number, number] {
  const { map } = world;
  const reach = FLEE_CELL_RANGE;
  let fx = 0;
  let fy = 0;
  for (let row = map.rowAt(y - reach); row <= map.rowAt(y + reach); row++) {
    for (let col = map.colAt(x - reach); col <= map.colAt(x + reach); col++) {
      if (map.isWalkable(col, row)) continue;
      const rect = map.cellRect(col, row);
      const dx = offset(x, rect.left, rect.right);
      const dy = offset(y, rect.top, rect.bottom);
      const d = Math.hypot(dx, dy);
      if (d >= reach || d === 0) continue;
      fx += dx / d ** 3;
      fy += dy / d ** 3;
    }
  }
  return [fx, fy];
}

/** Componentes enteras de la dirección de `k` octavos (0 = +x, 2 = +y). */
const octant = (k: number): [number, number] => {
  const angle = k * EIGHTH;
  return [Math.round(Math.cos(angle)), Math.round(Math.sin(angle))];
};

/**
 * ¿Bloquea el mapa la dirección (dx, dy)? Un tick de movimiento sin obstáculos a la velocidad
 * efectiva, desde la posición del snapshot, dejaría el círculo solapando una celda no caminable.
 * Las paredes del mundo no bloquean.
 */
export function isBlockedMove(
  snapshot: RunSnapshot,
  world: BotWorld,
  dx: number,
  dy: number,
): boolean {
  const step = PlayerInput.of(dx, dy).direction.scale(world.speedOf(snapshot) * TICK_SECONDS);
  const { x, y } = snapshot.player;
  return world.map.overlapsBlocked(x + step.x, y + step.y, world.radius);
}

/**
 * Política de movimiento pura y reproducible (medición de ganabilidad, 0006; mapa, 0015): suma una
 * repulsión 1/d² de cada enemigo a menos de `FLEE_ENEMY_RANGE` px, de cada pared a menos de
 * `FLEE_WALL_RANGE` px y de cada celda `trunk` o `water` a menos de `FLEE_CELL_RANGE` px (desde el
 * punto más cercano de su rectángulo), y la cuantiza a una de 8 direcciones. Con vector nulo,
 * quieto. Si la dirección está bloqueada prueba +45°, −45°, +90°, −90°, +135° y −135°; si todas lo
 * están, quieto.
 */
export function fleeInput(snapshot: RunSnapshot, world: BotWorld): PlayerInput {
  const { x, y } = snapshot.player;
  const { arena } = world;
  let [fx, fy] = cellPush(world, x, y);
  fx += wallPush(x) - wallPush(arena.width - x);
  fy += wallPush(y) - wallPush(arena.height - y);
  for (const e of snapshot.enemies) {
    const dx = x - e.x;
    const dy = y - e.y;
    const d = Math.hypot(dx, dy);
    if (d >= FLEE_ENEMY_RANGE || d === 0) continue;
    fx += dx / d ** 3;
    fy += dy / d ** 3;
  }
  return steer(snapshot, world, fx, fy);
}

/**
 * Cuantiza (fx, fy) a una de las 8 direcciones y aplica la regla de direcciones bloqueadas (paso 3
 * de Movimiento, spec run-outcome): +45°, −45°, +90°, −90°, +135° y −135°; si todas lo están, o el
 * vector es nulo, quieto.
 */
function steer(snapshot: RunSnapshot, world: BotWorld, fx: number, fy: number): PlayerInput {
  if (fx === 0 && fy === 0) return PlayerInput.NONE;
  const k = Math.round(Math.atan2(fy, fx) / EIGHTH);
  for (const turn of [0, ...TURNS]) {
    const [dx, dy] = octant(k + turn);
    if (!isBlockedMove(snapshot, world, dx, dy)) return PlayerInput.of(dx, dy);
  }
  return PlayerInput.NONE;
}

/**
 * Esquiva del bot v3 (spec run-outcome, 0020), con el snapshot anterior: un aviso es amenazante si
 * la distancia de su centro al del jugador es estrictamente menor que radio del aviso + radio del
 * jugador + s, con s = velocidad efectiva / 60 (un tick de movimiento). Con ≥ 1 amenazante, suma
 * los vectores unitarios aviso → jugador, la cuantiza a 8 direcciones y aplica la regla de
 * direcciones bloqueadas. Sin amenazas o con suma nula (también si el jugador está en el centro de
 * todos ellos), el input es el de la huida (`fleeInput`). Sin pesos ni márgenes propios: solo lee
 * lo que expone el snapshot (no conoce el daño ni las dinamitas aún no lanzadas).
 */
export function dodgeInput(snapshot: RunSnapshot, world: BotWorld): PlayerInput {
  const { x, y } = snapshot.player;
  let fx = 0;
  let fy = 0;
  for (const w of threateningWarnings(snapshot, world)) {
    const d = Math.hypot(x - w.x, y - w.y);
    fx += (x - w.x) / d;
    fy += (y - w.y) / d;
  }
  if (fx === 0 && fy === 0) return fleeInput(snapshot, world);
  return steer(snapshot, world, fx, fy);
}

/**
 * Avisos amenazantes para el bot v3 (ver `dodgeInput`), sin los centrados en el jugador (no dan
 * dirección). También lo usa la firma W3 de la medición de balance (0021, design §11).
 */
export function threateningWarnings(
  snapshot: RunSnapshot,
  world: BotWorld,
): RunSnapshot['warnings'] {
  const { x, y, radius } = snapshot.player;
  const step = world.speedOf(snapshot) * TICK_SECONDS;
  return snapshot.warnings.filter((w) => {
    const d = Math.hypot(x - w.x, y - w.y);
    return d < w.radius + radius + step && d !== 0;
  });
}

/** Bot de referencia del balance (v3): esquiva de avisos, huida y elección por prioridad. */
export interface ReferenceBot {
  input(snapshot: RunSnapshot): PlayerInput;
  pick(offer: readonly OfferSnapshot[]): number;
}

/** Velocidad efectiva: la base del contenido más las mejoras de velocidad del snapshot. */
function effectiveSpeed(config: RunConfig, snapshot: RunSnapshot): number {
  let speed = config.player.speed;
  for (const { id, level } of snapshot.upgrades) {
    const u = config.upgrades.upgrades.find((x) => x.id === id);
    if (u?.target.kind === 'player' && u.stat === 'speed') speed += u.perLevel * level;
  }
  return speed;
}

/** Mundo del bot para una partida creada con `config` cuyo mapa es `map`. */
export function botWorld(config: RunConfig, map: MapSnapshot): BotWorld {
  const { arena } = config;
  const rules = Arena.create(arena.width, arena.height);
  if (!rules.ok) throw new Error(rules.error.message);
  const mapRules = MapRules.create(config.map, rules.value, config.player.radius);
  if (!mapRules.ok) throw new Error(mapRules.error.message);
  const grid = GameMap.fromCells(map.cells, mapRules.value);
  if (!grid.ok) throw new Error(grid.error.message);
  return {
    arena,
    map: grid.value,
    radius: config.player.radius,
    speedOf: (snapshot) => effectiveSpeed(config, snapshot),
  };
}

/**
 * Bot de referencia v3 ligado a la partida (spec run-outcome, 0013, 0015 y 0020): esquiva los avisos
 * amenazantes (`dodgeInput`) y, si no, huye de las paredes de
 * `config.arena` y de las celdas no caminables de `map` (el mapa de esa partida, `run.map`) sin
 * recibir ningún otro dato de tamaño ni de mapa.
 */
export function referenceBot(config: RunConfig, map: MapSnapshot): ReferenceBot {
  const world = botWorld(config, map);
  return {
    input: (snapshot) => dodgeInput(snapshot, world),
    pick: (offer) => pickByPriority(offer),
  };
}
