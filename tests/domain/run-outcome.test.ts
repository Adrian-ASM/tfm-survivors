import { describe, expect, it } from 'vitest';
import { aContactConfig, aProbeType, startRun, ticks } from '../support/runs';

const CENTER = { x: 480, y: 270 };

/** Enemigo `type` que entra en contacto con el jugador del centro en el tick `n` (1 px/tick). */
const contactAt = (n: number, type = 'probe') => ({ type, x: 480 + 25 + n, y: 270 });

describe('Vida mínima 0 (spec player-health): llegar a 0 es una derrota', () => {
  it('Scenario: Daño exactamente igual a la vida restante', () => {
    const run = startRun(aContactConfig({ player: { maxHealth: 10 } }), {
      enemies: [{ type: 'probe', ...CENTER }],
    });

    ticks(run, 1);

    expect([run.snapshot().player.health, run.status, run.outcome]).toEqual([0, 'over', 'lost']);
  });

  it('Scenario: Daño mayor que la vida restante (0, no −15)', () => {
    const types = [aProbeType({ damage: 25 })];
    const run = startRun(aContactConfig({ types, player: { maxHealth: 10 } }), {
      enemies: [{ type: 'probe', ...CENTER }],
    });

    ticks(run, 1);

    expect([run.snapshot().player.health, run.outcome]).toEqual([0, 'lost']);
  });

  it('Scenario: Vida que no llega a 0', () => {
    const run = startRun(aContactConfig({ player: { maxHealth: 11 } }), {
      enemies: [{ type: 'probe', ...CENTER }],
    });

    ticks(run, 1);

    expect([run.snapshot().player.health, run.status, run.outcome]).toEqual([1, 'running', null]);
  });
});

describe('Estado de la partida con resultado (spec run-state)', () => {
  it('Scenario: Partida recién creada: en curso y sin resultado', () => {
    const run = startRun(aContactConfig());

    expect([run.status, run.outcome]).toEqual(['running', null]);
  });

  it('Scenario: Terminada por derrota (golpe letal en el tick 100)', () => {
    const run = startRun(aContactConfig({ player: { maxHealth: 10 } }), {
      enemies: [contactAt(100)],
    });

    const snaps = ticks(run, 100);

    expect([snaps[98]?.status, snaps[99]?.status, run.outcome]).toEqual([
      'running',
      'over',
      'lost',
    ]);
  });
});
