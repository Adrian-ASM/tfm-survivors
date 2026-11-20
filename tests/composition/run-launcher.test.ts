import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRunLauncher } from '../../src/composition/runLauncher';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { DomainError } from '../../src/domain/shared/Result';
import { resolveSeed } from '../../src/infrastructure/url/resolveSeed';
import { TICK_MS, aDefaultConfig, aRunConfig } from '../support/builders';
import { startDefault } from '../support/frameDriver';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { loadRunConfig } from '../../src/infrastructure/content/loadRunConfig';

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
const after120 = (tickRun: { execute(ms: number, input: PlayerInput): unknown; snapshot(): unknown }) => {
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

  it('usa el contenido recibido (aDefaultConfig también arranca)', () => {
    const { launch } = launcher({ urlSeed: 3, config: aDefaultConfig() });

    expect(launch.launch()?.tickRun.status).toBe('running');
  });
});
