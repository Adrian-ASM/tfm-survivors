import type { RunSnapshot } from '../../domain/run/RunSnapshot';

/**
 * Periodo del parpadeo en ticks del snapshot: 4 visible y 4 oculto (7,5 Hz). Es apariencia, no
 * contenido de juego, como `PLAYER_COLOR`.
 */
export const BLINK_PERIOD_TICKS = 4;

/**
 * Spec player-health "Indicación visual de invulnerabilidad": invulnerable ⇒ visible si y solo si
 * ⌊tick / P⌋ es par; sin invulnerabilidad, o con la partida terminada, siempre visible. Solo lee el
 * snapshot: no cambia la simulación.
 */
export function playerVisible(
  s: Pick<RunSnapshot, 'tick' | 'status' | 'player'>,
  period = BLINK_PERIOD_TICKS,
): boolean {
  if (s.status === 'over' || !s.player.invulnerable) return true;
  return Math.floor(s.tick / period) % 2 === 0;
}
