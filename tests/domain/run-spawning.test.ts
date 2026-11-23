import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { EnemySnapshot, RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  LONG_RUN_HEALTH,
  SCENARIO_ARENA,
  aSegment,
  aWavesConfig,
  withPlayer,
} from '../support/builders';
import { StubRandom } from '../support/random';

interface Birth {
  readonly tick: number;
  readonly enemy: EnemySnapshot;
  readonly player: RunSnapshot['player'];
}

/** Ejecuta `ticks` ticks sin input y registra cada enemigo en el snapshot de su tick de aparición. */
function simulate(
  config: RunConfig,
  ticks: number,
  options: { random?: RandomGenerator; setup?: RunSetup; beforeTick?: (n: number) => void } = {},
): { run: Run; births: Birth[] } {
  const started = Run.start(
    config,
    options.random ?? new Mulberry32RandomGenerator(42),
    options.setup,
  );
  if (!started.ok) throw new Error(started.error.message);
  const run = started.value;
  const births: Birth[] = [];
  let nextId = 0;
  for (let n = 1; n <= ticks; n++) {
    options.beforeTick?.(n);
    run.tick(PlayerInput.NONE);
    const snap = run.snapshot();
    for (const enemy of snap.enemies) {
      if (enemy.id < nextId) continue;
      births.push({ tick: n, enemy, player: snap.player });
      nextId = enemy.id + 1;
    }
  }
  return { run, births };
}

/** Generador que delega y cuenta llamadas por tick. */
class CountingRandom implements RandomGenerator {
  calls = 0;
  constructor(private readonly inner: RandomGenerator) {}
  next(): number {
    this.calls += 1;
    return this.inner.next();
  }
}

/** Centro del enemigo en [radio, ancho − radio] × [radio, alto − radio] de la arena dada. */
const insideArena = (
  { x, y, radius }: EnemySnapshot,
  arena: RunConfig['arena'] = SCENARIO_ARENA,
): boolean =>
  x >= radius && x <= arena.width - radius && y >= radius && y <= arena.height - radius;

/** Mundo explícito de los escenarios de 0013: 1.920 × 1.080 con la vista de 960 × 540. */
const WORLD: RunConfig['arena'] = { width: 1920, height: 1080, view: { width: 960, height: 540 } };
const inWorld = (config: RunConfig): RunConfig => ({ ...config, arena: WORLD });
const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('Run · oleadas por tramos', () => {
  it('Cambio de tramo', () => {
    const config = aWavesConfig({
      segments: [aSegment(['goblin-torch'], 1), aSegment(['goblin-tnt'], 1, 30)],
    });
    // Prueba el spawn, no el daño: con la vida por defecto el jugador quieto muere antes del tramo 2.
    const { births } = simulate(withPlayer(config, { maxHealth: LONG_RUN_HEALTH }), 3600);
    const before = births.filter((b) => b.tick < 1790).map((b) => b.enemy.type);
    const after = births.filter((b) => b.tick > 1810).map((b) => b.enemy.type);
    expect(new Set(before)).toEqual(new Set(['goblin-torch']));
    expect(new Set(after)).toEqual(new Set(['goblin-tnt']));
  });

  it('Un solo tramo', () => {
    const { births } = simulate(
      aWavesConfig({ segments: [aSegment(['goblin-torch'], 1)] }),
      36_000,
    );
    expect(births.length).toBeGreaterThan(0);
    expect(births.every((b) => b.enemy.type === 'goblin-torch')).toBe(true);
  });
});

describe('Run · posición de aparición', () => {
  it('Jugador en una esquina', () => {
    const config = aWavesConfig({ segments: [aSegment(['goblin-torch', 'goblin-tnt'], 5)] });
    const { births } = simulate(config, 3600, { setup: { player: { x: 16, y: 16 } } });
    expect(births.length).toBeGreaterThan(0);
    for (const b of births) {
      expect(b.player).toMatchObject({ x: 16, y: 16 });
      expect(insideArena(b.enemy)).toBe(true);
      expect(distance(b.enemy, b.player)).toBeGreaterThanOrEqual(200);
    }
  });

  it.each([
    ['Jugador en una esquina', 16, 16],
    ['Jugador en la esquina opuesta', 1904, 1064],
  ])('Scenario: %s del mundo de 1.920 × 1.080 ((%s, %s), 3.600 ticks)', (_name, x, y) => {
    const config = withPlayer(
      inWorld(aWavesConfig({ segments: [aSegment(['goblin-torch', 'goblin-tnt'], 5)] })),
      { maxHealth: LONG_RUN_HEALTH },
    );
    const { births } = simulate(config, 3600, { setup: { player: { x, y } } });
    expect(births.length).toBeGreaterThan(0);
    for (const b of births) {
      expect(b.player).toMatchObject({ x, y });
      expect(insideArena(b.enemy, WORLD)).toBe(true);
      expect(distance(b.enemy, b.player)).toBeGreaterThanOrEqual(200);
    }
  });

  it('Scenario: Ninguna posición válida en el mundo de 1.920 × 1.080 (minDistance 2.500)', () => {
    const config = inWorld(
      aWavesConfig({
        segments: [aSegment(['goblin-torch'], 5)],
        spawn: { minDistance: 2500, maxAttempts: 8 },
      }),
    );
    const random = new CountingRandom(new Mulberry32RandomGenerator(42));
    const perTick: number[] = [];
    let last = 0;
    const { run } = simulate(config, 600, {
      random,
      beforeTick: () => {
        perTick.push(random.calls - last);
        last = random.calls;
      },
    });
    perTick.push(random.calls - last);
    expect(run.snapshot().tick).toBe(600);
    expect(run.snapshot().enemies).toHaveLength(0);
    expect(Math.max(...perTick)).toBeLessThanOrEqual(8);
  });

  it('Ninguna posición válida', () => {
    const config = aWavesConfig({
      segments: [aSegment(['goblin-torch'], 5)],
      spawn: { minDistance: 2000, maxAttempts: 8 },
    });
    const random = new CountingRandom(new Mulberry32RandomGenerator(42));
    const perTick: number[] = [];
    let last = 0;
    const { run } = simulate(config, 600, {
      random,
      beforeTick: () => {
        perTick.push(random.calls - last);
        last = random.calls;
      },
    });
    perTick.push(random.calls - last);
    const snap = run.snapshot();
    expect(snap.tick).toBe(600);
    expect(snap.enemies).toHaveLength(0);
    // Cada tick aplazado hace exactamente 8 intentos; el tipo pendiente se sorteó una vez (tick 1).
    expect(Math.max(...perTick)).toBe(8);
    expect(random.calls).toBe(1 + 8 * (600 - 11));
  });

  it('El presupuesto no se pierde al aplazar', () => {
    // Jugador en (16, 16): con 0,625 (225°) el punto del anillo cae en la esquina, a < 200 → inválido;
    // con 0,125 (45°) queda a 582,7 → válido.
    const stub = new StubRandom(0.625);
    const config = aWavesConfig({ segments: [aSegment(['goblin-torch'], 1)] });
    const { births } = simulate(config, 121, {
      random: stub,
      setup: { player: { x: 16, y: 16 } },
      beforeTick: (n) => {
        if (n === 121) stub.value = 0.125;
      },
    });
    expect(births.map((b) => b.tick)).toEqual([121, 121]);
  });
});

describe('Run · catálogo', () => {
  it('Valores de cada tipo llegan al dominio', () => {
    const config = aWavesConfig({
      types: [{ id: 'goblin-torch', speed: 90, radius: 10, cost: 1, damage: 5, health: 10, xp: 1 }],
      segments: [aSegment(['goblin-torch'], 1)],
    });
    const { run, births } = simulate(config, 60);
    const born = births[0]?.enemy;
    expect(born?.radius).toBe(10);
    for (let i = 0; i < 60; i++) run.tick(PlayerInput.NONE);
    const later = run.snapshot().enemies.find((e) => e.id === born?.id);
    expect(born && later && distance(born, later)).toBeCloseTo(90, 3);
  });
});
