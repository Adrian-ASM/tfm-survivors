import { StartRun } from '../application/StartRun';
import type { RunConfig } from '../domain/run/RunConfig';
import type { DomainError } from '../domain/shared/Result';
import type { RunLauncher } from '../infrastructure/phaser/RunLauncher';
import { Mulberry32RandomGenerator } from '../infrastructure/random/Mulberry32RandomGenerator';

export interface RunLauncherOptions {
  readonly config: RunConfig;
  /** Semilla de la URL ya resuelta (y avisada) una vez por carga con `resolveSeed`. */
  readonly urlSeed: number;
  /** Semilla aleatoria nueva para las partidas siguientes. */
  readonly randomSeed: () => number;
  /** Cada partida creada, con su semilla (la sonda de E2E: `seed` y `runs`). */
  readonly onStart: (seed: number) => void;
  readonly onContentError: (error: DomainError) => void;
}

/**
 * Crea la partida al entrar en `GameScene` (spec simulation-loop, "Semilla de la partida"): la
 * primera de la carga (primer Jugar o arranque con `?e2e`) usa la semilla de la URL; las demás
 * (Jugar tras Volver al menú), una aleatoria nueva, sin releer la URL ni avisar.
 */
export function createRunLauncher(options: RunLauncherOptions): RunLauncher {
  const start = new StartRun();
  let first = true;
  return {
    launch: () => {
      const seed = first ? options.urlSeed : options.randomSeed();
      first = false;
      const started = start.execute(options.config, new Mulberry32RandomGenerator(seed));
      if (!started.ok) {
        options.onContentError(started.error);
        return null;
      }
      options.onStart(seed);
      return started.value;
    },
  };
}
