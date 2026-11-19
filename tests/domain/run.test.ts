import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, SPEED_MUST_BE_POSITIVE } from '../../src/domain/run/Run';
import { aRunConfig } from '../support/builders';

function startedRun(): Run {
  const r = Run.start(aRunConfig());
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('Run', () => {
  it('empieza con el jugador en el centro de la arena', () => {
    expect(startedRun().snapshot()).toEqual({ tick: 0, player: { x: 480, y: 270, radius: 16 } });
  });

  it('Contador de ticks', () => {
    const run = startedRun();
    for (let i = 0; i < 90; i++) run.tick(PlayerInput.NONE);
    expect(run.snapshot().tick).toBe(90);
  });

  it('Snapshot no mutable desde fuera', () => {
    const right = PlayerInput.of(1, 0);
    const run = startedRun();
    for (let i = 0; i < 10; i++) run.tick(right);
    const snap = run.snapshot();
    expect(() => {
      (snap.player as { x: number }).x = 999;
    }).toThrow(TypeError);
    expect(() => {
      (snap as { tick: number }).tick = 0;
    }).toThrow(TypeError);
    run.tick(right);
    const next = run.snapshot();
    expect(next.tick).toBe(11);
    expect(next.player.x).toBeCloseTo(480 + (11 * 200) / 60, 9);
  });

  it('rechaza un radio que no cabe en la arena', () => {
    const r = Run.start(aRunConfig({ radius: 300 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toContain('radius');
  });

  it.each([-5, 0, Number.NaN, Number.POSITIVE_INFINITY])(
    'rechaza una velocidad no positiva o no finita (%s), igual que zod',
    (speed) => {
      const r = Run.start(aRunConfig({ speed }));
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.field).toBe('player.speed');
        expect(r.error.message).toBe(SPEED_MUST_BE_POSITIVE);
      }
    },
  );
});
