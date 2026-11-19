import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from '../../src/application/FixedStepLoop';
import { StartRun } from '../../src/application/StartRun';
import { TickRun } from '../../src/application/TickRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { TICK_MS, aRunConfig, aSegment, aWavesConfig } from '../support/builders';
import { randomInputs } from '../support/inputs';
import { aContactConfig, startRun } from '../support/runs';

const ticksFor = (...framesMs: number[]): number[] => {
  const loop = new FixedStepLoop();
  return framesMs.map((ms) => loop.advance(ms, () => undefined));
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
    expect(loop.advance(-10, () => undefined)).toBe(0);
    expect(loop.advance(Number.NaN, () => undefined)).toBe(0);
    expect(loop.accumulatedMs).toBe(0);
  });
});

function start(): TickRun {
  const r = new StartRun().execute(aRunConfig(), new Mulberry32RandomGenerator(2026));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
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
      for (let i = 0; i < 300; i++) r.value.execute(TICK_MS, PlayerInput.NONE);
      return r.value.snapshot();
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
