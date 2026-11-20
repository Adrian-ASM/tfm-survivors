import type { TickRun } from '../../application/TickRun';
import type { PlayerInput } from '../../domain/player/PlayerInput';
import type { RunSnapshot } from '../../domain/run/RunSnapshot';

/**
 * Un frame del motor a velocidad de simulación `speed` (spec simulation-loop, "Avance acelerado
 * por frame"): `speed` avances consecutivos del bucle de paso fijo con el mismo tiempo de frame y
 * el mismo input (leído una vez). Cada avance aplica sus propias reglas (tope de 250 ms incluido).
 * En cuanto la partida deja de estar en curso (oferta o fin) no se hacen más avances. Con
 * `speed = 1` es exactamente una llamada a `TickRun.execute`, como en modo jugador.
 * Sin import del motor: se prueba en Node.
 */
export function advanceFrame(
  run: TickRun,
  elapsedMs: number,
  input: PlayerInput,
  speed: number,
): RunSnapshot {
  let snapshot = run.execute(elapsedMs, input);
  for (let i = 1; i < speed && run.status === 'running'; i += 1) {
    snapshot = run.execute(elapsedMs, input);
  }
  return snapshot;
}
