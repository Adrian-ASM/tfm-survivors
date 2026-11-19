import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from '../../src/application/FixedStepLoop';
import { StartRun } from '../../src/application/StartRun';
import type { TickRun } from '../../src/application/TickRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aRunConfig } from '../support/builders';

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
  const r = new StartRun().execute(aRunConfig());
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
    const rnd = new Mulberry32RandomGenerator(2026);
    const inputs = Array.from({ length: 600 }, () =>
      PlayerInput.of(Math.round(rnd.next() * 2 - 1), Math.round(rnd.next() * 2 - 1)),
    );
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
    const r = new StartRun().execute(aRunConfig({ radius: 300 }));
    expect(r.ok).toBe(false);
  });
});
