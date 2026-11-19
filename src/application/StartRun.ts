import { Run, type RunConfig } from '../domain/run/Run';
import { ok, type DomainError, type Result } from '../domain/shared/Result';
import { TickRun } from './TickRun';

/** Caso de uso: crear una partida a partir de contenido ya validado en forma. */
export class StartRun {
  execute(config: RunConfig): Result<TickRun, DomainError> {
    const run = Run.start(config);
    return run.ok ? ok(new TickRun(run.value)) : run;
  }
}
