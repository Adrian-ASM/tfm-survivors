import { beforeAll, describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { LONG_RUN_HEALTH, aDefaultConfig, withPlayer } from '../support/builders';
import { chooseFirstWhileOpen, startRun } from '../support/runs';

// Escenarios de 36.000 ticks de run-outcome y simulation-loop (tarea 1.15). Cada simulación se
// hace una vez en `beforeAll` y la comparten varios escenarios.
const TEN_MINUTES = 36_000;

interface Played {
  /** Snapshots de los ticks 1 … final (índice 0 = tick 1). */
  readonly snaps: readonly RunSnapshot[];
  readonly last: RunSnapshot;
}

/** Política de elección fija e input (0, 0) hasta terminar o hasta el tick 36.000. */
function playOut(maxHealth: number | null, seed: number): Played {
  const base = aDefaultConfig();
  const config = maxHealth === null ? base : withPlayer(base, { maxHealth });
  const run = startRun(config, {}, new Mulberry32RandomGenerator(seed));
  const snaps: RunSnapshot[] = [];
  for (let t = 0; t < TEN_MINUTES && run.status !== 'over'; t++) {
    chooseFirstWhileOpen(run);
    run.tick(PlayerInput.NONE);
    snaps.push(run.snapshot());
  }
  const last = snaps.at(-1);
  if (!last) throw new Error('sin ticks');
  return { snaps, last };
}

const invariantHolds = (s: RunSnapshot): boolean =>
  (s.status === 'over') === (s.outcome !== null) && ['won', 'lost', null].includes(s.outcome);

describe('Victoria en 36.000 ticks (vida inalcanzable, semilla 7)', () => {
  let a: Played;
  let b: Played;
  beforeAll(() => {
    a = playOut(LONG_RUN_HEALTH, 7);
    b = playOut(LONG_RUN_HEALTH, 7);
  });

  it('Scenario: Victoria exacta en el tick 36.000', () => {
    const before = a.snaps[TEN_MINUTES - 2];

    expect(before?.tick).toBe(35_999);
    expect(['running', 'choosing']).toContain(before?.status);
    expect(before?.outcome).toBeNull();
    expect(a.last).toMatchObject({ tick: 36_000, status: 'over', outcome: 'won' });
    expect(a.last.player.health).toBeGreaterThan(0);
  });

  it('Scenario: Victoria reproducible (mismo resultado, bajas y snapshot final)', () => {
    expect(b.last).toMatchObject({ tick: 36_000, outcome: 'won', kills: a.last.kills });
    expect(a.last.kills).toBeGreaterThan(0);
    expect(b.last).toStrictEqual(a.last);
  });
});

describe('Partida completa con el contenido por defecto (semilla 42, quieto)', () => {
  let a: Played;
  let b: Played;
  beforeAll(() => {
    a = playOut(null, 42);
    b = playOut(null, 42);
  });

  it('Scenario: Invariante durante una partida completa', () => {
    expect(a.snaps.every(invariantHolds)).toBe(true);
  });

  it('Scenario: Resultado reproducible (mismo resultado, tick y bajas)', () => {
    const summary = (p: Played) => [p.last.outcome, p.last.tick, p.last.kills];

    expect(summary(b)).toEqual(summary(a));
  });

  it('Scenario: Jugador quieto pierde (derrota antes del tick 36.000)', () => {
    expect(a.last.outcome).toBe('lost');
    expect(a.last.tick).toBeLessThan(TEN_MINUTES);
  });
});
