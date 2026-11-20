/** Ticks de simulación por segundo de partida (spec simulation-loop: paso fijo de 1/60 s). */
export const TICKS_PER_SECOND = 60;

/** Duración de un tick de simulación. El tiempo de partida en el tick n es n / TICKS_PER_SECOND. */
export const TICK_SECONDS = 1 / TICKS_PER_SECOND;

/**
 * Tiempo sobrevivido en segundos completos, ⌊tick / 60⌋: una sola regla para "Tiempo
 * sobrevivido" (run-results) y `timeSeconds` del progreso (progress-persistence).
 */
export const survivedSeconds = (tick: number): number => Math.floor(tick / TICKS_PER_SECOND);
