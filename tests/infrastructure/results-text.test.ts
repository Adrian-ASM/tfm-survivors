import { describe, expect, it } from 'vitest';
import type { RunOutcome } from '../../src/domain/run/RunPhase';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import {
  RESTART_HINT,
  resultsView,
  survivedClock,
} from '../../src/infrastructure/phaser/resultsText';
import { aDefaultConfig } from '../support/builders';
import { startRun } from '../support/runs';

const base = (): RunSnapshot => startRun(aDefaultConfig()).snapshot();

function ended(outcome: RunOutcome, tick: number, level: number, kills: number): RunSnapshot {
  const s = base();
  return {
    ...s,
    status: 'over',
    outcome,
    tick,
    kills,
    progression: { ...s.progression, level },
  };
}

describe('Tiempo sobrevivido (spec run-results)', () => {
  it('Scenario: Valores de borde (59, 60, 1.259, 35.999 y 36.000)', () => {
    expect([59, 60, 1259, 35_999, 36_000].map(survivedClock)).toEqual([
      '00:00',
      '00:01',
      '00:20',
      '09:59',
      '10:00',
    ]);
  });

  it('Scenario: Más de una hora (tick 360.000 ⇒ 100:00)', () => {
    expect(survivedClock(360_000)).toBe('100:00');
  });
});

describe('Overlay de resultados: contenido (spec run-results)', () => {
  it('Scenario: Overlay tras una derrota (tick 1.259, nivel 3, 41 bajas)', () => {
    expect(resultsView(ended('lost', 1259, 3, 41))).toEqual({
      title: 'Derrota',
      time: '00:20',
      level: 3,
      kills: 41,
      hint: RESTART_HINT,
    });
  });

  it('Scenario: Overlay tras una victoria (tick 36.000, nivel 18, 2.150 bajas)', () => {
    expect(resultsView(ended('won', 36_000, 18, 2150))).toEqual({
      title: 'Victoria',
      time: '10:00',
      level: 18,
      kills: 2150,
      hint: RESTART_HINT,
    });
  });

  it('la pista menciona la tecla R', () => {
    expect(RESTART_HINT).toMatch(/\bR\b/);
  });

  it('sin resultados con la partida en curso o eligiendo mejora', () => {
    const running = base();
    const choosing: RunSnapshot = { ...running, status: 'choosing', outcome: null };

    expect([resultsView(running), resultsView(choosing)]).toEqual([null, null]);
  });
});
