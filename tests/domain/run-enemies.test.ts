import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { EnemySnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aRunConfig, aSegment, aWavesConfig } from '../support/builders';

/** Catálogo con un tipo de velocidad fija y sin presupuesto: solo están los enemigos del setup. */
const quiet = (speed: number, radius = 10): RunConfig =>
  aWavesConfig({
    types: [{ id: 'probe', speed, radius, cost: 1 }],
    segments: [aSegment(['probe'], 0)],
  });

function start(config: RunConfig, setup?: RunSetup, seed = 42): Run {
  const r = Run.start(config, new Mulberry32RandomGenerator(seed), setup);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const ticks = (run: Run, n: number, input = PlayerInput.NONE): void => {
  for (let i = 0; i < n; i++) run.tick(input);
};

const first = (run: Run): EnemySnapshot => {
  const e = run.snapshot().enemies[0];
  if (!e) throw new Error('se esperaba un enemigo');
  return e;
};

describe('Run · persecución', () => {
  it('Persecución horizontal durante un segundo', () => {
    const run = start(quiet(60), { enemies: [{ type: 'probe', x: 100, y: 270 }] });
    ticks(run, 60);
    expect(first(run).x).toBeCloseTo(160, 3);
    expect(first(run).y).toBeCloseTo(270, 3);
  });

  it('Persigue la posición del jugador en el mismo tick', () => {
    const run = start(quiet(60), { enemies: [{ type: 'probe', x: 480, y: 470 }] });
    run.tick(PlayerInput.of(1, 0));
    const snap = run.snapshot();
    expect(snap.player.x).toBeCloseTo(483.333, 3);
    expect(snap.player.y).toBe(270);
    expect(first(run).x).toBeCloseTo(480.0167, 3);
  });

  it('Dos enemigos idénticos se superponen', () => {
    const at = { type: 'probe', x: 100, y: 270 };
    const run = start(quiet(60), { enemies: [at, at] });
    ticks(run, 60);
    const [a, b] = run.snapshot().enemies;
    expect(a && [a.x, a.y]).toEqual(b && [b.x, b.y]);
    expect(a?.id).not.toBe(b?.id);
  });

  it('Primer tick de vida', () => {
    const run = start(aRunConfig(), {}, 7);
    let spawnTick = 0;
    while (run.snapshot().enemies.length === 0 && spawnTick < 600) {
      run.tick(PlayerInput.NONE);
      spawnTick += 1;
    }
    const born = first(run);
    const { player } = run.snapshot();
    const toPlayer = Math.hypot(player.x - born.x, player.y - born.y);
    run.tick(PlayerInput.NONE);
    const next = first(run);
    expect(spawnTick).toBe(60);
    expect(next.id).toBe(born.id);
    const moved = Math.hypot(next.x - born.x, next.y - born.y);
    expect(moved).toBeCloseTo(Math.min(90 / 60, toPlayer), 3);
  });
});
