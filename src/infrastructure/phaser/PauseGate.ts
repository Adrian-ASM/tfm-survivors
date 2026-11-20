import type { TickRun } from '../../application/TickRun';
import type { PlayerInput } from '../../domain/player/PlayerInput';
import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import type { RunStatus } from '../../domain/run/RunStatus';
import { advanceFrame } from './advanceFrame';

/** Botón pulsado en el overlay de pausa en este frame. */
export type PauseAction = 'resume' | 'menu' | null;

/** A dónde hay que ir tras el paso de la puerta: `menu` = Volver al menú. */
export type PauseRoute = 'menu' | null;

/**
 * Pausa del adaptador (ADR-0011): un estado de la presentación, no de `Run` (spec run-state sin
 * cambios). Esc solo pausa con la partida en curso; en pausa, Esc o `Reanudar` reanudan y
 * `Volver al menú` pide salir. Al pausar descarta el sobrante del acumulador (spec simulation-loop).
 * Sin import del motor: se prueba en Node (patrón de `advanceFrame`).
 */
export class PauseGate {
  private isPaused = false;

  get paused(): boolean {
    return this.isPaused;
  }

  step(
    esc: boolean,
    action: PauseAction,
    status: RunStatus,
    run: Pick<TickRun, 'discardPending'>,
  ): PauseRoute {
    if (this.isPaused) {
      if (action === 'menu') return 'menu';
      if (esc || action === 'resume') this.isPaused = false;
      return null;
    }
    if (esc && status === 'running') {
      this.isPaused = true;
      run.discardPending();
    }
    return null;
  }

  /**
   * Un frame del motor: en pausa, 0 ticks sea cual sea `elapsedMs` o `speed` (el acumulador ya está
   * a 0 desde que se pausó); sin pausa, `advanceFrame` con sus reglas normales.
   */
  frame(run: TickRun, elapsedMs: number, input: PlayerInput, speed: number): RunSnapshot {
    if (this.isPaused) return run.snapshot();
    return advanceFrame(run, elapsedMs, input, speed);
  }
}
