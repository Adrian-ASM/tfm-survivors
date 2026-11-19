import { expect, test } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { loadRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';

// Benchmark del núcleo sin motor ni render (spec simulation-loop: "Rendimiento con el tope de
// enemigos"). Se ejecuta con `npm run bench`; no bloquea `verify` ni el CI (design 0002).
const SEED = 7;
const CAP = 200;
const MEASURED_TICKS = 600;
const WARMUP_TICKS = 60;
const MAX_MEAN_MS = 2;
/**
 * Vida del jugador del bench (design 0003): finita y válida, pero inalcanzable. Así se mide el tick
 * completo, con el contacto calculado en cada tick y golpes reales cada 31, sin que la partida se
 * congele por la muerte del jugador.
 */
const BENCH_HEALTH = 1e9;
/** Tope de ticks para llegar a 200 vivos: evita un bucle infinito si algo cambia el contenido. */
const MAX_TICKS_TO_CAP = 36_000;

/** Contenido por defecto con la vida del jugador sustituida por `BENCH_HEALTH`. */
function benchConfig(): RunConfig {
  const config = loadRunConfig();
  if (!config.ok) throw new Error(config.error.message);
  return { ...config.value, player: { ...config.value.player, maxHealth: BENCH_HEALTH } };
}

function start(setup?: RunSetup): Run {
  const started = Run.start(benchConfig(), new Mulberry32RandomGenerator(SEED), setup);
  if (!started.ok) throw new Error(started.error.message);
  return started.value;
}

/** Partida con el contenido por defecto avanzada hasta tener exactamente 200 enemigos vivos. */
function runAtCap(): Run {
  const run = start();
  for (let n = 0; run.snapshot().enemies.length < CAP; n++) {
    if (run.snapshot().status === 'over') {
      throw new Error(
        `La partida terminó en el tick ${String(n)} antes de llegar a ${String(CAP)}`,
      );
    }
    if (n >= MAX_TICKS_TO_CAP) throw new Error(`Sin ${String(CAP)} vivos tras ${String(n)} ticks`);
    run.tick(PlayerInput.NONE);
  }
  return run;
}

/** 200 `bug` en el centro del jugador desde el tick 0 (contacto continuo). */
function runPiledOnPlayer(): Run {
  const enemies = Array.from({ length: CAP }, () => ({ type: 'bug', x: 480, y: 270 }));
  return start({ enemies });
}

const report = (name: string, latency: { mean: number; p99: number }): void => {
  console.info(`${name}: media ${latency.mean.toFixed(4)} ms · p99 ${latency.p99.toFixed(4)} ms`);
};

const OPTIONS = {
  iterations: MEASURED_TICKS,
  time: 0,
  warmupIterations: WARMUP_TICKS,
  warmupTime: 0,
};

test('Tope de vivos alcanzado: Run.tick con 200 vivos e input (1, 0)', async ({ bench }) => {
  const run = runAtCap();
  const right = PlayerInput.of(1, 0);
  const result = await bench('Run.tick · 200 vivos', () => {
    run.tick(right);
  }).run(OPTIONS);
  report(result.name, result.latency);
  expect(run.snapshot().enemies).toHaveLength(CAP);
  expect(run.snapshot().status).toBe('running');
  expect(result.latency.samplesCount).toBeGreaterThanOrEqual(MEASURED_TICKS);
  expect(result.latency.mean).toBeLessThanOrEqual(MAX_MEAN_MS);
});

test('200 enemigos encima del jugador: Run.tick con contacto continuo', async ({ bench }) => {
  const run = runPiledOnPlayer();
  const result = await bench('Run.tick · 200 encima', () => {
    run.tick(PlayerInput.NONE);
  }).run(OPTIONS);
  report(result.name, result.latency);
  const snap = run.snapshot();
  expect(snap.status).toBe('running');
  expect(snap.player.health).toBeLessThan(BENCH_HEALTH);
  expect(result.latency.samplesCount).toBeGreaterThanOrEqual(MEASURED_TICKS);
  expect(result.latency.mean).toBeLessThanOrEqual(MAX_MEAN_MS);
});

test('Run.snapshot con 200 vivos (informativo, presupuesto ≤ 0,3 ms)', async ({ bench }) => {
  const run = runAtCap();
  const result = await bench('Run.snapshot · 200 vivos', () => {
    run.snapshot();
  }).run(OPTIONS);
  report(result.name, result.latency);
  expect(result.latency.samplesCount).toBeGreaterThanOrEqual(MEASURED_TICKS);
});
