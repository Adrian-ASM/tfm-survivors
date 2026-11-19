import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
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

  it('rechaza una velocidad negativa', () => {
    const r = Run.start(aRunConfig({ speed: -5 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toContain('speed');
  });
});
