import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';

/** Secuencia reproducible de inputs de teclado (cada eje en {-1, 0, 1}) generada por una semilla fija. */
export function randomInputs(count: number, seed: number): PlayerInput[] {
  const rnd = new Mulberry32RandomGenerator(seed);
  return Array.from({ length: count }, () =>
    PlayerInput.of(Math.round(rnd.next() * 2 - 1), Math.round(rnd.next() * 2 - 1)),
  );
}
