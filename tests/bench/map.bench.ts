import { expect, test } from 'vitest';
import { seededRun } from '../../src/composition/seedSource';
import { generateMap } from '../../src/domain/map/generateMap';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import { buildRunRules } from '../../src/domain/run/RunConfig';
import { loadRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { MAP_STREAM, deriveSeed } from '../../src/infrastructure/random/deriveSeed';

// Benchmark del mapa (change 0015): generación por semilla (spec procedural-map, < 20 ms de
// media, informativo) y el tick con el tope de enemigos sobre el mapa generado. `npm run bench`;
// no bloquea `verify` ni el CI.
const MAX_MAP_MS = 20;
const MAX_TICK_MS = 2;
const CAP = 200;
const SEED = 7;
const BENCH_HEALTH = 1e9;
const BENCH_DURATION = 1e6;
const MAX_TICKS_TO_CAP = 36_000;

const content = (() => {
  const c = loadRunConfig();
  if (!c.ok) throw new Error(c.error.message);
  return c.value;
})();

const report = (name: string, latency: { mean: number; p99: number }): void => {
  console.info(`${name}: media ${latency.mean.toFixed(4)} ms · p99 ${latency.p99.toFixed(4)} ms`);
};

test('Generar mapa: generateMap con el contenido por defecto (semillas 1..)', async ({ bench }) => {
  const rules = buildRunRules(content);
  if (!rules.ok) throw new Error(rules.error.message);
  let seed = 1;
  const result = await bench('generateMap', () => {
    generateMap(rules.value.map, new Mulberry32RandomGenerator(deriveSeed(seed++, MAP_STREAM)));
  }).run({ iterations: 1000, time: 0, warmupIterations: 50, warmupTime: 0 });
  report(result.name, result.latency);
  expect(result.latency.mean).toBeLessThan(MAX_MAP_MS);
});

test('Tope de vivos con el mapa generado: Run.tick con 200 vivos e input (1, 0)', async ({
  bench,
}) => {
  const config = {
    ...content,
    player: { ...content.player, maxHealth: BENCH_HEALTH },
    enemies: { types: content.enemies.types.map((t) => ({ ...t, health: BENCH_HEALTH })) },
    run: { durationSeconds: BENCH_DURATION },
  };
  const { random, terrain } = seededRun(SEED);
  const started = Run.start(config, random, {}, terrain);
  if (!started.ok) throw new Error(started.error.message);
  const run = started.value;
  const step = (input = PlayerInput.NONE) => {
    while (run.status === 'choosing') run.chooseUpgrade(0);
    run.tick(input);
  };
  for (let n = 0; run.snapshot().enemies.length < CAP; n++) {
    if (n >= MAX_TICKS_TO_CAP) throw new Error(`Sin ${String(CAP)} vivos tras ${String(n)} ticks`);
    step();
  }
  const right = PlayerInput.of(1, 0);
  const result = await bench('Run.tick · 200 vivos con mapa', () => {
    step(right);
  }).run({ iterations: 600, time: 0, warmupIterations: 60, warmupTime: 0 });
  report(result.name, result.latency);
  expect(run.snapshot().enemies).toHaveLength(CAP);
  expect(result.latency.mean).toBeLessThanOrEqual(MAX_TICK_MS);
});
