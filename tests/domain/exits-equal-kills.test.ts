import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aDefaultConfig } from '../support/builders';
import { chooseFirstWhileOpen, startRun } from '../support/runs';

// Caracterización (change 0012, design D6): dentro de una partida un enemigo solo sale del snapshot
// por una baja. El render deduce las muertes de esa salida, así que fija la suposición.
function painted(seed: number, ticks: number, ticksPerFrame: number): RunSnapshot[] {
  const run = startRun(aDefaultConfig(), {}, new Mulberry32RandomGenerator(seed));
  const frames: RunSnapshot[] = [run.snapshot()];
  for (let t = 1; t <= ticks; t++) {
    chooseFirstWhileOpen(run);
    run.tick(PlayerInput.NONE);
    if (t % ticksPerFrame === 0) frames.push(run.snapshot());
  }
  return frames;
}

function mismatches(frames: readonly RunSnapshot[]): number[] {
  const bad: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const next = frames[i];
    if (!prev || !next) continue;
    const alive = new Set(next.enemies.map((e) => e.id));
    const exits = prev.enemies.filter((e) => !alive.has(e.id)).length;
    if (exits !== next.kills - prev.kills) bad.push(next.tick);
  }
  return bad;
}

describe('Salidas del snapshot = bajas (semilla 42, 1.200 ticks)', () => {
  it.each([1, 8])('Scenario: Salidas iguales a bajas (frames de %s tick(s))', (ticksPerFrame) => {
    const frames = painted(42, 1200, ticksPerFrame);
    expect(frames.at(-1)?.kills ?? 0).toBeGreaterThan(0);
    expect(mismatches(frames)).toEqual([]);
  });
});
