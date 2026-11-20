// Constantes de balance (spec run-outcome, 0010). Sin imports: los E2E también las usan.

/** Conjunto fijo de semillas de los tests de balance: 1..50, ambos incluidos. */
export const BALANCE_SEEDS: readonly number[] = Array.from({ length: 50 }, (_, i) => i + 1);

/** Victorias del bot de referencia sobre `BALANCE_SEEDS` (ambos límites incluidos). */
export const WIN_BAND = { min: 25, max: 35 } as const;

/** Un jugador quieto debe perder en un tick menor que este (180 s). */
export const STILL_LIMIT_TICKS = 180 * 60;

/** Semilla del conjunto con la que los E2E esperan una derrota quieta. */
export const STILL_DEFEAT_SEED = 42;
