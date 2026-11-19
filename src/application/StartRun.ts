import { Run, type RunConfig } from '../domain/run/Run';
import type { RandomGenerator } from '../domain/shared/RandomGenerator';
import { ok, type DomainError, type Result } from '../domain/shared/Result';
import { TickRun } from './TickRun';

/**
 * Caso de uso: crear una partida a partir de contenido ya validado en forma y de un generador ya
 * sembrado (la composición resuelve la semilla; el núcleo no conoce su origen).
 */
export class StartRun {
  execute(config: RunConfig, random: RandomGenerator): Result<TickRun, DomainError> {
    const run = Run.start(config, random);
    return run.ok ? ok(new TickRun(run.value)) : run;
  }
}
