import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { DEFAULT_WEAPONS, aRunConfig, withWeapons } from '../support/builders';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { playerVisible } from '../../src/infrastructure/phaser/playerBlink';
import { randomInputs } from '../support/inputs';

// Escenarios con el contenido por defecto de 0005 y la política de elección fija ("Partida con
// contactos reproducible", "Partida con armas reproducible"…): determinism-progression.test.ts.
const ARMED = withWeapons(aRunConfig(), DEFAULT_WEAPONS);

function start(seed: number, config: RunConfig = aRunConfig()): Run {
  const r = Run.start(config, new Mulberry32RandomGenerator(seed));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

function play(seed: number, inputs: readonly PlayerInput[], config?: RunConfig): RunSnapshot[] {
  const run = start(seed, config);
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

  it('El parpadeo no altera la simulación (una partida pintada con playerVisible y otra no)', () => {
    const still = Array.from({ length: 600 }, () => PlayerInput.NONE);
    const painted = start(42);
    const plain = play(42, still);
    let hidden = 0;
    for (let i = 0; i < still.length; i++) {
      painted.tick(PlayerInput.NONE);
      const s = painted.snapshot();
      if (!playerVisible(s)) hidden += 1;
      expect(s).toStrictEqual(plain[i]);
    }
    expect(plain.some((s) => s.player.health < s.player.maxHealth)).toBe(true);
    expect(hidden).toBeGreaterThan(0);
  });

  it('Dos partidas idénticas con las armas de 0004, sin mejoras (proyectiles y pulsos)', () => {
    const a = play(42, inputs, ARMED);
    const b = play(42, inputs, ARMED);
    expect(a.some((s) => s.projectiles.length > 0)).toBe(true);
    for (let i = 0; i < inputs.length; i++) expect(a[i]).toStrictEqual(b[i]);
  });

  it('Semillas distintas', () => {
    const first = (snaps: RunSnapshot[]) => snaps.at(-1)?.enemies.map((e) => [e.x, e.y]);
    const one = first(play(1, inputs));
    const two = first(play(2, inputs));
    expect(one?.length).toBeGreaterThan(0);
    expect(one).not.toEqual(two);
  });
});
