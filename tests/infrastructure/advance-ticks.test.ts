import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from '../../src/application/FixedStepLoop';
import { TickRun } from '../../src/application/TickRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { Run } from '../../src/domain/run/Run';
import {
  TICK_MS,
  TICKS_PER_EXECUTE,
  advanceTicks,
} from '../../src/infrastructure/phaser/advanceFrame';
import { aDefaultConfig, aSegment, aWavesConfig, withDuration } from '../support/builders';
import { aContactConfig, startRun } from '../support/runs';

const CENTER = { x: 480, y: 270 };
/** Paso del jugador por tick a 200 px/s (px). */
const STEP_PX = 200 / 60;

/** Partida sin enemigos ni armas: no abre ofertas ni termina en los próximos 225 ticks. */
function quiet(): TickRun {
  return new TickRun(startRun(aContactConfig(), { player: CENTER }), new FixedStepLoop());
}

/** Partida que abre una oferta en el 3.er tick que ejecuta (gema a 36 px con XP 4 de 5). */
function offeringAtThird(): { run: Run; tickRun: TickRun } {
  const base = aDefaultConfig();
  const config = {
    ...base,
    waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves,
  };
  const run = startRun(config, {
    player: CENTER,
    gems: [{ x: 516, y: 270, value: 1 }],
    experience: { level: 1, xp: 4 },
  });
  return { run, tickRun: new TickRun(run, new FixedStepLoop()) };
}

/** Partida sin enemigos con duración objetivo de `seconds`, ya en el tick `at`. */
function lastingAt(seconds: number, at: number): TickRun {
  const run = startRun(withDuration(aContactConfig(), seconds));
  for (let i = 0; i < at; i++) run.tick(PlayerInput.NONE);
  return new TickRun(run, new FixedStepLoop());
}

/** Espía de `execute`: ticks ejecutados por cada llamada. */
function spied(tickRun: TickRun): number[] {
  const perCall: number[] = [];
  const execute = tickRun.execute.bind(tickRun);
  tickRun.execute = (elapsedMs, input) => {
    const before = tickRun.snapshot().tick;
    const snap = execute(elapsedMs, input);
    perCall.push(snap.tick - before);
    return snap;
  };
  return perCall;
}

describe('advanceTicks · troceo en llamadas de ≤ 15 ticks (design 0014 §3.3)', () => {
  it('TICKS_PER_EXECUTE vale 15', () => {
    expect(TICKS_PER_EXECUTE).toBe(15);
  });

  it('execute(15 × TICK_MS) ejecuta 15 ticks', () => {
    expect(quiet().execute(TICKS_PER_EXECUTE * TICK_MS, PlayerInput.NONE).tick).toBe(15);
  });

  it.each([
    [1, 'Un solo tick'],
    [60, 'Avance exacto'],
    [225, 'Más de 15 ticks en un step'],
  ])('Scenario: %s ticks (%s): tick n y ninguna llamada pasa de 15', (n) => {
    const tickRun = quiet();
    const perCall = spied(tickRun);

    const r = advanceTicks(tickRun, n, PlayerInput.NONE);

    expect([r.ticks, r.snapshot.tick, tickRun.snapshot().tick]).toEqual([n, n, n]);
    expect(Math.max(...perCall)).toBeLessThanOrEqual(TICKS_PER_EXECUTE);
  });

  it('Scenario: Oferta a mitad de step (oferta en el tick 3 de 60: devuelve 3, eligiendo)', () => {
    const { tickRun } = offeringAtThird();

    const r = advanceTicks(tickRun, 60, PlayerInput.NONE);

    expect([r.ticks, r.snapshot.tick, r.snapshot.status]).toEqual([3, 3, 'choosing']);
  });

  it('Scenario: Oferta en el último tick del step (oferta en el tick 3 de 3: devuelve 3)', () => {
    const { tickRun } = offeringAtThird();

    const r = advanceTicks(tickRun, 3, PlayerInput.NONE);

    expect([r.ticks, r.snapshot.status]).toEqual([3, 'choosing']);
  });

  it('Scenario: Fin de partida a mitad de step (fin en el tick 60 desde el 59: devuelve 1)', () => {
    const tickRun = lastingAt(1, 59);

    const r = advanceTicks(tickRun, 1000, PlayerInput.NONE);

    expect([r.ticks, r.snapshot.tick, r.snapshot.status]).toEqual([1, 60, 'over']);
  });

  it('Scenario: Victoria al llegar a la duración objetivo (120, desde 100, 50: 20)', () => {
    const tickRun = lastingAt(2, 100);

    const r = advanceTicks(tickRun, 50, PlayerInput.NONE);

    expect([r.ticks, r.snapshot.tick]).toEqual([20, 120]);
    expect(r.snapshot.status === 'over' && r.snapshot.outcome).toBe('won');
  });

  it('una partida que no está en curso devuelve 0 con el mismo snapshot', () => {
    const { tickRun } = offeringAtThird();
    advanceTicks(tickRun, 3, PlayerInput.NONE);
    const before = tickRun.snapshot();

    const r = advanceTicks(tickRun, 60, PlayerInput.of(1, 1));

    expect(r.ticks).toBe(0);
    expect(r.snapshot).toStrictEqual(before);
  });

  it('0 ticks no ejecuta nada', () => {
    const tickRun = quiet();
    const perCall = spied(tickRun);

    const r = advanceTicks(tickRun, 0, PlayerInput.of(1, 0));

    expect([r.ticks, perCall.length, r.snapshot.player.x]).toEqual([0, 0, CENTER.x]);
  });

  it('Scenario: Input leído al empezar el step (input (1, 0) en los 8 ticks)', () => {
    const r = advanceTicks(quiet(), 8, PlayerInput.of(1, 0));

    expect(r.ticks).toBe(8);
    expect(r.snapshot.player.x).toBeCloseTo(CENTER.x + 8 * STEP_PX, 2);
  });
});
