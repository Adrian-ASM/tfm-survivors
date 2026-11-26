import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';

/** Secuencia reproducible de inputs de teclado (cada eje en {-1, 0, 1}) generada por una semilla fija. */
export function randomInputs(count: number, seed: number): PlayerInput[] {
  const rnd = new Mulberry32RandomGenerator(seed);
  return Array.from({ length: count }, () =>
    PlayerInput.of(Math.round(rnd.next() * 2 - 1), Math.round(rnd.next() * 2 - 1)),
  );
}

/**
 * Como `randomInputs`, pero cada input se mantiene `hold` ticks seguidos: el jugador recorre el mapa
 * en vez de quedarse cerca de la salida (escenarios que necesitan golpes pronto, 0031).
 */
export function heldInputs(count: number, seed: number, hold: number): PlayerInput[] {
  const keys = randomInputs(Math.ceil(count / hold), seed);
  return Array.from({ length: count }, (_, i) => keys[Math.floor(i / hold)] ?? PlayerInput.NONE);
}
