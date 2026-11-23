/** Flujo de azar del mapa (ADR-0013). Cambiarlo cambia todos los mapas: re-medir el balance. */
export const MAP_STREAM = 1;

/** Sal de los flujos (constante áurea de 32 bits, como en las mezclas de hash habituales). */
const STREAM_SALT = 0x9e3779b9;

/**
 * Semilla uint32 de un flujo de azar derivada de la de la partida: mezcla `seed` con el flujo y
 * aplica el finalizador de murmur3 (fmix32). Toda semilla uint32 es válida, 0 y 2³² − 1 incluidas.
 * Forma parte del contrato de determinismo (ADR-0013).
 */
export function deriveSeed(seed: number, stream: number): number {
  let h = (seed ^ Math.imul(stream, STREAM_SALT)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
