import type { RunOutcome } from '../run/RunPhase';

/**
 * Mejores marcas del jugador (spec progress-persistence). Cada una es independiente: pueden venir
 * de partidas distintas y nunca se recalculan desde el historial.
 */
export interface Records {
  /** Mejor tiempo sobrevivido, en segundos enteros. */
  readonly bestTimeSeconds: number;
  readonly bestLevel: number;
  readonly maxKills: number;
}

/** Una partida terminada del historial. */
export interface HistoryEntry {
  /** Fin de la partida en ms desde epoch (reloj de pared, puerto `Clock`). */
  readonly playedAt: number;
  readonly seed: number;
  readonly outcome: RunOutcome;
  readonly timeSeconds: number;
  readonly level: number;
  readonly kills: number;
}

/**
 * Progreso del jugador en forma canónica (ADR-0010): historial ordenado de más reciente a más
 * antiguo, sin duplicados y con como mucho `HISTORY_LIMIT` entradas. El formato persistido
 * (`schemaVersion`, `victory`/`defeat`) es de infraestructura.
 */
export interface Progress {
  readonly records: Records;
  readonly history: readonly HistoryEntry[];
}

/** Partidas que conserva el historial. */
export const HISTORY_LIMIT = 10;

export const EMPTY_PROGRESS: Progress = Object.freeze({
  records: Object.freeze({ bestTimeSeconds: 0, bestLevel: 0, maxKills: 0 }),
  history: Object.freeze([]),
});
