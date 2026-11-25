/** Resultado de una partida terminada (spec run-outcome). */
export type RunOutcome = 'won' | 'lost';

/**
 * Fase de la partida (ADR-0009): estado y resultado en una unión discriminada, de modo que "over
 * sin resultado" o "resultado sin over" no se pueden representar. Solo existen los 4 valores
 * congelados de abajo (cinco desde 0024); las transiciones las hace `Run`.
 */
export type RunPhase =
  | { readonly status: 'running'; readonly outcome: null }
  | { readonly status: 'choosing'; readonly outcome: null }
  | { readonly status: 'shopping'; readonly outcome: null }
  | { readonly status: 'over'; readonly outcome: RunOutcome };

export const RUNNING: RunPhase = Object.freeze({ status: 'running', outcome: null });
export const CHOOSING: RunPhase = Object.freeze({ status: 'choosing', outcome: null });
/** En la tienda (ADR-0023): simulación congelada como en `choosing`. */
export const SHOPPING: RunPhase = Object.freeze({ status: 'shopping', outcome: null });
export const WON: RunPhase = Object.freeze({ status: 'over', outcome: 'won' });
export const LOST: RunPhase = Object.freeze({ status: 'over', outcome: 'lost' });
