import { MAX_FRAME_MS } from '../../application/FixedStepLoop';
import type { TickRun } from '../../application/TickRun';
import type { PlayerInput } from '../../domain/player/PlayerInput';
import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import { TICK_SECONDS } from '../../domain/shared/Tick';

/** Duración de un tick de simulación (ms). */
export const TICK_MS = TICK_SECONDS * 1000;

/**
 * Ticks por llamada a `TickRun.execute` sin que el tope de 250 ms recorte: 15. `Math.round` y no
 * `Math.floor`, porque 250 / 16,666… da 14,999… en coma flotante.
 */
export const TICKS_PER_EXECUTE = Math.round(MAX_FRAME_MS / TICK_MS);

/** Resultado de un avance manual: snapshot final y ticks ejecutados de verdad. */
export interface TicksAdvanced {
  readonly snapshot: RunSnapshot;
  readonly ticks: number;
}

/**
 * Avance manual de exactamente `ticks` ticks con el mismo input (spec simulation-loop, "Avance
 * manual con step"), troceado en llamadas a `execute` de ≤ 15 ticks con el acumulador a 0 antes
 * de cada una (sin residuos de coma flotante). Para en cuanto la partida deja de estar en curso
 * (oferta o fin) y descarta el resto. No cambia ninguna regla: solo informa tiempo al bucle.
 * Sin import del motor: se prueba en Node.
 */
export function advanceTicks(
  run: Pick<TickRun, 'execute' | 'status' | 'discardPending' | 'snapshot'>,
  ticks: number,
  input: PlayerInput,
): TicksAdvanced {
  let snapshot = run.snapshot();
  const start = snapshot.tick;
  for (let left = ticks; left > 0 && run.status === 'running';) {
    const chunk = Math.min(TICKS_PER_EXECUTE, left);
    run.discardPending();
    snapshot = run.execute(chunk * TICK_MS, input);
    left -= chunk;
  }
  return { snapshot, ticks: snapshot.tick - start };
}

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
