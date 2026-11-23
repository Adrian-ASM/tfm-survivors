/**
 * Puerto de aleatoriedad (ADR-0002): único puerto de azar del núcleo. La composición crea sus
 * instancias ya sembradas; el dominio no conoce el origen de la semilla. Una partida usa dos: la
 * de oleadas y ofertas, y la del mapa (ADR-0013).
 */
export interface RandomGenerator {
  /** Siguiente valor de la secuencia, en [0, 1). */
  next(): number;
}
