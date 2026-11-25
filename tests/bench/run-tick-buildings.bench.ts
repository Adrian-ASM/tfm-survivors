import { expect, test } from 'vitest';
import { seededRun } from '../../src/composition/seedSource';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { loadRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { CHASE_BEHAVIOR } from '../support/builders';

// Benchmark informativo de 0026 (spec simulation-loop, "Rendimiento con edificios y torres"): sin
// motor ni render; con `npm run bench`, no bloquea `verify` ni el CI. Las medias van al
// verify-report.
const SEED = 42;
const CAP = 300;
const OPTIONS = { iterations: 600, time: 0, warmupIterations: 60, warmupTime: 0 };
const HEALTH = 1e9;

/** Contenido por defecto con jugador y enemigos indestructibles y un tipo casi inmóvil. */
function benchConfig(sites = true): RunConfig {
  const r = loadRunConfig();
  if (!r.ok) throw new Error(r.error.message);
  const c = r.value;
  const still = {
    id: 'bench',
    speed: 1e-6,
    radius: 10,
    cost: 1,
    damage: 1,
    health: HEALTH,
    xp: 1,
    behavior: CHASE_BEHAVIOR,
  };
  const { drops } = c.resources;
  return {
    ...c,
    player: { ...c.player, maxHealth: HEALTH },
    enemies: { ...c.enemies, types: [...c.enemies.types, still] },
    resources: {
      ...c.resources,
      drops: {
        ...drops,
        goldPerKill: { ...drops.goldPerKill, bench: 0 },
        stoneChance: { ...drops.stoneChance, bench: 0 },
      },
    },
    run: { durationSeconds: 1e6 },
    buildings: sites ? c.buildings : { ...c.buildings, sites: { ...c.buildings.sites, count: 0 } },
  };
}

/** 300 enemigos de bench en una rejilla sobre todo el mundo: ≥ 1 en el alcance de cada torre. */
function spread(config: RunConfig): NonNullable<RunSetup['enemies']> {
  const { width, height } = config.arena;
  return Array.from({ length: CAP }, (_, i) => ({
    type: 'bench',
    x: 40 + (i % 20) * ((width - 80) / 19),
    y: 40 + Math.floor(i / 20) * ((height - 80) / 14),
  }));
}

function start(config: RunConfig, setup: RunSetup): Run {
  const { random, terrain, stoneRandom } = seededRun(SEED);
  const r = Run.start(config, random, setup, terrain, stoneRandom);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const step = (run: Run): void => {
  while (run.status === 'choosing') run.chooseUpgrade(0);
  if (run.status === 'shopping') run.leaveShop();
  if (run.status === 'building') run.leaveSite();
  run.tick(PlayerInput.NONE);
};

const report = (name: string, mean: number): void => {
  console.info(`${name}: media ${mean.toFixed(4)} ms`);
};

test('Scenario: Peor caso con 6 torres (300 enemigos, 600 ticks) y el mismo caso sin solares', async ({
  bench,
}) => {
  const withTowers = benchConfig();
  const towers = start(withTowers, {
    enemies: spread(withTowers),
    sites: Array.from({ length: 6 }, () => ({ state: 'tower' as const })),
  });
  const bare = benchConfig(false);
  const none = start(bare, { enemies: spread(bare) });
  const a = await bench('Run.tick · 300 vivos + 6 torres', () => {
    step(towers);
  }).run(OPTIONS);
  const b = await bench('Run.tick · 300 vivos sin solares', () => {
    step(none);
  }).run(OPTIONS);
  report(a.name, a.latency.mean);
  report(b.name, b.latency.mean);
  console.info(`diferencia: ${(a.latency.mean - b.latency.mean).toFixed(4)} ms por tick`);
  expect(towers.snapshot().status).toBe('running');
  let arrows = 0;
  for (let t = 0; t < 45; t++) {
    step(towers);
    arrows = Math.max(arrows, towers.snapshot().towerProjectiles.length);
  }
  expect(towers.snapshot().sites.filter((x) => x.state === 'tower')).toHaveLength(6);
  expect(arrows).toBeGreaterThan(0);
});

test('Scenario: Recalcular los campos al construir (casa con 4 casas goblin y sus guardias)', () => {
  const config = benchConfig();
  const probe = start(config, {});
  const first = probe.map.sites[0];
  if (!first) throw new Error('sin solares');
  const runs = Array.from({ length: 30 }, () => {
    const run = start(config, {
      // Tangente a la cara inferior de la huella (0027: se abre al tocarla).
      player: { x: first.x, y: (first.row + first.rows) * probe.map.cellSize + 16 },
      resources: { gold: 0, wood: 15, stone: 0 },
    });
    run.tick(PlayerInput.NONE);
    expect(run.status).toBe('building');
    return run;
  });
  const t0 = performance.now();
  for (const run of runs) {
    run.build('house');
    run.tick(PlayerInput.NONE);
  }
  const mean = (performance.now() - t0) / runs.length;
  report('Run.build casa + primer tick (recálculo de campos)', mean);
  expect(runs.every((r) => r.snapshot().sites[0]?.state === 'house')).toBe(true);
});
