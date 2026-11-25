/** Flujo de azar del mapa (ADR-0013). Cambiarlo cambia todos los mapas: re-medir el balance. */
export const MAP_STREAM = 1;

/**
 * Flujo de la decoración del mapa (variedad de árboles, change 0016): solo presentación, fuera del
 * contrato de determinismo de la simulación (ADR-0013, addendum).
 */
export const DECOR_STREAM = 2;

/**
 * Flujo de la colocación de casas y torres (ADR-0020): independiente del mapa y de la partida.
 * Cambiarlo cambia todas las estructuras: re-medir el balance.
 */
export const STRUCT_STREAM = 3;

/**
 * Flujo de la colocación de vetas y montones de madera (ADR-0021): independiente del mapa, de las
 * estructuras y de la partida. Cambiarlo cambia todos los recursos (`RESOURCE_GOLDEN`).
 */
export const RESOURCE_STREAM = 4;

/**
 * Flujo de las ovejas (ADR-0022): colocación inicial, primer pasto, dirección de los paseos y celda
 * de cada reaparición, consumidos en ese orden fijo. Independiente del mapa, de las estructuras, de
 * los recursos y de la partida. Cambiarlo cambia todas las ovejas (`SHEEP_GOLDEN`).
 */
export const SHEEP_STREAM = 5;

/**
 * Flujo de la piedra (ADR-0024): 1 valor por baja, en el orden de las bajas, para la tirada de
 * "Piedra por enemigo abatido". Existe en todo mapa (también el vacío) e independiente de los demás.
 * Cambiarlo cambia todas las piedras (`STONE_GOLDEN`).
 */
export const STONE_STREAM = 6;

/**
 * Flujo de la colocación de los solares de obra (0026): 1 valor por solar del mapa generado, tras
 * estructuras, recursos y ovejas. Independiente de los demás flujos. Cambiarlo cambia todos los
 * solares (`SITE_GOLDEN`).
 */
export const SITE_STREAM = 7;

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
