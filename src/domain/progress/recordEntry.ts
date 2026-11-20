import { normalizeHistory } from './history';
import type { HistoryEntry, Progress, Records } from './Progress';

/** Récords al máximo campo a campo (cada récord es independiente). */
export const maxRecords = (a: Records, b: Records): Records =>
  Object.freeze({
    bestTimeSeconds: Math.max(a.bestTimeSeconds, b.bestTimeSeconds),
    bestLevel: Math.max(a.bestLevel, b.bestLevel),
    maxKills: Math.max(a.maxKills, b.maxKills),
  });

/**
 * Registra una partida terminada (spec progress-persistence): cada récord al máximo con la
 * partida y la entrada al principio del historial canónico (las 10 más recientes). Los récords no
 * se recalculan desde el historial, así que una partida descartada sigue contando.
 */
export function recordEntry(progress: Progress, entry: HistoryEntry): Progress {
  const fromEntry: Records = {
    bestTimeSeconds: entry.timeSeconds,
    bestLevel: entry.level,
    maxKills: entry.kills,
  };
  return Object.freeze({
    records: maxRecords(progress.records, fromEntry),
    history: normalizeHistory([entry, ...progress.history]),
  });
}
