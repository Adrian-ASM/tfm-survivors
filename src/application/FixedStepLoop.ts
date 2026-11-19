import { TICK_SECONDS } from '../domain/run/Run';

/** Tope de tiempo acumulable por frame: evita la "espiral de la muerte" (máx. 15 ticks a 60 Hz). */
export const MAX_FRAME_MS = 250;

/** Tolerancia para errores de coma flotante al comparar con la duración del tick. */
const EPSILON_MS = 1e-6;

/**
 * Acumulador de paso fijo (spec simulation-loop). Desacopla la simulación de la tasa de refresco:
 * el motor informa del tiempo real transcurrido y el bucle ejecuta 0..15 ticks de 1/60 s.
 */
export class FixedStepLoop {
  private accumulator = 0;

  constructor(private readonly stepMs: number = TICK_SECONDS * 1000) {}

  get accumulatedMs(): number {
    return this.accumulator;
  }

  /** Devuelve cuántos ticks se han ejecutado en este frame. */
  advance(elapsedMs: number, step: () => void): number {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
    this.accumulator += Math.min(elapsedMs, MAX_FRAME_MS);
    let ticks = 0;
    while (this.accumulator + EPSILON_MS >= this.stepMs) {
      step();
      this.accumulator = Math.max(0, this.accumulator - this.stepMs);
      ticks += 1;
    }
    return ticks;
  }
}
