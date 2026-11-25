import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { EnemySnapshot, RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';
import type { EnemyTypeConfig } from '../../src/domain/enemy/EnemyType';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { seededRun, type MapMode } from '../../src/composition/seedSource';
import { CHASE_BEHAVIOR, aDefaultConfig, aRunConfig, aSegment, aWavesConfig } from './builders';
import { emptyWithExit } from './mapLayouts';
import type { ReferenceBot } from './policies';

/** Tipo de enemigo de prueba: radio 10, velocidad 60 (1 unidad por tick), daño 10, vida 5, XP 1. */
export const aProbeType = (overrides: Partial<EnemyTypeConfig> = {}): EnemyTypeConfig => ({
  id: 'probe',
  speed: 60,
  radius: 10,
  cost: 1,
  damage: 10,
  health: 5,
  xp: 1,
  behavior: CHASE_BEHAVIOR,
  ...overrides,
});

type PlayerConfig = RunConfig['player'];
type Segments = RunConfig['waves']['segments'];

/**
 * Contenido para escenarios de contacto: los tipos dados (por defecto `probe`), el jugador por
 * defecto con los cambios dados y, salvo que se pasen tramos, sin presupuesto (solo están los
 * enemigos del `RunSetup`).
 */
export function aContactConfig(
  options: {
    types?: readonly EnemyTypeConfig[];
    player?: Partial<PlayerConfig>;
    segments?: Segments;
    maxAlive?: number;
    maxBudget?: number;
  } = {},
): RunConfig {
  const types = options.types ?? [aProbeType()];
  const base = aWavesConfig({
    types,
    segments: options.segments ?? [aSegment([types[0]?.id ?? 'probe'], 0)],
    ...(options.maxAlive === undefined ? {} : { maxAlive: options.maxAlive }),
    ...(options.maxBudget === undefined ? {} : { maxBudget: options.maxBudget }),
  });
  return { ...base, player: aRunConfig(options.player).player };
}

/**
 * Contenido de los escenarios de comportamiento y peligros (0020): `aContactConfig` en el mundo del
 * contenido (3.840 × 2.160, las posiciones de la spec llegan a (1.300, 1.000)), jugador a 210 px/s,
 * radio de recogida 1 (las gemas de las bajas quedan en el suelo salvo que solapen al jugador)
 * y radio 16, sin armas ni presupuesto salvo que se pidan, y los globales de peligros dados.
 */
export function aBehaviorConfig(
  types: readonly EnemyTypeConfig[],
  options: {
    player?: Partial<PlayerConfig>;
    hazards?: Partial<RunConfig['enemies']['hazards']>;
    segments?: Segments;
    maxAlive?: number;
    maxBudget?: number;
  } = {},
): RunConfig {
  const base = aContactConfig({
    types,
    player: { speed: 210, pickupRadius: 1, ...options.player },
    ...(options.segments ? { segments: options.segments } : {}),
    ...(options.maxAlive === undefined ? {} : { maxAlive: options.maxAlive }),
    ...(options.maxBudget === undefined ? {} : { maxBudget: options.maxBudget }),
  });
  return {
    ...base,
    arena: aDefaultConfig().arena,
    enemies: { ...base.enemies, hazards: { ...base.enemies.hazards, ...options.hazards } },
  };
}

export function startRun(config: RunConfig, setup?: RunSetup, random?: RandomGenerator): Run {
  const r = Run.start(config, random ?? new Mulberry32RandomGenerator(42), setup);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/**
 * Partida sembrada como en producción (`seededRun` de la composición, ADR-0013): "contenido por
 * defecto + semilla" juega con el mapa que genera esa semilla, salvo `mode` 'empty'.
 */
export function startSeededRun(
  config: RunConfig,
  seed: number,
  mode: MapMode = 'generated',
  setup?: RunSetup,
): Run {
  const { random, terrain } = seededRun(seed, mode);
  const r = Run.start(config, random, setup, terrain);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/**
 * Partida con el azar de la semilla y el **mapa vacío con la salida del castillo** declarada
 * ((990, 630) por defecto): la referencia "sin mapa" de las comparaciones de 0016 (design §12.1 A3).
 */
export function startEmptyWithExit(config: RunConfig, seed: number, setup?: RunSetup): Run {
  const { random } = seededRun(seed, 'empty');
  const r = Run.start(config, random, setup, emptyWithExit(config));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** Ejecuta n ticks con el input dado y devuelve los snapshots tras cada uno (índice 0 = tick 1). */
export function ticks(run: Run, n: number, input = PlayerInput.NONE): RunSnapshot[] {
  const snaps: RunSnapshot[] = [];
  for (let i = 0; i < n; i++) {
    run.tick(input);
    snaps.push(run.snapshot());
  }
  return snaps;
}

/**
 * Elige `pick(oferta)` mientras haya una oferta abierta (también las encoladas) y, con la tienda
 * abierta, aplica la política de tienda fija (spec simulation-loop 0024): sale sin comprar.
 */
export function chooseWhileOpen(run: Run, pick: (offer: RunSnapshot['offer']) => number): number {
  let choices = 0;
  while (run.status === 'choosing') {
    const r = run.chooseUpgrade(pick(run.snapshot().offer));
    if (!r.ok) throw new Error(`elección rechazada: ${r.error.code}`);
    choices++;
  }
  if (run.status === 'shopping') run.leaveShop();
  return choices;
}

/** Elige la opción 0 mientras haya una oferta abierta (política de elección fija). */
export const chooseFirstWhileOpen = (run: Run): number => chooseWhileOpen(run, () => 0);

/**
 * Bot de referencia del balance (spec run-outcome, 0010): en cada tick elige con `bot.pick` las
 * ofertas abiertas y luego avanza con `bot.input` sobre el snapshot anterior. Para al terminar.
 * Crea partida y bot desde el mismo `RunConfig` (0013).
 */
export function playReferenceBot(run: Run, bot: ReferenceBot, maxTicks: number): RunSnapshot {
  for (let t = 0; t < maxTicks && run.status !== 'over'; t++) {
    chooseWhileOpen(run, (offer) => bot.pick(offer));
    run.tick(bot.input(run.snapshot()));
  }
  return run.snapshot();
}

/**
 * Ejecuta n ticks con la POLÍTICA DE ELECCIÓN FIJA de simulation-loop: antes de cada tick, si hay
 * una oferta abierta, elige la opción 0 (también en las encoladas). "n ticks" son n ticks
 * ejecutados. Devuelve los snapshots tras cada tick (índice 0 = primer tick ejecutado).
 */
export function advance(run: Run, n: number, input = PlayerInput.NONE): RunSnapshot[] {
  const snaps: RunSnapshot[] = [];
  for (let i = 0; i < n; i++) {
    chooseFirstWhileOpen(run);
    run.tick(input);
    snaps.push(run.snapshot());
  }
  return snaps;
}

/**
 * Como `advance`, sin guardar snapshots: llama a `each` con el número de tick ejecutado (y la
 * partida tras él) y para cuando `each` devuelve true o la partida termina.
 */
export function play(
  run: Run,
  n: number,
  each: (tick: number, run: Run) => boolean = () => false,
  input = PlayerInput.NONE,
): void {
  for (let t = 1; t <= n; t++) {
    chooseFirstWhileOpen(run);
    run.tick(input);
    if (each(t, run) || run.status === 'over') return;
  }
}

/**
 * Semillas que, con input (0, 0) y la política de elección fija, NO han perdido en un tick menor
 * que `limitTicks` (spec run-outcome, "Perdible"): seguir viva en el tick `limitTicks - 1` cuenta.
 */
export function stillSurvivors(
  config: RunConfig,
  seeds: readonly number[],
  limitTicks: number,
  mode: MapMode = 'generated',
): number[] {
  return seeds.filter((seed) => {
    const run = startSeededRun(config, seed, mode);
    play(run, limitTicks - 1);
    const s = run.snapshot();
    return !(s.status === 'over' && s.outcome === 'lost');
  });
}

/** Enemigo del snapshot por id (falla si no está). */
export function enemyById(snap: RunSnapshot, id: number): EnemySnapshot {
  const e = snap.enemies.find((x) => x.id === id);
  if (!e) throw new Error(`se esperaba el enemigo ${String(id)}`);
  return e;
}

/** `count` enemigos del tipo dado en el mismo punto. */
export const pile = (count: number, type: string, x: number, y: number) =>
  Array.from({ length: count }, () => ({ type, x, y }));

/**
 * Preparación de "300 enemigos encima del jugador" (spec simulation-loop, 0013 y 0019): `count`
 * enemigos del tipo dado en el centro de la arena de `config`, el punto donde nace el jugador.
 */
export function pileOnPlayer(config: RunConfig, count: number, type = 'goblin-torch'): RunSetup {
  return { enemies: pile(count, type, config.arena.width / 2, config.arena.height / 2) };
}
