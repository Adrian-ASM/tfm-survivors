import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from '../../src/application/FixedStepLoop';
import { StartRun } from '../../src/application/StartRun';
import { TickRun } from '../../src/application/TickRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { TICK_MS } from '../support/builders';
import { TOUCH, aSiteConfig, declaredSites, startWithSites, withStock } from '../support/sites';

// Spec simulation-loop 0026, "Sin tiempo acumulado en obra" (regresión del bucle de paso fijo: la
// obra congela como la tienda). La obra del solar de prueba se abre en el tick 1.

describe('Sin tiempo acumulado en obra (simulation-loop 0026)', () => {
  it('Scenario: Frames en obra (600 frames: 0 ticks; tras salir, 1 frame = 1 tick)', () => {
    const r = new StartRun().execute(
      aSiteConfig(),
      new Mulberry32RandomGenerator(42),
      { player: TOUCH, ...withStock(15) },
      declaredSites([{ col: 20, row: 10 }]),
    );
    if (!r.ok) throw new Error(r.error.message);
    const { tickRun, leaveSite } = r.value;
    const n = tickRun.execute(TICK_MS, PlayerInput.NONE).tick;
    const during = Array.from({ length: 600 }, () => tickRun.execute(TICK_MS, PlayerInput.NONE));
    leaveSite.execute();
    const after = tickRun.execute(TICK_MS, PlayerInput.NONE);

    expect(during.every((s) => s.tick === n && s.status === 'building')).toBe(true);
    expect(after.tick).toBe(n + 1);
  });

  it('Scenario: Obra a mitad de frame (50 ms = 3 ticks: se ejecuta 1 y el acumulador queda a 0)', () => {
    const loop = new FixedStepLoop();
    const run = new TickRun(startWithSites(aSiteConfig(), withStock(15)), loop);

    const s = run.execute(50, PlayerInput.NONE);

    expect([s.tick, s.status, loop.accumulatedMs]).toEqual([1, 'building', 0]);
  });
});
