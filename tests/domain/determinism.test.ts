import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aRunConfig } from '../support/builders';
import { randomInputs } from '../support/inputs';

function start(seed: number): Run {
  const r = Run.start(aRunConfig(), new Mulberry32RandomGenerator(seed));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

function play(seed: number, inputs: readonly PlayerInput[]): RunSnapshot[] {
  const run = start(seed);
  return inputs.map((input) => {
    run.tick(input);
    return run.snapshot();
  });
}

describe('Determinismo con semilla', () => {
  const inputs = randomInputs(600, 2026);

  it('Dos partidas idénticas', () => {
    const a = play(42, inputs);
    const b = play(42, inputs);
    expect(a.at(-1)?.enemies.length).toBeGreaterThan(0);
    expect(Object.keys(a.at(-1)?.player ?? {})).toEqual(
      expect.arrayContaining(['health', 'maxHealth', 'invulnerable']),
    );
    expect(a.at(-1)).toHaveProperty('status');
    for (let i = 0; i < inputs.length; i++) expect(a[i]).toStrictEqual(b[i]);
  });

  it('Partida con contactos reproducible (semilla 42, quieto, 3.600 ticks, ≥ 1 golpe)', () => {
    const still = Array.from({ length: 3600 }, () => PlayerInput.NONE);
    const a = play(42, still);
    const b = play(42, still);
    expect(a.some((s) => s.player.health < s.player.maxHealth)).toBe(true);
    for (let i = 0; i < still.length; i++) expect(a[i]).toStrictEqual(b[i]);
  });

  it('Semillas distintas', () => {
    const first = (snaps: RunSnapshot[]) => snaps.at(-1)?.enemies.map((e) => [e.x, e.y]);
    const one = first(play(1, inputs));
    const two = first(play(2, inputs));
    expect(one?.length).toBeGreaterThan(0);
    expect(one).not.toEqual(two);
  });
});
