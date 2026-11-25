/**
 * Puerto de aleatoriedad (ADR-0002): único puerto de azar del núcleo. La composición crea sus
 * instancias ya sembradas; el dominio no conoce el origen de la semilla. Una partida usa varias: la
 * de oleadas y ofertas, la del mapa (ADR-0013), las de estructuras, recursos y ovejas (ADR-0020 a
 * ADR-0022) y la de la piedra (ADR-0024, 1 valor por baja).
 */
export interface RandomGenerator {
  /** Siguiente valor de la secuencia, en [0, 1). */
  next(): number;
}
