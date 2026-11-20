import { normalizeHistory } from './history';
import type { Progress } from './Progress';
import { maxRecords } from './recordEntry';

/**
 * Fusión del import (spec progress-persistence, ADR-0010): récords al máximo campo a campo e
 * historial `normalizeHistory(a ∪ b)`. Conmutativa e idempotente por construcción, porque el
 * orden del historial es total y su 0 equivale a "6 campos iguales".
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  return Object.freeze({
    records: maxRecords(a.records, b.records),
    history: normalizeHistory([...a.history, ...b.history]),
  });
}
