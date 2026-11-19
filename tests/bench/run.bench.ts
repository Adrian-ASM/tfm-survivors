import { expect, test } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import { loadRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';

// Benchmark del núcleo sin motor ni render (spec simulation-loop: "Rendimiento con el tope de
// enemigos"). Se ejecuta con `npm run bench`; no bloquea `verify` ni el CI (design 0002).
const SEED = 7;
const CAP = 200;
const MEASURED_TICKS = 600;
const WARMUP_TICKS = 60;
const MAX_MEAN_MS = 2;

/** Partida con el contenido por defecto avanzada hasta tener exactamente 200 enemigos vivos. */
function runAtCap(): Run {
  const config = loadRunConfig();
  if (!config.ok) throw new Error(config.error.message);
  const started = Run.start(config.value, new Mulberry32RandomGenerator(SEED));
  if (!started.ok) throw new Error(started.error.message);
  const run = started.value;
  while (run.snapshot().enemies.length < CAP) run.tick(PlayerInput.NONE);
  return run;
}

const report = (name: string, latency: { mean: number; p99: number }): void => {
  console.info(`${name}: media ${latency.mean.toFixed(4)} ms · p99 ${latency.p99.toFixed(4)} ms`);
};

test('Tope de vivos alcanzado: Run.tick con 200 vivos e input (1, 0)', async ({ bench }) => {
  const run = runAtCap();
  const right = PlayerInput.of(1, 0);
  const result = await bench('Run.tick · 200 vivos', () => {
    run.tick(right);
  }).run({ iterations: MEASURED_TICKS, time: 0, warmupIterations: WARMUP_TICKS, warmupTime: 0 });
  report(result.name, result.latency);
  expect(run.snapshot().enemies).toHaveLength(CAP);
  expect(result.latency.samplesCount).toBeGreaterThanOrEqual(MEASURED_TICKS);
  expect(result.latency.mean).toBeLessThanOrEqual(MAX_MEAN_MS);
});

test('Run.snapshot con 200 vivos (informativo, presupuesto ≤ 0,3 ms)', async ({ bench }) => {
  const run = runAtCap();
  const result = await bench('Run.snapshot · 200 vivos', () => {
    run.snapshot();
  }).run({ iterations: MEASURED_TICKS, time: 0, warmupIterations: WARMUP_TICKS, warmupTime: 0 });
  report(result.name, result.latency);
  expect(result.latency.samplesCount).toBeGreaterThanOrEqual(MEASURED_TICKS);
});
