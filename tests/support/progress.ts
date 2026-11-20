import type { HistoryEntry, Progress, Records } from '../../src/domain/progress/Progress';

/** Entrada de historial: derrota de 20 s, nivel 3, 41 bajas y semilla 42, con los cambios dados. */
export const anEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  playedAt: 1_763_596_800_000,
  seed: 42,
  outcome: 'lost',
  timeSeconds: 20,
  level: 3,
  kills: 41,
  ...overrides,
});

/** Récords (`bestTimeSeconds`, `bestLevel`, `maxKills`). */
export const records = (
  bestTimeSeconds: number,
  bestLevel: number,
  maxKills: number,
): Records => ({ bestTimeSeconds, bestLevel, maxKills });

/** Progreso con los récords y el historial dados (sin normalizar: lo que se pasa es lo que hay). */
export const aProgress = (
  recs: Records = records(0, 0, 0),
  history: readonly HistoryEntry[] = [],
): Progress => ({ records: recs, history });

/** Entradas con los `playedAt` dados y el resto por defecto. */
export const entriesAt = (...playedAt: number[]): HistoryEntry[] =>
  playedAt.map((t) => anEntry({ playedAt: t }));

export const playedAtOf = (p: Progress): number[] => p.history.map((e) => e.playedAt);
