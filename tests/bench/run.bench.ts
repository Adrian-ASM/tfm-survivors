import { expect, test } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { loadRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import type { WeaponsConfig } from '../../src/domain/weapon/WeaponLoadout';
import { aLinter, aPulse, weaponsOf } from '../support/weapons';

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

/**
 * Contenido por defecto (armas incluidas) con la vida del jugador y la de cada tipo de enemigo
 * sustituidas por `BENCH_HEALTH` (design 0004): con armas, los enemigos mueren y el tope de 200 no
 * se alcanzaría. Se añade el tipo lento `bench` para el peor caso con proyectiles.
 */
function benchConfig(weapons?: WeaponsConfig): RunConfig {
  const config = loadRunConfig();
  if (!config.ok) throw new Error(config.error.message);
  const { player, enemies } = config.value;
  const types = enemies.types.map((t) => ({ ...t, health: BENCH_HEALTH }));
  return {
    ...config.value,
    player: { ...player, maxHealth: BENCH_HEALTH },
    enemies: { types: [...types, BENCH_TYPE] },
    weapons: weapons ?? config.value.weapons,
  };
}

/** Enemigo de bench: casi inmóvil e indestructible en la duración del bench. */
const BENCH_TYPE = {
  id: 'bench',
  speed: 1e-6,
  radius: 10,
  cost: 1,
  damage: 1,
  health: BENCH_HEALTH,
  xp: 1,
};

/** Armas de bench: proyectil cada tick con alcance mayor que la diagonal y pulso a toda la arena. */
const BENCH_WEAPONS = weaponsOf([
  aLinter({ cooldownTicks: 1, targeting: { mode: 'nearest-in-range', range: 2000 } }),
  aPulse({ cooldownTicks: 1, targeting: { mode: 'any-in-radius', radius: 2000 } }),
]);

function start(setup?: RunSetup, weapons?: WeaponsConfig): Run {
  const config = benchConfig(weapons);
  const started = Run.start(config, new Mulberry32RandomGenerator(SEED), setup);
  if (!started.ok) throw new Error(started.error.message);
  return started.value;
}

/**
 * 200 `bench` en los bordes izquierdo y derecho (a ≥ 470 px del jugador): cada proyectil vuela
 * ≥ 57 ticks, así que con un disparo por tick el tope de 32 está lleno en todos los ticks medidos.
 */
function runWorstCase(): Run {
  const enemies = Array.from({ length: CAP }, (_, i) => ({
    type: 'bench',
    x: i % 2 === 0 ? 10 : 950,
    y: 10 + (Math.floor(i / 2) % 100) * 5.2,
  }));
  const run = start({ enemies }, BENCH_WEAPONS);
  for (let n = 0; n < 40; n++) run.tick(PlayerInput.NONE);
  return run;
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

/** 200 `bug` (vida BENCH_HEALTH) en el centro del jugador desde el tick 0 (contacto continuo). */
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
  expect(snap.enemies).toHaveLength(CAP);
  expect(result.latency.samplesCount).toBeGreaterThanOrEqual(MEASURED_TICKS);
  expect(result.latency.mean).toBeLessThanOrEqual(MAX_MEAN_MS);
});

test('Peor caso con proyectiles: 200 vivos y 32 proyectiles en todos los ticks', async ({
  bench,
}) => {
  const run = runWorstCase();
  // Gemela determinista: comprueba el tope en cada tick sin meter snapshot() en la medición.
  const twin = runWorstCase();
  let belowCap = 0;
  for (let n = 0; n < WARMUP_TICKS + MEASURED_TICKS; n++) {
    twin.tick(PlayerInput.NONE);
    if (twin.snapshot().projectiles.length < 32) belowCap += 1;
  }
  const result = await bench('Run.tick · 200 vivos + 32 proyectiles', () => {
    run.tick(PlayerInput.NONE);
  }).run(OPTIONS);
  report(result.name, result.latency);
  const snap = run.snapshot();
  expect(snap.status).toBe('running');
  expect(snap.enemies).toHaveLength(CAP);
  expect(snap.projectiles).toHaveLength(32);
  expect(belowCap).toBe(0);
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
