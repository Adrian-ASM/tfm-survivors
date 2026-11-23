import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRunLauncher } from '../../src/composition/runLauncher';
import { mapModeOf } from '../../src/composition/seedSource';
import { resolveMapMode } from '../../src/infrastructure/url/resolveMapMode';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { DomainError } from '../../src/domain/shared/Result';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { loadRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { PauseGate } from '../../src/infrastructure/phaser/PauseGate';
import { resolveSeed } from '../../src/infrastructure/url/resolveSeed';
import { resolveSpeed } from '../../src/infrastructure/url/resolveSpeed';
import { TICK_MS, aDefaultConfig, aRunConfig } from '../support/builders';
import { startDefault } from '../support/frameDriver';
import { mapForSeed, typesOf } from '../support/mapStats';

const FRAME_60HZ = 16.667;
const FRAME_120HZ = 8.334;
const MAX_SEED = 4_294_967_295;
const inRange = (s: number): boolean => Number.isInteger(s) && s >= 0 && s <= MAX_SEED;
const mentions = (calls: unknown[][], word: string): number =>
  calls.filter((c) => String(c[0]).includes(word)).length;

function defaultConfig(): RunConfig {
  const config = loadRunConfig();
  if (!config.ok) throw new Error(config.error.message);
  return config.value;
}

function launcher(options: { urlSeed: number; draws?: number[]; config?: RunConfig }) {
  const seeds: number[] = [];
  const errors: DomainError[] = [];
  const draws = [...(options.draws ?? [])];
  const launch = createRunLauncher({
    config: options.config ?? defaultConfig(),
    urlSeed: options.urlSeed,
    randomSeed: () => draws.shift() ?? 0,
    onStart: (seed) => seeds.push(seed),
    onContentError: (error) => errors.push(error),
  });
  return { launch, seeds, errors };
}

/** Snapshot tras 120 ticks de 1/60 s sin input (para comparar semillas). */
const after120 = (tickRun: {
  execute(ms: number, input: PlayerInput): unknown;
  snapshot(): unknown;
}) => {
  for (let i = 0; i < 120; i++) tickRun.execute(TICK_MS, PlayerInput.NONE);
  return tickRun.snapshot();
};

describe('createRunLauncher (spec simulation-loop, "Semilla de la partida")', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Scenario: Semilla válida por URL (la 1.ª partida usa la 42)', () => {
    const { launch, seeds } = launcher({ urlSeed: 42, draws: [123] });

    const first = launch.launch();

    expect(seeds).toEqual([42]);
    expect(after120(first?.tickRun ?? startDefault(0).tickRun)).toStrictEqual(
      after120(startDefault(42).tickRun),
    );
  });

  it('Scenario: Semilla nueva tras volver al menú (la fuente da 123: la 2.ª usa la 123)', () => {
    const { launch, seeds } = launcher({ urlSeed: 42, draws: [123] });
    launch.launch();

    const second = launch.launch();

    expect(seeds).toEqual([42, 123]);
    expect(after120(second?.tickRun ?? startDefault(0).tickRun)).toStrictEqual(
      after120(startDefault(123).tickRun),
    );
  });

  it('onStart se llama una vez por partida (runs)', () => {
    const { launch, seeds } = launcher({ urlSeed: 1, draws: [2, 3, 4] });

    for (let i = 0; i < 4; i++) launch.launch();

    expect(seeds).toHaveLength(4);
  });

  it('Scenario: Varios Jugar tras una semilla inválida (4 partidas en rango, 1 aviso en la carga)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const resolved = resolveSeed('?seed=abc', () => 7);
    if (resolved.warning) console.warn(resolved.warning);
    const { launch, seeds } = launcher({
      urlSeed: resolved.seed,
      draws: [0, 4_294_967_295, 99],
    });

    for (let i = 0; i < 4; i++) launch.launch();

    expect(seeds.every((s) => Number.isInteger(s) && s >= 0 && s <= 4_294_967_295)).toBe(true);
    expect(seeds).toHaveLength(4);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('un StartRun que falla llama a onContentError y devuelve null', () => {
    const { launch, seeds, errors } = launcher({ urlSeed: 1, config: aRunConfig({ radius: 300 }) });

    const started = launch.launch();

    expect([started, seeds, errors.map((e) => e.field)]).toEqual([null, [], ['player.radius']]);
  });

  it('Scenario: Jugar tras volver al menú (partidas nuevas: tick 0, 100/100, nivel 1, sin mejoras)', () => {
    const { launch } = launcher({ urlSeed: 42, draws: [5] });
    const first = launch.launch();
    first?.tickRun.execute(200, PlayerInput.of(1, 0));

    const snap = launch.launch()?.tickRun.snapshot();

    expect(snap).toMatchObject({
      tick: 0,
      status: 'running',
      kills: 0,
      player: { health: 100, maxHealth: 100 },
      progression: { level: 1, xp: 0 },
      upgrades: [],
      offer: [],
      enemies: [],
      projectiles: [],
      pulses: [],
      gems: [],
    });
  });

  // Spec procedural-map (0015): la composición juega siempre con el mapa de la semilla (ADR-0013).
  it('cada partida juega con el mapa que genera el núcleo para su semilla (42 y luego 123)', () => {
    const { launch } = launcher({ urlSeed: 42, draws: [123] });
    const config = defaultConfig();

    const first = launch.launch()?.tickRun.map().cells;
    const second = launch.launch()?.tickRun.map().cells;

    expect(first).toEqual(typesOf(mapForSeed(config, 42)));
    expect(second).toEqual(typesOf(mapForSeed(config, 123)));
  });

  it('Scenario: Se mantiene en todas las partidas de la carga (map=empty: todas vacías)', () => {
    const launch = createRunLauncher({
      config: defaultConfig(),
      urlSeed: 42,
      randomSeed: () => 7,
      onStart: () => undefined,
      onContentError: () => undefined,
      mapMode: mapModeOf(resolveMapMode('?e2e&map=empty&manual')),
    });

    const counts = [launch.launch(), launch.launch(), launch.launch()].map(
      (s) => s?.tickRun.map().counts.grass,
    );

    expect(counts).toEqual([2304, 2304, 2304]);
  });

  it('usa el contenido recibido (aDefaultConfig también arranca)', () => {
    const { launch } = launcher({ urlSeed: 3, config: aDefaultConfig() });

    expect(launch.launch()?.tickRun.status).toBe('running');
  });
});

/**
 * Lo que hace `GameScene` en cada entrada: `launcher.launch()` y una `PauseGate` nueva; después,
 * `gate.frame` con el tiempo de cada frame. En el menú no existe partida: los frames del menú no
 * llegan a ningún bucle (no hay a quién pasárselos).
 */
function enterGame(launch: ReturnType<typeof createRunLauncher>) {
  const started = launch.launch();
  if (!started) throw new Error('sin partida');
  const gate = new PauseGate();
  return (ms: number, speed = 1) => gate.frame(started.tickRun, ms, PlayerInput.NONE, speed);
}

describe('Partida lanzada al pulsar Jugar (spec simulation-loop)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Scenario: Primer frame tras Jugar (tras 600 frames y uno de 5.000 ms en el menú: 16,667 ms ⇒ tick 1)', () => {
    const { launch } = launcher({ urlSeed: 42, draws: [5] });
    const menuFrames = [...Array.from({ length: 600 }, () => FRAME_60HZ), 5000];

    const frame = enterGame(launch);

    expect(menuFrames).toHaveLength(601);
    expect(frame(FRAME_60HZ).tick).toBe(1);
  });

  it('Scenario: Primer frame tras Jugar (si en su lugar llega un frame de 8,334 ms: 0 ticks)', () => {
    const { launch } = launcher({ urlSeed: 42, draws: [5] });

    const frame = enterGame(launch);

    expect(frame(FRAME_120HZ).tick).toBe(0);
  });

  it('Primer frame tras Jugar después de Volver al menú: la partida nueva empieza con el acumulador a 0', () => {
    const { launch } = launcher({ urlSeed: 42, draws: [5] });
    const first = enterGame(launch);
    first(25);

    const second = enterGame(launch);

    expect([second(FRAME_120HZ).tick, second(FRAME_120HZ).tick]).toEqual([0, 1]);
  });

  it('Scenario: Velocidad inválida y varios Jugar (?e2e&speed=abc: 1 aviso y 1 tick por frame en las 4)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Como `bootstrap`: la velocidad se resuelve y se avisa una sola vez por carga.
    const speed = resolveSpeed('?e2e&speed=abc');
    if (speed.warning) console.warn(speed.warning);
    const { launch } = launcher({ urlSeed: 42, draws: [1, 2, 3] });

    const ticks = Array.from({ length: 4 }, () => enterGame(launch)(FRAME_60HZ, speed.speed).tick);

    expect([speed.speed, ticks]).toEqual([1, [1, 1, 1, 1]]);
    expect(mentions(warn.mock.calls, 'speed')).toBe(1);
  });

  it('Scenario: Semilla inválida antes y después de Jugar (?seed=abc: 1 aviso al cargar, 0 partidas en el menú)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const resolved = resolveSeed('?seed=abc', () => 7);
    if (resolved.warning) console.warn(resolved.warning);
    const { launch, seeds } = launcher({ urlSeed: resolved.seed, draws: [9] });
    const beforePlay = [mentions(warn.mock.calls, 'seed'), seeds.length];

    launch.launch();

    expect(beforePlay).toEqual([1, 0]);
    expect(seeds.every(inRange)).toBe(true);
    expect([mentions(warn.mock.calls, 'seed'), seeds.length]).toEqual([1, 1]);
  });
});
