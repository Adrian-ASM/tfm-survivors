import { describe, expect, it } from 'vitest';
import { EMPTY_PROGRESS, HISTORY_LIMIT } from '../../src/domain/progress/Progress';
import { compareEntries, normalizeHistory } from '../../src/domain/progress/history';
import { survivedSeconds } from '../../src/domain/shared/Tick';
import { anEntry, entriesAt } from '../support/progress';

describe('Modelo de progreso (spec progress-persistence)', () => {
  it('Scenario: Progreso vacío (récords a 0 e historial vacío)', () => {
    expect(EMPTY_PROGRESS).toStrictEqual({
      records: { bestTimeSeconds: 0, bestLevel: 0, maxKills: 0 },
      history: [],
    });
  });

  it('el progreso vacío está congelado', () => {
    expect([
      Object.isFrozen(EMPTY_PROGRESS),
      Object.isFrozen(EMPTY_PROGRESS.records),
      Object.isFrozen(EMPTY_PROGRESS.history),
    ]).toEqual([true, true, true]);
  });

  it('el historial guarda como mucho 10 partidas', () => {
    expect(HISTORY_LIMIT).toBe(10);
  });

  it('Scenario: Orden del historial (1.000, 3.000, 2.000 ⇒ 3.000, 2.000, 1.000)', () => {
    const history = normalizeHistory(entriesAt(1000, 3000, 2000));

    expect(history.map((e) => e.playedAt)).toEqual([3000, 2000, 1000]);
  });

  it('duplicados en los 6 campos dentro del mismo documento quedan en uno', () => {
    const history = normalizeHistory([anEntry(), anEntry({ playedAt: 1 }), anEntry()]);

    expect(history).toStrictEqual([anEntry(), anEntry({ playedAt: 1 })]);
  });

  it('dos entradas que solo difieren en kills son distintas', () => {
    const history = normalizeHistory([anEntry({ kills: 41 }), anEntry({ kills: 42 })]);

    expect(history).toHaveLength(2);
  });

  it('el orden con playedAt empatado no depende del orden de llegada', () => {
    const a = anEntry({ playedAt: 5000, seed: 1 });
    const b = anEntry({ playedAt: 5000, seed: 2, outcome: 'won' });
    const c = anEntry({ playedAt: 5000, seed: 1, kills: 7 });

    expect(normalizeHistory([a, b, c])).toStrictEqual(normalizeHistory([c, b, a]));
  });

  it('compareEntries vale 0 si y solo si coinciden los 6 campos', () => {
    const base = anEntry();
    const variants = [
      anEntry({ playedAt: 1 }),
      anEntry({ seed: 1 }),
      anEntry({ outcome: 'won' }),
      anEntry({ timeSeconds: 1 }),
      anEntry({ level: 1 }),
      anEntry({ kills: 1 }),
    ];

    expect(compareEntries(base, anEntry())).toBe(0);
    expect(variants.map((v) => compareEntries(base, v) !== 0)).toEqual(variants.map(() => true));
    expect(variants.map((v) => Math.sign(compareEntries(base, v)))).toEqual(
      variants.map((v) => -Math.sign(compareEntries(v, base))),
    );
  });

  it('normalizeHistory recorta a las 10 más recientes y devuelve un array congelado', () => {
    const history = normalizeHistory(entriesAt(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12));

    expect(history.map((e) => e.playedAt)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
    expect(Object.isFrozen(history)).toBe(true);
  });
});

describe('Tiempo sobrevivido en segundos (spec progress-persistence y run-results)', () => {
  it('⌊tick / 60⌋: 59 ⇒ 0, 60 ⇒ 1, 1.259 ⇒ 20', () => {
    expect([59, 60, 1259].map(survivedSeconds)).toEqual([0, 1, 20]);
  });
});
