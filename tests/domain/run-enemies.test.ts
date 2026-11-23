import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { EnemySnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aSegment, aWavesConfig } from '../support/builders';
import { StubRandom } from '../support/random';

/** Catálogo con un tipo de velocidad fija y sin presupuesto: solo están los enemigos del setup. */
const quiet = (speed: number, radius = 10): RunConfig =>
  aWavesConfig({
    types: [{ id: 'probe', speed, radius, cost: 1, damage: 5, health: 10, xp: 1 }],
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
    // Arena grande para que el anillo (radio del contenido base) no se recorte.
    const base = aWavesConfig({
      types: [{ id: 'probe', speed: 90, radius: 10, cost: 1, damage: 5, health: 10, xp: 1 }],
      segments: [aSegment(['probe'], 1)],
    });
    const config: RunConfig = {
      ...base,
      arena: { width: 4000, height: 4000 },
    };
    // StubRandom(0): tipo 0 del tramo y ángulo 0 → P = jugador + (radio del anillo, 0).
    const r = Run.start(config, new StubRandom(0));
    if (!r.ok) throw new Error(r.error.message);
    const run = r.value;
    const ring = config.waves.spawn.ringRadius;
    const p = { x: 2000 + ring, y: 2000 };

    ticks(run, 59);
    expect(run.snapshot().enemies).toHaveLength(0);
    run.tick(PlayerInput.NONE);
    const born = first(run);
    expect(run.snapshot().tick).toBe(60);
    expect(born.x).toBeCloseTo(p.x, 9);
    expect(born.y).toBeCloseTo(p.y, 9);

    run.tick(PlayerInput.NONE);
    const next = first(run);
    expect(next.id).toBe(born.id);
    expect(Math.hypot(next.x - p.x, next.y - p.y)).toBeCloseTo(90 / 60, 3);
  });
});
