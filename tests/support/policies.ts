import { PlayerInput } from '../../src/domain/player/PlayerInput';
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

/** Paredes del mundo en el que se juega (la `arena` de la configuración de la partida). */
export interface Bounds {
  readonly width: number;
  readonly height: number;
}

const EIGHTH = Math.PI / 4;

/** Repulsión 1/d² de una pared a distancia d (0 fuera de rango). */
const wallPush = (d: number): number => (d < FLEE_WALL_RANGE ? 1 / Math.max(d, 1) ** 2 : 0);

/**
 * Política de movimiento pura y reproducible (medición de ganabilidad, 0006): suma una repulsión
 * 1/d² de cada enemigo a menos de `FLEE_ENEMY_RANGE` px y de cada pared a menos de
 * `FLEE_WALL_RANGE` px, y la cuantiza a una de 8 direcciones. Con vector nulo, quieto. La arena es
 * obligatoria (0013): sin tamaño por defecto, el bot no puede huir de unas paredes que no existen.
 */
export function fleeInput(snapshot: RunSnapshot, arena: Bounds): PlayerInput {
  const { x, y } = snapshot.player;
  let fx = wallPush(x) - wallPush(arena.width - x);
  let fy = wallPush(y) - wallPush(arena.height - y);
  for (const e of snapshot.enemies) {
    const dx = x - e.x;
    const dy = y - e.y;
    const d = Math.hypot(dx, dy);
    if (d >= FLEE_ENEMY_RANGE || d === 0) continue;
    fx += dx / d ** 3;
    fy += dy / d ** 3;
  }
  if (fx === 0 && fy === 0) return PlayerInput.NONE;
  const angle = Math.round(Math.atan2(fy, fx) / EIGHTH) * EIGHTH;
  return PlayerInput.of(Math.round(Math.cos(angle)), Math.round(Math.sin(angle)));
}

/** Bot de referencia del balance: movimiento de huida y elección por prioridad. */
export interface ReferenceBot {
  input(snapshot: RunSnapshot): PlayerInput;
  pick(offer: readonly OfferSnapshot[]): number;
}

/**
 * Bot de referencia ligado a la configuración con la que se crea la partida (spec run-outcome,
 * 0013): huye de las paredes de `config.arena` sin recibir ningún otro dato de tamaño.
 */
export function referenceBot(config: RunConfig): ReferenceBot {
  const { arena } = config;
  return {
    input: (snapshot) => fleeInput(snapshot, arena),
    pick: (offer) => pickByPriority(offer),
  };
}
