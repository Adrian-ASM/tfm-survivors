import type { RunConfig } from '../domain/run/RunConfig';
import { err, type DomainError, type Result } from '../domain/shared/Result';
import { StartRun, type RunSeeding, type StartedRun } from './StartRun';
import type { TickRun } from './TickRun';

/** Reinicio pedido con la partida en curso o eligiendo mejora (spec run-results: R no hace nada). */
export interface RestartError {
  readonly code: 'not-over';
}

/**
 * Caso de uso: descartar una partida terminada (victoria o derrota) y empezar otra con el mismo
 * contenido y una siembra nueva (ADR-0009: sustitución de la `Run`, no `reset`). La composición
 * decide la semilla, y con ella el azar y el mapa (ADR-0013), con `nextSeeding`, que solo se llama
 * si el reinicio procede.
 */
export class RestartRun {
  constructor(
    private readonly config: RunConfig,
    private readonly nextSeeding: () => RunSeeding,
    private readonly start: StartRun = new StartRun(),
  ) {}

  execute(current: TickRun): Result<StartedRun, RestartError | DomainError> {
    if (current.status !== 'over') return err({ code: 'not-over' });
    const { random, terrain } = this.nextSeeding();
    return this.start.execute(this.config, random, undefined, terrain);
  }
}
