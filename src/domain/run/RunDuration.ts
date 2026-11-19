import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { TICKS_PER_SECOND } from '../shared/Tick';

/** Mensaje de la invariante; la validación de contenido (zod) usa el mismo. */
export const RUN_DURATION_MUST_BE_INTEGER =
  'La duración de la partida (durationSeconds) debe ser un entero ≥ 1.';

/**
 * Duración objetivo de la partida (value object, spec run-outcome): un entero ≥ 1 de segundos,
 * expresado en ticks. La partida se gana en el tick `ticks` si el jugador sigue vivo.
 */
export class RunDuration {
  readonly ticks: number;

  private constructor(readonly seconds: number) {
    this.ticks = seconds * TICKS_PER_SECOND;
    Object.freeze(this);
  }

  static create(seconds: number): Result<RunDuration, DomainError> {
    if (!Number.isInteger(seconds) || seconds < 1) {
      return err(invalidConfig('run.durationSeconds', RUN_DURATION_MUST_BE_INTEGER));
    }
    return ok(new RunDuration(seconds));
  }

  /** ¿Es `tick` el tick de la duración objetivo? */
  endsAt(tick: number): boolean {
    return tick === this.ticks;
  }
}
