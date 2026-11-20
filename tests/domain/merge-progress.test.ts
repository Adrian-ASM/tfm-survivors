import { describe, expect, it } from 'vitest';
import { mergeProgress } from '../../src/domain/progress/mergeProgress';
import { normalizeHistory } from '../../src/domain/progress/history';
import {
  HISTORY_LIMIT,
  type HistoryEntry,
  type Progress,
} from '../../src/domain/progress/Progress';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aProgress, anEntry, entriesAt, playedAtOf, records } from '../support/progress';

const canonical = (recs: Progress['records'], history: HistoryEntry[]): Progress =>
  aProgress(recs, normalizeHistory(history));

describe('Import con fusión (spec progress-persistence)', () => {
  it('Scenario: Récords máximos ((300, 8, 120) ∪ (250, 10, 90) ⇒ (300, 10, 120))', () => {
    const merged = mergeProgress(aProgress(records(300, 8, 120)), aProgress(records(250, 10, 90)));

    expect(merged.records).toStrictEqual(records(300, 10, 120));
  });

  it('Scenario: Duplicado solo si coinciden todos los campos', () => {
    const current = canonical(records(20, 3, 41), [anEntry({ playedAt: 5000 })]);
    const otherKills = canonical(records(20, 3, 42), [anEntry({ playedAt: 5000, kills: 42 })]);
    const same = canonical(records(20, 3, 41), [anEntry({ playedAt: 5000 })]);

    expect(mergeProgress(current, otherKills).history).toHaveLength(2);
    expect(mergeProgress(current, same).history).toStrictEqual([anEntry({ playedAt: 5000 })]);
  });

  it('Scenario: Historial recortado al fusionar (impares 1–19 ∪ pares 2–20 ⇒ 20…11)', () => {
    const odd = canonical(records(0, 0, 0), entriesAt(1, 3, 5, 7, 9, 11, 13, 15, 17, 19));
    const even = canonical(records(0, 0, 0), entriesAt(2, 4, 6, 8, 10, 12, 14, 16, 18, 20));

    expect(playedAtOf(mergeProgress(odd, even))).toEqual([20, 19, 18, 17, 16, 15, 14, 13, 12, 11]);
  });

  it('Scenario: Fusión conmutativa con fechas empatadas (playedAt 5.000)', () => {
    const a = canonical(records(20, 3, 41), [anEntry({ playedAt: 5000, seed: 7 })]);
    const b = canonical(records(15, 5, 30), [
      anEntry({ playedAt: 5000, seed: 3, outcome: 'won' }),
      anEntry({ playedAt: 5000, seed: 7, kills: 1 }),
    ]);

    expect(mergeProgress(a, b)).toStrictEqual(mergeProgress(b, a));
  });

  it('Scenario: Importar dos veces el mismo fichero (merge(merge(P, F), F) = merge(P, F))', () => {
    const p = canonical(records(300, 8, 120), entriesAt(1, 2, 3));
    const f = canonical(records(250, 10, 90), entriesAt(3, 4));
    const once = mergeProgress(p, f);

    expect(mergeProgress(once, f)).toStrictEqual(once);
    expect(mergeProgress(p, p)).toStrictEqual(p);
  });
});

const int = (random: RandomGenerator, n: number): number => Math.floor(random.next() * n);

/** Progreso canónico aleatorio; fechas en un rango pequeño para forzar empates de `playedAt`. */
function randomProgress(random: RandomGenerator): Progress {
  const history = Array.from({ length: int(random, 13) }, () =>
    anEntry({
      playedAt: int(random, 8),
      seed: int(random, 3),
      outcome: random.next() < 0.5 ? 'lost' : 'won',
      timeSeconds: int(random, 3),
      level: 1 + int(random, 2),
      kills: int(random, 3),
    }),
  );
  return canonical(records(int(random, 600), int(random, 30), int(random, 2000)), history);
}

const PAIRS = 200;

describe('Propiedades de la fusión (200 pares generados con Mulberry32, semilla fija)', () => {
  const random = new Mulberry32RandomGenerator(2026);
  const pairs = Array.from({ length: PAIRS }, () => [
    randomProgress(random),
    randomProgress(random),
  ]);

  it('es conmutativa e idempotente, con ≤ 10 entradas en orden descendente de playedAt', () => {
    for (const [a, b] of pairs) {
      if (!a || !b) throw new Error('par incompleto');
      const ab = mergeProgress(a, b);
      const dates = playedAtOf(ab);

      expect(ab).toStrictEqual(mergeProgress(b, a));
      expect(mergeProgress(ab, b)).toStrictEqual(ab);
      expect(mergeProgress(a, a)).toStrictEqual(a);
      expect(ab.history.length).toBeLessThanOrEqual(HISTORY_LIMIT);
      expect(dates).toStrictEqual([...dates].sort((x, y) => y - x));
    }
  });
});
