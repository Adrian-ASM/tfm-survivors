import { expect, test } from 'vitest';
import { CHASE_BEHAVIOR } from '../support/builders';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { loadRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import type { WeaponsConfig } from '../../src/domain/weapon/WeaponLoadout';
import { pileOnPlayer } from '../support/runs';
import { HAZARD_BLOCK_TICKS, hazardWorstCase } from '../support/hazardBench';
import { seededRun } from '../../src/composition/seedSource';
import { FlowField } from '../../src/domain/map/FlowField';
import type { GameMap } from '../../src/domain/map/GameMap';
import { resolveTerrain, type TerrainSource } from '../../src/domain/map/TerrainSource';
import { buildRunRules } from '../../src/domain/run/RunConfig';
import { aLinter, aPulse, weaponsOf } from '../support/weapons';

// Benchmark del núcleo sin motor ni render (spec simulation-loop: "Rendimiento con el tope de
// enemigos"). Se ejecuta con `npm run bench`; no bloquea `verify` ni el CI (design 0002).
const SEED = 7;
const CAP = 300;
const MEASURED_TICKS = 600;
const WARMUP_TICKS = 60;
const MAX_MEAN_MS = 2;
/** Peor caso con gemas (spec "Peor caso con gemas"): 60 ticks medidos, sin calentamiento extra. */
const GEMS = 300;
const GEM_MEASURED_TICKS = 60;
const GEM_WARMUP_TICKS = 0;
/**
 * Vida del jugador del bench (design 0003): finita y válida, pero inalcanzable. Así se mide el tick
 * completo, con el contacto calculado en cada tick y golpes reales cada 31, sin que la partida se
 * congele por la muerte del jugador.
 */
const BENCH_HEALTH = 1e9;
/** Tope de ticks para llegar a 300 vivos: evita un bucle infinito si algo cambia el contenido. */
const MAX_TICKS_TO_CAP = 36_000;
/**
 * Duración del bench (0006): inalcanzable, para que `runAtCap` + los ticks medidos nunca terminen
 * en victoria y la partida siga `running`.
 */
const BENCH_DURATION = 1e6;

/**
 * Contenido por defecto (armas incluidas) con la vida del jugador y la de cada tipo de enemigo
 * sustituidas por `BENCH_HEALTH` (design 0004): con armas, los enemigos mueren y el tope de 300 no
 * se alcanzaría. Se añade el tipo lento `bench` para el peor caso con proyectiles.
 */
function benchConfig(weapons?: WeaponsConfig): RunConfig {
  const config = loadRunConfig();
  if (!config.ok) throw new Error(config.error.message);
  const { player, enemies, upgrades, sheep } = config.value;
  const types = enemies.types.map((t) => ({ ...t, health: BENCH_HEALTH }));
  // Con las armas de bench (cadencia 1), las mejoras de cadencia no pasan la build de peor caso.
  const list = {
    character: upgrades.character,
    weapons: weapons
      ? upgrades.weapons.filter((u) => u.stat !== 'cooldownTicks')
      : upgrades.weapons,
  };
  return {
    ...config.value,
    player: { ...player, maxHealth: BENCH_HEALTH },
    enemies: { ...enemies, types: [...types, BENCH_TYPE] },
    weapons: weapons ?? config.value.weapons,
    upgrades: list,
    run: { durationSeconds: BENCH_DURATION },
    // 0023: ovejas indestructibles en el bench (el pulso de bench alcanza toda la arena).
    sheep: { ...sheep, health: BENCH_HEALTH },
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
  behavior: CHASE_BEHAVIOR,
};

/** Mundo del contenido por defecto (content/arena.json): todas las posiciones se derivan de él. */
const { arena: WORLD } = benchConfig();
/** Mayor que la diagonal del mundo: el alcance cubre toda la arena. */
const REACH = Math.ceil(Math.hypot(WORLD.width, WORLD.height));

/** Armas de bench: proyectil cada tick con alcance mayor que la diagonal y pulso a toda la arena. */
const BENCH_WEAPONS = weaponsOf([
  aLinter({ cooldownTicks: 1, targeting: { mode: 'nearest-in-range', range: REACH } }),
  aPulse({ cooldownTicks: 1, targeting: { mode: 'any-in-radius', radius: REACH } }),
]);

/**
 * 300 `bench` en los bordes izquierdo (x = 10) y derecho (x = ancho − 10), con la y repartida
 * sobre el alto del mundo.
 */
const edgeEnemies = () =>
  Array.from({ length: CAP }, (_, i) => ({
    type: 'bench',
    x: i % 2 === 0 ? 10 : WORLD.width - 10,
    y: 10 + (Math.floor(i / 2) % 100) * ((WORLD.height - 20) / 100),
  }));

function start(
  setup?: RunSetup,
  weapons?: WeaponsConfig,
  terrain?: TerrainSource,
  config: RunConfig = benchConfig(weapons),
): Run {
  const random = new Mulberry32RandomGenerator(SEED);
  const started = Run.start(config, random, setup, terrain);
  if (!started.ok) throw new Error(started.error.message);
  return started.value;
}

/**
 * 300 `bench` en los bordes izquierdo y derecho (a ≥ ancho / 2 − 10 px del jugador): cada
 * proyectil vuela más de 32 ticks, así que con un disparo por tick el tope de 32 está lleno en
 * todos los ticks medidos.
 */
function runWorstCase(): Run {
  const run = start({ enemies: edgeEnemies() }, BENCH_WEAPONS);
  for (let n = 0; n < 40; n++) step(run);
  return run;
}

/**
 * Política de elección fija (spec simulation-loop): si hay una oferta abierta se elige la opción 0
 * antes del tick, dentro del tiempo medido.
 */
function step(run: Run, input: PlayerInput = PlayerInput.NONE): void {
  while (run.status === 'choosing') run.chooseUpgrade(0);
  run.tick(input);
}

/**
 * Peor caso con gemas: el de proyectiles más `maxGems` (300) gemas atraídas en las esquinas
 * inferiores (5, alto − 5) y (ancho − 5, alto − 5), lejos del jugador en (ancho / 2, 16): ni los 40
 * ticks de calentamiento ni los 60 medidos (6 px por tick) llegan a recogerlas.
 */
function runWorstCaseWithGems(): Run {
  const corners = [
    [5, WORLD.height - 5],
    [WORLD.width - 5, WORLD.height - 5],
  ] as const;
  const gems = Array.from({ length: GEMS }, (_, i) => {
    const [cx, cy] = corners[i % 2] ?? corners[0];
    const k = Math.floor(i / 2);
    return {
      x: cx + (cx < WORLD.width / 2 ? 1 : -1) * (k % 10) * 4,
      y: cy - Math.floor(k / 10) * 2,
      value: 1,
      attracted: true,
    };
  });
  const player = { x: WORLD.width / 2, y: 16 };
  const run = start({ player, enemies: edgeEnemies(), gems }, BENCH_WEAPONS);
  for (let n = 0; n < 40; n++) step(run);
  return run;
}

/** Partida con el contenido por defecto avanzada hasta tener exactamente 300 enemigos vivos. */
function runAtCap(): Run {
  const run = start(undefined, undefined, seededRun(SEED).terrain);
  for (let n = 0; run.snapshot().enemies.length < CAP; n++) {
    if (run.snapshot().status === 'over') {
      throw new Error(
        `La partida terminó en el tick ${String(n)} antes de llegar a ${String(CAP)}`,
      );
    }
    if (n >= MAX_TICKS_TO_CAP) throw new Error(`Sin ${String(CAP)} vivos tras ${String(n)} ticks`);
    step(run);
  }
  return run;
}

/**
 * 300 `goblin-torch` (vida BENCH_HEALTH) en el centro del mundo, donde nace el jugador, desde el
 * tick 0 (contacto continuo con cualquier tamaño de mundo; ver piled-contact.test.ts).
 */
function runPiledOnPlayer(): Run {
  return start(pileOnPlayer(benchConfig(), CAP));
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

test('Tope de vivos alcanzado: Run.tick con 300 vivos e input (1, 0)', async ({ bench }) => {
  const run = runAtCap();
  const right = PlayerInput.of(1, 0);
  const result = await bench('Run.tick · 300 vivos', () => {
    step(run, right);
  }).run(OPTIONS);
  report(result.name, result.latency);
  expect(run.snapshot().enemies).toHaveLength(CAP);
  expect(run.snapshot().status).toBe('running');
  expect(result.latency.samplesCount).toBeGreaterThanOrEqual(MEASURED_TICKS);
  expect(result.latency.mean).toBeLessThanOrEqual(MAX_MEAN_MS);
});

test('300 enemigos encima del jugador: Run.tick con contacto continuo', async ({ bench }) => {
  const run = runPiledOnPlayer();
  const result = await bench('Run.tick · 300 encima', () => {
    step(run);
  }).run(OPTIONS);
  report(result.name, result.latency);
  const snap = run.snapshot();
  expect(snap.status).toBe('running');
  expect(snap.player.health).toBeLessThan(BENCH_HEALTH);
  expect(snap.enemies).toHaveLength(CAP);
  expect(result.latency.samplesCount).toBeGreaterThanOrEqual(MEASURED_TICKS);
  expect(result.latency.mean).toBeLessThanOrEqual(MAX_MEAN_MS);
});

test('Peor caso con proyectiles: 300 vivos y 32 proyectiles en todos los ticks', async ({
  bench,
}) => {
  const run = runWorstCase();
  // Gemela determinista: comprueba el tope en cada tick sin meter snapshot() en la medición.
  const twin = runWorstCase();
  let belowCap = 0;
  for (let n = 0; n < WARMUP_TICKS + MEASURED_TICKS; n++) {
    step(twin);
    if (twin.snapshot().projectiles.length < 32) belowCap += 1;
  }
  const result = await bench('Run.tick · 300 vivos + 32 proyectiles', () => {
    step(run);
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

/**
 * Peor caso con peligros (spec simulation-loop, 0020): 300 vivos (100 barriles en mecha escalonada,
 * 100 TNT en carga lista y 100 `goblin-torch` encima del jugador), el tope de dinamitas en vuelo en
 * todos los ticks y explosiones con ≥ 50 enemigos dentro en cada ventana de 10 ticks (lo comprueba
 * hazard-bench-setup.test.ts). La partida se rehace con `RunSetup` cada 60 ticks, fuera del tiempo
 * medido, hasta 600; la media es la de los 600 ticks. Objetivo informativo ≤ 0,25 ms (verify-report).
 */
test('Peor caso con peligros: 300 vivos, mechas, cargas y el tope de dinamitas', async ({
  bench,
}) => {
  const terrain = seededRun(SEED).terrain;
  const config = benchConfig();
  const at = start(undefined, undefined, terrain, config).snapshot().player;
  let total = 0;
  let samples = 0;
  for (let block = 0; block < MEASURED_TICKS / HAZARD_BLOCK_TICKS; block++) {
    const run = start(hazardWorstCase(config, at), undefined, terrain, config);
    const result = await bench('Run.tick · 300 vivos + peligros', () => {
      step(run);
    }).run({ iterations: HAZARD_BLOCK_TICKS, time: 0, warmupIterations: 0, warmupTime: 0 });
    expect(run.snapshot().status).toBe('running');
    total += result.latency.mean * result.latency.samplesCount;
    samples += result.latency.samplesCount;
  }
  const mean = total / samples;
  console.info(`Run.tick · 300 vivos + peligros: media ${mean.toFixed(4)} ms (600 ticks)`);
  expect(samples).toBeGreaterThanOrEqual(MEASURED_TICKS);
  expect(mean).toBeLessThanOrEqual(MAX_MEAN_MS);
});

/** Semilla del peor caso con estructuras (design 0021 §12): mapa generado de la 42. */
const STRUCTURE_SEED = 42;

/**
 * Preparación del "Peor caso con estructuras y guardias" (spec simulation-loop, 0021): 300 guardias
 * vivos (vida BENCH_HEALTH), cada casa en su tope (`house`) y el resto con un puesto (`post`) en la
 * puerta de una casa, repartidos por turnos; la mitad en patrulla y la otra mitad en alerta.
 */
function structureWorstCase(config: RunConfig, map: Run['map']): RunSetup {
  const guard = config.enemies.types.find((t) => t.behavior.initial === 'patrol');
  const houseType = Object.entries(config.structures.types).find(([, t]) => t.guards);
  if (!guard || !houseType) throw new Error('Sin guardias ni casas en el contenido');
  const [houseId, { guards }] = houseType;
  const state = (kind: string) =>
    guard.behavior.states.find((s) => s.kind === kind)?.name ?? guard.behavior.initial;
  const houses = map.structures.flatMap((s, i) =>
    s.type === houseId && s.door ? [{ index: i, x: s.door.x, y: s.door.y }] : [],
  );
  if (!guards || houses.length === 0) throw new Error('Mapa sin casas');
  const atTope = houses.length * guards.max;
  return {
    enemies: Array.from({ length: CAP }, (_, i) => {
      const { index, x, y } = houses[i % houses.length] ?? { index: 0, x: 0, y: 0 };
      const where = i < atTope ? { house: index } : { post: { x, y } };
      return { type: guard.id, x, y, ...where, state: state(i % 2 ? 'alert' : 'patrol') };
    }),
  };
}

/**
 * Peor caso con estructuras y guardias (spec simulation-loop, 0021): mapa de la semilla 42 con
 * todas sus estructuras intactas, 300 guardias (cada casa en su tope, 150 en patrulla y 150 en
 * alerta) e indestructibles, así que siguen 300 vivos. Objetivo informativo ≤ 0,25 ms.
 */
test('Peor caso con estructuras y guardias: 300 guardias, casas en su tope', async ({ bench }) => {
  const config = benchConfig();
  const terrain = () => seededRun(STRUCTURE_SEED).terrain;
  const probe = start(undefined, undefined, terrain(), config);
  const setup = structureWorstCase(config, probe.map);
  const run = start(setup, undefined, terrain(), config);
  const first = run.snapshot();
  expect(first.enemies.filter((e) => e.stateKind === 'patrol')).toHaveLength(CAP / 2);
  expect(first.enemies.filter((e) => e.stateKind === 'alert')).toHaveLength(CAP / 2);
  const result = await bench('Run.tick · 300 guardias + estructuras', () => {
    step(run);
  }).run(OPTIONS);
  report(result.name, result.latency);
  const snap = run.snapshot();
  expect(snap.status).toBe('running');
  expect(snap.enemies).toHaveLength(CAP);
  expect(snap.structures.length).toBeGreaterThan(0);
  expect(snap.structures.filter((s) => s.destroyed)).toEqual([]);
  expect(result.latency.mean).toBeLessThanOrEqual(MAX_MEAN_MS);
});

test('Peor caso con gemas: 300 vivos, 32 proyectiles y 300 gemas atraídas (60 ticks)', async ({
  bench,
}) => {
  const run = runWorstCaseWithGems();
  const twin = runWorstCaseWithGems();
  let broken = 0;
  for (let n = 0; n < GEM_WARMUP_TICKS + GEM_MEASURED_TICKS; n++) {
    step(twin);
    const s = twin.snapshot();
    if (s.projectiles.length < 32 || s.gems.length < GEMS) broken += 1;
  }
  const result = await bench('Run.tick · 300 vivos + 32 proyectiles + 300 gemas', () => {
    step(run);
  }).run({ ...OPTIONS, iterations: GEM_MEASURED_TICKS, warmupIterations: GEM_WARMUP_TICKS });
  report(result.name, result.latency);
  const snap = run.snapshot();
  expect(snap.status).toBe('running');
  expect([snap.enemies.length, snap.projectiles.length, snap.gems.length]).toEqual([CAP, 32, GEMS]);
  expect(broken).toBe(0);
  expect(result.latency.mean).toBeLessThanOrEqual(MAX_MEAN_MS);
});

/**
 * Peor caso con los tres topes llenos (spec simulation-loop 0022): el de gemas sobre el mapa
 * generado de la semilla (estructuras, vetas y montones) con el jugador en su salida, y en el suelo
 * `maxGems` gemas, el tope de oro y el de madera (los montones del mapa más los que faltan),
 * atraídos en las esquinas inferiores, a ≥ 400 px del jugador. Los montones del mapa, a > 308 px de
 * la salida, no se atraen ni se recogen en los 100 ticks.
 */
function runWorstCaseThreeTopes(config: RunConfig = benchConfig(BENCH_WEAPONS), meat = 0): Run {
  const { maxGems, maxGold, maxWood } = config.progression;
  const piles = config.resources.woodPiles.count;
  const corners = [
    [5, WORLD.height - 5],
    [WORLD.width - 5, WORLD.height - 5],
  ] as const;
  const at = (i: number) => {
    const [cx, cy] = corners[i % 2] ?? corners[0];
    const k = Math.floor(i / 2);
    return {
      x: cx + (cx < WORLD.width / 2 ? 1 : -1) * (k % 20) * 4,
      y: cy - Math.floor(k / 20) * 2,
    };
  };
  const kinds = [
    ...Array<'xp'>(maxGems).fill('xp'),
    ...Array<'gold'>(maxGold).fill('gold'),
    ...Array<'wood'>(maxWood - piles).fill('wood'),
    ...Array<'meat'>(meat).fill('meat'),
  ];
  const gems = kinds.map((kind, i) => ({ kind, ...at(i), value: 1, attracted: true }));
  const run = start(
    { enemies: edgeEnemies(), gems },
    BENCH_WEAPONS,
    seededRun(SEED).terrain,
    config,
  );
  for (let n = 0; n < 40; n++) step(run);
  return run;
}

test('Peor caso con los tres topes llenos: 300 vivos, 32 proyectiles y 396 recogibles', async ({
  bench,
}) => {
  const run = runWorstCaseThreeTopes();
  const { maxGems, maxGold, maxWood } = benchConfig().progression;
  const topes = maxGems + maxGold + maxWood;
  const before = run.snapshot();
  const result = await bench('Run.tick · 300 vivos + 32 proyectiles + tres topes llenos', () => {
    step(run);
  }).run({ ...OPTIONS, iterations: GEM_MEASURED_TICKS, warmupIterations: GEM_WARMUP_TICKS });
  report(result.name, result.latency);
  const snap = run.snapshot();
  expect(snap.status).toBe('running');
  expect([before.pickups.length, snap.pickups.length]).toEqual([topes, topes]);
  expect([snap.enemies.length, snap.projectiles.length, snap.veins.length]).toEqual([CAP, 32, 3]);
  expect(result.latency.mean).toBeLessThanOrEqual(MAX_MEAN_MS);
});

/**
 * Peor caso de 0023 (spec simulation-loop, "Peor caso con los cuatro topes llenos"): el de los tres
 * topes más `maxMeat` recogibles `meat` atraídos lejos del jugador y el tope de ovejas del mapa
 * generado, todas en huida en cada tick (radio de huida de bench mayor que la diagonal del mundo).
 */
test('Peor caso con los cuatro topes llenos: 300 vivos, 32 proyectiles, 404 recogibles y ovejas en huida', async ({
  bench,
}) => {
  const base = benchConfig(BENCH_WEAPONS);
  const config = { ...base, sheep: { ...base.sheep, flee: { ...base.sheep.flee, radius: REACH } } };
  const { maxGems, maxGold, maxWood, maxMeat } = config.progression;
  const run = runWorstCaseThreeTopes(config, maxMeat);
  const topes = maxGems + maxGold + maxWood + maxMeat;
  const result = await bench(
    'Run.tick · 300 vivos + 32 proyectiles + cuatro topes + ovejas en huida',
    () => {
      step(run);
    },
  ).run({ ...OPTIONS, iterations: GEM_MEASURED_TICKS, warmupIterations: GEM_WARMUP_TICKS });
  report(result.name, result.latency);
  const snap = run.snapshot();
  expect(snap.status).toBe('running');
  expect(snap.pickups).toHaveLength(topes);
  expect(snap.sheep).toHaveLength(config.sheep.maxAlive);
  expect(snap.sheep.every((o) => o.state === 'flee')).toBe(true);
  expect(result.latency.mean).toBeLessThanOrEqual(MAX_MEAN_MS);
});

test('Run.snapshot con 300 vivos (informativo, presupuesto ≤ 0,3 ms)', async ({ bench }) => {
  const run = runAtCap();
  const result = await bench('Run.snapshot · 300 vivos', () => {
    run.snapshot();
  }).run(OPTIONS);
  report(result.name, result.latency);
  expect(result.latency.samplesCount).toBeGreaterThanOrEqual(MEASURED_TICKS);
});

/** Mapa generado de la semilla del bench (el mismo que `seededRun(SEED)`). */
function benchMap(): GameMap {
  const rules = buildRunRules(benchConfig());
  if (!rules.ok) throw new Error(rules.error.message);
  const map = resolveTerrain(seededRun(SEED).terrain, rules.value.map);
  if (!map.ok) throw new Error(map.error.message);
  return map.value;
}

/**
 * 300 `bench` (casi inmóviles) en centros de celdas caminables sin línea libre hasta el jugador
 * quieto en la salida (1.950, 1.170): al otro lado del río, de troncos o del castillo, repartidos
 * por el mundo (una de cada `stride` celdas candidatas, en orden de filas).
 */
function hiddenEnemies(map: GameMap): NonNullable<RunSetup['enemies']> {
  const field = new FlowField(map);
  const { x, y } = map.start;
  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const cx = c * map.cellSize + map.cellSize / 2;
      const cy = r * map.cellSize + map.cellSize / 2;
      if (map.isWalkable(c, r) && !field.hasClearLine(cx, cy, x, y)) cells.push({ x: cx, y: cy });
    }
  }
  if (cells.length < CAP) throw new Error(`Solo ${String(cells.length)} celdas sin línea libre`);
  const stride = cells.length / CAP;
  return Array.from({ length: CAP }, (_, i) => ({
    type: 'bench',
    ...(cells[Math.floor(i * stride)] ?? cells[0] ?? { x, y }),
  }));
}

test('300 enemigos sin línea libre: Run.tick con el jugador quieto en la salida', async ({
  bench,
}) => {
  const map = benchMap();
  const setup = { enemies: hiddenEnemies(map) };
  const run = start(setup, undefined, seededRun(SEED).terrain);
  // Gemela determinista: ≥ 150 sin línea libre en cada tick (fuera de la medición).
  const twin = start(setup, undefined, seededRun(SEED).terrain);
  const field = new FlowField(map);
  let fewHidden = 0;
  for (let n = 0; n < WARMUP_TICKS + MEASURED_TICKS; n++) {
    step(twin);
    const s = twin.snapshot();
    const hidden = s.enemies.filter((e) => !field.hasClearLine(e.x, e.y, s.player.x, s.player.y));
    if (hidden.length < CAP / 2) fewHidden += 1;
  }
  const result = await bench('Run.tick · 300 sin línea libre', () => {
    step(run);
  }).run(OPTIONS);
  report(result.name, result.latency);
  expect(run.snapshot().status).toBe('running');
  expect(run.snapshot().enemies).toHaveLength(CAP);
  expect(fewHidden).toBe(0);
  expect(result.latency.mean).toBeLessThanOrEqual(MAX_MEAN_MS);
});

/**
 * Jugador ante la puerta (fila 19, libre por la zona de inicio) con velocidad de escenario 3.600
 * px/s (60 px por tick) e input alterno (1, 0) / (−1, 0): cambia de celda en cada tick (design §7).
 */
test('Jugador que cambia de celda en cada tick: Run.tick con 300 vivos', async ({ bench }) => {
  const base = benchConfig();
  const config = { ...base, player: { ...base.player, speed: 3600 } };
  const setup = { enemies: edgeEnemies() };
  const make = () => start(setup, undefined, seededRun(SEED).terrain, config);
  const inputs = [PlayerInput.of(1, 0), PlayerInput.of(-1, 0)];
  const twin = make();
  let sameCell = 0;
  let last = Math.floor(twin.snapshot().player.x / 60);
  for (let n = 0; n < WARMUP_TICKS + MEASURED_TICKS; n++) {
    step(twin, inputs[n % 2]);
    const col = Math.floor(twin.snapshot().player.x / 60);
    if (col === last) sameCell += 1;
    last = col;
  }
  const run = make();
  let k = 0;
  const result = await bench('Run.tick · 300 vivos, jugador cambia de celda', () => {
    step(run, inputs[k++ % 2]);
  }).run(OPTIONS);
  report(result.name, result.latency);
  expect(run.snapshot().status).toBe('running');
  expect(sameCell).toBe(0);
  expect(result.latency.mean).toBeLessThanOrEqual(MAX_MEAN_MS);
});
