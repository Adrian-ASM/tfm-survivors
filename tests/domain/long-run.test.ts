import { beforeAll, describe, expect, it } from 'vitest';
import type { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { EnemySnapshot, RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aRunConfig, aSegment, aWavesConfig } from '../support/builders';
import { randomInputs } from '../support/inputs';

// Partidas de 10 min (36.000 ticks). Una sola simulación con el contenido por defecto se reutiliza para
// los escenarios de legalidad; sirve además de alarma gruesa de rendimiento dentro de `verify`.
const TEN_MINUTES = 36_000;
const SEED = 7;
const INPUT_SEED = 2026;

interface Violations {
  outside: number;
  tooClose: number;
  births: number;
  maxAlive: number;
}

const inside = ({ x, y, radius }: EnemySnapshot): boolean =>
  x >= radius && x <= 960 - radius && y >= radius && y <= 540 - radius;

function start(config: RunConfig, seed: number): Run {
  const r = Run.start(config, new Mulberry32RandomGenerator(seed));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** Recorre la partida comprobando cada tick: enemigos dentro y nacimientos a ≥ 200 del jugador. */
function audit(inputs: readonly PlayerInput[]): { final: RunSnapshot; v: Violations } {
  const run = start(aRunConfig(), SEED);
  const v: Violations = { outside: 0, tooClose: 0, births: 0, maxAlive: 0 };
  let nextId = 0;
  for (const input of inputs) {
    run.tick(input);
    const { enemies, player } = run.snapshot();
    v.maxAlive = Math.max(v.maxAlive, enemies.length);
    for (const e of enemies) {
      if (!inside(e)) v.outside += 1;
      if (e.id < nextId) continue;
      v.births += 1;
      nextId = e.id + 1;
      if (Math.hypot(e.x - player.x, e.y - player.y) < 200) v.tooClose += 1;
    }
  }
  return { final: run.snapshot(), v };
}

function finalSnapshot(config: RunConfig, seed: number, inputs: readonly PlayerInput[]) {
  const run = start(config, seed);
  for (const input of inputs) run.tick(input);
  return run.snapshot();
}

describe('Partidas largas (10 min)', () => {
  const inputs = randomInputs(TEN_MINUTES, INPUT_SEED);
  let audited: { final: RunSnapshot; v: Violations };

  beforeAll(() => {
    audited = audit(inputs);
  });

  it('Partida larga sin spawns ilegales', () => {
    // Sin muertes (llegan en 0003) nacen exactamente maxAlive enemigos.
    expect(audited.v.births).toBe(200);
    expect(audited.v.tooClose).toBe(0);
  });

  it('Partida larga (enemigos dentro de la arena en todos los ticks)', () => {
    expect(audited.v.outside).toBe(0);
    expect(audited.v.maxAlive).toBe(200);
  });

  it('Partida larga reproducible', () => {
    expect(finalSnapshot(aRunConfig(), SEED, inputs)).toStrictEqual(audited.final);
  });

  it('Mezcla de tipos', () => {
    const all = ['bug', 'memory-leak', 'merge-conflict'];
    const config = aWavesConfig({ segments: [aSegment(all, 2)] });
    const run = start(config, 1);
    const seen = new Set<string>();
    for (const input of inputs) {
      run.tick(input);
      for (const e of run.snapshot().enemies) seen.add(e.type);
      if (seen.size === all.length) break;
    }
    expect([...seen].sort()).toEqual(all);
  });
});
