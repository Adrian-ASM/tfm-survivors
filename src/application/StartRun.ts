import type { TerrainSource } from '../domain/map/TerrainSource';
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
 * Siembra de una partida que resuelve la composición (ADR-0013): el azar de la partida y el origen
 * de su mapa, con su propio generador si se genera.
 */
export interface RunSeeding {
  readonly random: RandomGenerator;
  readonly terrain: TerrainSource;
}

/**
 * Caso de uso: crear una partida a partir de contenido ya validado en forma y de un generador ya
 * sembrado (la composición resuelve la semilla; el núcleo no conoce su origen). `setup` solo lo
 * usan los tests; sin `terrain`, el mapa vacío.
 */
export class StartRun {
  execute(
    config: RunConfig,
    random: RandomGenerator,
    setup?: RunSetup,
    terrain?: TerrainSource,
  ): Result<StartedRun, DomainError> {
    const run = Run.start(config, random, setup, terrain);
    if (!run.ok) return run;
    return ok({ tickRun: new TickRun(run.value), chooseUpgrade: new ChooseUpgrade(run.value) });
  }
}
