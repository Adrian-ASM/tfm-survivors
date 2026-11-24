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
import { sheepFeast } from '../support/sheep';

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

// Spec resources (0022): la pantalla de resultados no muestra oro ni madera (sin cambios de código).
describe('Resultados sin oro ni madera (0022)', () => {
  it('Scenario: Sin rastro en resultados ni en el guardado (las 5 líneas de antes)', () => {
    const view = resultsView({ ...ended('lost', 1259, 3, 41), resources: { gold: 30, wood: 8 } });

    expect(Object.keys(view ?? {})).toEqual(['title', 'time', 'level', 'kills', 'hint']);
    expect(JSON.stringify(view)).not.toMatch(/30|\b8\b/);
  });
});

// Spec sheep (0023), "Ovejas fuera de bajas y resultados" › "Resultados sin ovejas".
describe('Resultados sin ovejas (0023)', () => {
  it('Scenario: Resultados sin ovejas (6 ovejas muertas y 3 carnes recogidas: las 5 líneas de antes)', () => {
    const { first, final } = sheepFeast();
    expect(first.sheep).toEqual([]);
    expect(first.pickups.filter((p) => p.kind === 'meat')).toHaveLength(3);
    expect(final).toMatchObject({ status: 'over', outcome: 'won', kills: 0 });

    const view = resultsView(final);

    expect(Object.keys(view ?? {})).toEqual(['title', 'time', 'level', 'kills', 'hint']);
    expect(view?.kills).toBe(final.kills);
    expect(JSON.stringify(view)).not.toMatch(/sheep|meat|oveja|carne/i);
  });
});
