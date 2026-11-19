import type { RunConfig } from '../domain/run/RunConfig';
import type { RandomGenerator } from '../domain/shared/RandomGenerator';
import { err, type DomainError, type Result } from '../domain/shared/Result';
import { StartRun, type StartedRun } from './StartRun';
import type { TickRun } from './TickRun';

/** Reinicio pedido con la partida en curso o eligiendo mejora (spec run-results: R no hace nada). */
export interface RestartError {
  readonly code: 'not-over';
}

/**
 * Caso de uso: descartar una partida terminada (victoria o derrota) y empezar otra con el mismo
 * contenido y un generador nuevo (ADR-0009: sustitución de la `Run`, no `reset`). La composición
 * decide la semilla con `nextRandom`, que solo se llama si el reinicio procede.
 */
export class RestartRun {
  constructor(
    private readonly config: RunConfig,
    private readonly nextRandom: () => RandomGenerator,
    private readonly start: StartRun = new StartRun(),
  ) {}

  execute(current: TickRun): Result<StartedRun, RestartError | DomainError> {
    if (current.status !== 'over') return err({ code: 'not-over' });
    return this.start.execute(this.config, this.nextRandom());
  }
}
