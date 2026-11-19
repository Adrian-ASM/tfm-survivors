import { Run, type RunConfig, type RunSetup } from '../domain/run/Run';
import type { RandomGenerator } from '../domain/shared/RandomGenerator';
import { ok, type DomainError, type Result } from '../domain/shared/Result';
import { ChooseUpgrade } from './ChooseUpgrade';
import { TickRun } from './TickRun';

/** Los casos de uso de una partida en marcha, sobre la misma `Run`. */
export interface StartedRun {
  readonly tickRun: TickRun;
  readonly chooseUpgrade: ChooseUpgrade;
}

/**
 * Caso de uso: crear una partida a partir de contenido ya validado en forma y de un generador ya
 * sembrado (la composición resuelve la semilla; el núcleo no conoce su origen). `setup` solo lo
 * usan los tests.
 */
export class StartRun {
  execute(
    config: RunConfig,
    random: RandomGenerator,
    setup?: RunSetup,
  ): Result<StartedRun, DomainError> {
    const run = Run.start(config, random, setup);
    if (!run.ok) return run;
    return ok({ tickRun: new TickRun(run.value), chooseUpgrade: new ChooseUpgrade(run.value) });
  }
}
