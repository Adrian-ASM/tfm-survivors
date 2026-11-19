/**
 * Puerto de aleatoriedad (ADR-0002): única fuente de azar del núcleo. La composición lo crea ya sembrado;
 * el dominio no conoce el origen de la semilla.
 */
export interface RandomGenerator {
  /** Siguiente valor de la secuencia, en [0, 1). */
  next(): number;
}
