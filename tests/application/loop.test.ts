import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from '../../src/application/FixedStepLoop';
import { StartRun } from '../../src/application/StartRun';
import { TickRun } from '../../src/application/TickRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { TICK_MS, aDefaultConfig, aRunConfig, aSegment, aWavesConfig } from '../support/builders';
import { randomInputs } from '../support/inputs';
import { aContactConfig, startRun } from '../support/runs';

const ticksFor = (...framesMs: number[]): number[] => {
  const loop = new FixedStepLoop();
  return framesMs.map((ms) => loop.advance(ms, () => true));
};

describe('FixedStepLoop · paso fijo', () => {
  it('Un frame de 1/60 s', () => {
    expect(ticksFor(16.667)).toEqual([1]);
  });

  it('Monitor de 120 Hz', () => {
    expect(ticksFor(8.334, 8.334)).toEqual([0, 1]);
  });

  it('Monitor de 30 Hz', () => {
    expect(ticksFor(33.334)).toEqual([2]);
  });

  it('Pestaña en segundo plano', () => {
    expect(ticksFor(5000)).toEqual([15]);
  });

  it('Tiempo negativo o no numérico', () => {
    const loop = new FixedStepLoop();
    expect(loop.advance(-10, () => true)).toBe(0);
    expect(loop.advance(Number.NaN, () => true)).toBe(0);
    expect(loop.accumulatedMs).toBe(0);
  });
});

describe('FixedStepLoop · corte del frame', () => {
  it('Scenario: Oferta a mitad de frame (50 ms: 1 tick y acumulador a 0; luego 8,334 ms: 0)', () => {
    const loop = new FixedStepLoop();
    let calls = 0;
    const ran = loop.advance(50, () => {
      calls += 1;
      return false;
    });
    expect([ran, calls, loop.accumulatedMs]).toEqual([1, 1, 0]);
    expect(loop.advance(8.334, () => true)).toBe(0);
  });

  it('reset() descarta el tiempo acumulado', () => {
    const loop = new FixedStepLoop();
    loop.advance(10, () => true);
    expect(loop.accumulatedMs).toBeCloseTo(10, 9);
    loop.reset();
    expect(loop.accumulatedMs).toBe(0);
    expect(loop.advance(10, () => true)).toBe(0);
  });
});

function start(): TickRun {
  const r = new StartRun().execute(aRunConfig(), new Mulberry32RandomGenerator(2026));
  if (!r.ok) throw new Error(r.error.message);
  return r.value.tickRun;
}

describe('TickRun', () => {
  it('Tiempo independiente del refresco', () => {
    const at60 = start();
    const at165 = start();
    const right = PlayerInput.of(1, 0);
    for (let i = 0; i < 60; i++) at60.execute(16.667, right);
    for (let i = 0; i < 165; i++) at165.execute(6.061, right);
    const a = at60.snapshot();
    const b = at165.snapshot();
    expect(Math.abs(a.tick - b.tick)).toBeLessThanOrEqual(1);
    expect(a.tick).toBe(60);
    expect(Math.abs(a.player.x - b.player.x)).toBeLessThanOrEqual(3.4);
  });

  it('Dos partidas idénticas', () => {
    const inputs = randomInputs(600, 2026);
    const a = start();
    const b = start();
    for (const input of inputs) {
      a.execute(1000 / 60, input);
      b.execute(1000 / 60, input);
    }
    expect(a.snapshot()).toStrictEqual(b.snapshot());
    expect(a.snapshot().tick).toBe(600);
  });

  it('StartRun propaga el error de contenido', () => {
    const r = new StartRun().execute(aRunConfig({ radius: 300 }), new Mulberry32RandomGenerator(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe('player.radius');
  });

  it('StartRun propaga el error de contenido de enemigos y oleadas', () => {
    const config = aWavesConfig({ segments: [aSegment(['bug', 'segfault'], 1)] });
    const r = new StartRun().execute(config, new Mulberry32RandomGenerator(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe('waves.segments.0.types.1');
  });

  it('StartRun usa el generador recibido: misma semilla, mismos enemigos', () => {
    const play = (seed: number) => {
      const r = new StartRun().execute(aRunConfig(), new Mulberry32RandomGenerator(seed));
      if (!r.ok) throw new Error(r.error.message);
      for (let i = 0; i < 300; i++) r.value.tickRun.execute(TICK_MS, PlayerInput.NONE);
      return r.value.tickRun.snapshot();
    };
    expect(play(9).enemies.length).toBeGreaterThan(0);
    expect(play(9)).toStrictEqual(play(9));
    expect(play(9).enemies).not.toEqual(play(10).enemies);
  });

  it('600 ticks después de terminar (vía caso de uso): mismo snapshot y sin errores', () => {
    const run = startRun(aContactConfig({ player: { maxHealth: 10 } }), {
      enemies: [{ type: 'probe', x: 480, y: 270 }],
    });
    const tickRun = new TickRun(run);
    const ended = tickRun.execute(TICK_MS, PlayerInput.NONE);
    expect(ended.status).toBe('over');
    for (let frame = 0; frame < 40; frame++) {
      // 250 ms por frame: el bucle pide 15 ticks cada vez (600 en total).
      expect(tickRun.execute(250, PlayerInput.of(1, 1))).toStrictEqual(ended);
    }
  });
});

describe('TickRun · sin tiempo acumulado durante la elección', () => {
  /** Partida que abre una oferta en el tick 1 (gema a 20 px con XP 4). */
  function offering() {
    const base = aDefaultConfig();
    const config = { ...base, waves: aWavesConfig({ segments: [aSegment(['bug'], 0)] }).waves };
    const run = startRun(config, {
      player: { x: 480, y: 270 },
      gems: [{ x: 500, y: 270, value: 1 }],
      experience: { level: 1, xp: 4 },
    });
    return { run, tickRun: new TickRun(run) };
  }

  it('Scenario: Oferta a mitad de frame (50 ms con la oferta en el primer tick: 1 tick)', () => {
    const { tickRun } = offering();
    const snap = tickRun.execute(50, PlayerInput.NONE);
    expect([snap.tick, snap.status]).toEqual([1, 'choosing']);
  });

  it('Scenario: Frames durante la elección (600 frames: 0 ticks, sigue en el tick n)', () => {
    const { tickRun } = offering();
    tickRun.execute(TICK_MS, PlayerInput.NONE);
    let last = tickRun.snapshot();
    for (let i = 0; i < 600; i++) last = tickRun.execute(16.667, PlayerInput.of(1, 1));
    expect([last.tick, last.status, last.player.x]).toEqual([1, 'choosing', 480]);
  });

  it('Scenario: Primer frame tras elegir (16,667 ms: exactamente 1 tick, n + 1)', () => {
    const { run, tickRun } = offering();
    tickRun.execute(TICK_MS, PlayerInput.NONE);
    for (let i = 0; i < 600; i++) tickRun.execute(16.667, PlayerInput.NONE);
    expect(run.chooseUpgrade(0).ok).toBe(true);
    expect(tickRun.execute(16.667, PlayerInput.NONE).tick).toBe(2);
  });

  it('Scenario: Oferta a mitad de frame (tras elegir, un frame de 8,334 ms ejecuta 0 ticks)', () => {
    const { run, tickRun } = offering();
    tickRun.execute(50, PlayerInput.NONE);
    expect(run.chooseUpgrade(0).ok).toBe(true);
    expect(tickRun.execute(8.334, PlayerInput.NONE).tick).toBe(1);
  });
});

describe('TickRun · acumulador', () => {
  it('no acumula tiempo con la partida eligiendo ni terminada, y corta el frame que abre la oferta', () => {
    const base = aDefaultConfig();
    const config = { ...base, waves: aWavesConfig({ segments: [aSegment(['bug'], 0)] }).waves };
    const run = startRun(config, {
      player: { x: 480, y: 270 },
      gems: [{ x: 500, y: 270, value: 1 }],
      experience: { level: 1, xp: 4 },
    });
    const loop = new FixedStepLoop();
    const tickRun = new TickRun(run, loop);
    let steps = 0;
    const spy = run.tick.bind(run);
    run.tick = (input) => {
      steps += 1;
      spy(input);
    };
    tickRun.execute(50, PlayerInput.NONE);
    expect([steps, loop.accumulatedMs]).toEqual([1, 0]);
    tickRun.execute(10, PlayerInput.NONE);
    tickRun.execute(16.667, PlayerInput.NONE);
    expect([steps, loop.accumulatedMs]).toEqual([1, 0]);
  });
});
