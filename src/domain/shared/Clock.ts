/**
 * Puerto de reloj de pared (AGENTS.md §3.3): única fuente de fecha del núcleo. No es el tiempo de
 * simulación (el bucle recibe los deltas del motor); solo fecha el fin de una partida.
 */
export interface Clock {
  /** Milisegundos enteros desde epoch. */
  nowMs(): number;
}
