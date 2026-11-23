import { StartRun } from '../application/StartRun';
import type { RunConfig } from '../domain/run/RunConfig';
import type { DomainError } from '../domain/shared/Result';
import type { RunLauncher } from '../infrastructure/phaser/RunLauncher';
import { seededRun, type MapMode } from './seedSource';

export interface RunLauncherOptions {
  readonly config: RunConfig;
  /** Semilla de la URL ya resuelta (y avisada) una vez por carga con `resolveSeed`. */
  readonly urlSeed: number;
  /** Semilla aleatoria nueva para las partidas siguientes. */
  readonly randomSeed: () => number;
  /** Cada partida creada, con su semilla (la sonda de E2E: `seed` y `runs`). */
  readonly onStart: (seed: number) => void;
  readonly onContentError: (error: DomainError) => void;
  /** Mapa de las partidas de la carga (por defecto, el generado por cada semilla; ADR-0013). */
  readonly mapMode?: MapMode;
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
      const { random, terrain } = seededRun(seed, options.mapMode ?? 'generated');
      const started = start.execute(options.config, random, undefined, terrain);
      if (!started.ok) {
        options.onContentError(started.error);
        return null;
      }
      options.onStart(seed);
      return started.value;
    },
  };
}
