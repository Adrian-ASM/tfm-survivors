import { HISTORY_LIMIT, type HistoryEntry } from './Progress';

const OUTCOME_ORDER = { lost: 0, won: 1 } as const;

/**
 * Orden total del historial (ADR-0010): `playedAt` descendente y, en empate, `seed`,
 * `timeSeconds`, `level`, `kills` ascendentes y `outcome`. Vale 0 si y solo si coinciden los 6
 * campos, así que el orden no depende de cómo llegan las entradas.
 */
export function compareEntries(a: HistoryEntry, b: HistoryEntry): number {
  return (
    b.playedAt - a.playedAt ||
    a.seed - b.seed ||
    a.timeSeconds - b.timeSeconds ||
    a.level - b.level ||
    a.kills - b.kills ||
    OUTCOME_ORDER[a.outcome] - OUTCOME_ORDER[b.outcome]
  );
}

/**
 * Forma canónica del historial: ordenado con `compareEntries`, sin duplicados (6 campos iguales)
 * y recortado a las `HISTORY_LIMIT` más recientes. Devuelve un array nuevo congelado.
 */
export function normalizeHistory(entries: readonly HistoryEntry[]): readonly HistoryEntry[] {
  const sorted = [...entries].sort(compareEntries);
  const unique: HistoryEntry[] = [];
  for (const entry of sorted) {
    const previous = unique[unique.length - 1];
    if (previous && compareEntries(previous, entry) === 0) continue;
    unique.push(Object.freeze({ ...entry }));
    if (unique.length === HISTORY_LIMIT) break;
  }
  return Object.freeze(unique);
}
