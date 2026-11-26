import type { TickRun } from '../../application/TickRun';
import type { PlayerInput } from '../../domain/player/PlayerInput';
import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import type { RunStatus } from '../../domain/run/RunStatus';
import { advanceFrame, advanceTicks, type TicksAdvanced } from './advanceFrame';

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
  private isHeld = false;

  /** Pausa del jugador (la que abre el overlay); solo la cambia `step`. */
  get paused(): boolean {
    return this.isPaused;
  }

  /** Retención externa (0033: aviso de orientación del modo móvil). */
  get held(): boolean {
    return this.isHeld;
  }

  /** Mundo detenido: pausa del jugador o retención externa. Sin ticks ni tiempo acumulado. */
  get halted(): boolean {
    return this.isPaused || this.isHeld;
  }

  /**
   * Retención externa (spec simulation-loop 0033): al empezar descarta el sobrante del acumulador,
   * como al pausar, para que al soltarla no haya ráfaga. No toca la pausa del jugador ni `step`.
   */
  hold(on: boolean, run: Pick<TickRun, 'discardPending'>): void {
    if (on && !this.isHeld) run.discardPending();
    this.isHeld = on;
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
   * Un frame del motor: en pausa o retenido (0033), 0 ticks sea cual sea `elapsedMs` o `speed` (el acumulador ya está
   * a 0 desde que se pausó); sin pausa, `advanceFrame` con sus reglas normales.
   */
  frame(run: TickRun, elapsedMs: number, input: PlayerInput, speed: number): RunSnapshot {
    if (this.halted) return run.snapshot();
    return advanceFrame(run, elapsedMs, input, speed);
  }

  /**
   * Un frame del motor en modo manual (spec simulation-loop, "Step en pausa" y "Step con el aviso de
   * orientación"): en pausa o retenido, 0 ticks
   * sin tocar la partida; sin pausa, `advanceTicks` con los ticks que planifica el stepper.
   */
  manualFrame(run: TickRun, ticks: number, input: PlayerInput): TicksAdvanced {
    if (this.halted) return { snapshot: run.snapshot(), ticks: 0 };
    return advanceTicks(run, ticks, input);
  }
}
