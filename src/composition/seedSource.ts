import type { RandomGenerator } from '../domain/shared/RandomGenerator';
import { Mulberry32RandomGenerator } from '../infrastructure/random/Mulberry32RandomGenerator';

/**
 * Fábrica de generadores para `RestartRun` (spec simulation-loop, "Semilla de la partida"): cada
 * reinicio sortea una semilla nueva con `randomSeed`, sin leer la URL ni emitir avisos, y la
 * comunica con `onSeed` (el probe de E2E).
 */
export function restartRandoms(
  randomSeed: () => number,
  onSeed: (seed: number) => void,
): () => RandomGenerator {
  return () => {
    const seed = randomSeed();
    onSeed(seed);
    return new Mulberry32RandomGenerator(seed);
  };
}
