import { describe, expect, it } from 'vitest';
import { buildRunRules, type RunConfig } from '../../src/domain/run/RunConfig';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';
import { WaveDirector, type SpawnAttempt } from '../../src/domain/wave/WaveDirector';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aRunConfig } from '../support/builders';
import { StubRandom } from '../support/random';

type Segment = RunConfig['waves']['segments'][number];

const config = (segments: Segment[], maxAlive = 200, maxBudget = 10): RunConfig => {
  const base = aRunConfig();
  return { ...base, waves: { ...base.waves, maxAlive, maxBudget, segments } };
};

interface HarnessOptions {
  maxAlive?: number;
  maxBudget?: number;
  /** Enemigos vivos al empezar (sin haber aparecido por el director). */
  alive?: number;
  random?: RandomGenerator;
  accept?: (tick: number) => boolean;
}

/**
 * Director + registro de lo aparecido, con un `place` falso que acepta según `accept(tick)`.
 * El número de vivos lo controla el harness: `kill(n)` simula n bajas.
 */
function harness(segments: Segment[], options: HarnessOptions = {}) {
  const rules = buildRunRules(config(segments, options.maxAlive, options.maxBudget));
  if (!rules.ok) throw new Error(rules.error.message);
  const director = new WaveDirector(
    rules.value.table,
    rules.value.spawn,
    options.random ?? new Mulberry32RandomGenerator(1),
  );
  const spawned: { tick: number; type: string }[] = [];
  let tick = 0;
  let alive = options.alive ?? 0;
  const accept = options.accept ?? (() => true);
  const place: SpawnAttempt = (type) => {
    if (!accept(tick)) return false;
    spawned.push({ tick, type: type.id });
    alive += 1;
    return true;
  };
  const run = (ticks: number): void => {
    for (let i = 0; i < ticks; i++) {
      tick += 1;
      director.step(tick, alive, place);
    }
  };
  const kill = (n: number): void => {
    alive -= n;
  };
  return { run, kill, spawned, alive: () => alive };
}

const only = (types: string[], budgetPerSecond: number, fromSecond = 0): Segment => ({
  fromSecond,
  budgetPerSecond,
  types,
});

describe('WaveDirector · presupuesto', () => {
  it('Ritmo constante con coste 1', () => {
    const h = harness([only(['goblin-torch'], 1)], { maxBudget: 3 });
    h.run(615);
    expect(h.spawned).toHaveLength(10);
    expect(h.spawned[0]?.tick).toBe(60);
  });

  it('El coste retrasa la aparición', () => {
    const h = harness([only(['goblin-tnt'], 1)], { maxBudget: 3 });
    h.run(175);
    expect(h.spawned).toHaveLength(0);
    h.run(10);
    expect(h.spawned).toHaveLength(1);
    expect(h.spawned[0]).toEqual({ tick: 180, type: 'goblin-tnt' });
  });

  it('Varios spawns en un tick', () => {
    const h = harness([only(['goblin-torch'], 630)], { maxBudget: 20 });
    h.run(1);
    expect(h.spawned).toHaveLength(10);
  });

  it('Tramo sin presupuesto', () => {
    const h = harness([only(['goblin-torch'], 0)]);
    h.run(600);
    expect(h.spawned).toHaveLength(0);
  });

  it('elige el tipo pendiente con 1 valor del generador, también con un solo tipo', () => {
    const stub = new StubRandom(0.5);
    const h = harness([only(['goblin-torch'], 1)], { random: stub });
    h.run(1);
    expect(stub.calls).toBe(1);
    h.run(59);
    expect(stub.calls).toBe(2);
    expect(h.spawned).toHaveLength(1);
  });

  it('elige el tipo con floor(next() · n) entre los tipos del tramo', () => {
    const types = ['goblin-torch', 'goblin-barrel', 'goblin-tnt'];
    const pick = (value: number): string | undefined => {
      const h = harness([only(types, 180)], { random: new StubRandom(value) });
      h.run(1);
      return h.spawned[0]?.type;
    };
    expect([pick(0), pick(0.34), pick(0.99)]).toEqual(types);
  });
});

describe('WaveDirector · tope de vivos', () => {
  it('Se alcanza el tope', () => {
    const h = harness([only(['goblin-torch'], 1000)], { maxBudget: 20 });
    h.run(13);
    expect(h.spawned).toHaveLength(200);
  });

  it('El tope se mantiene, sin consumir azar', () => {
    const stub = new StubRandom(0.5);
    const h = harness([only(['goblin-torch'], 1000)], { maxBudget: 20, random: stub });
    h.run(13);
    const calls = stub.calls;
    h.run(600);
    expect(h.spawned).toHaveLength(200);
    expect(stub.calls).toBe(calls);
  });

  it('Tope mínimo', () => {
    const h = harness([only(['goblin-torch'], 10)], { maxAlive: 1 });
    h.run(600);
    expect(h.spawned).toHaveLength(1);
  });

  it('Presupuesto en el máximo al abrirse varios huecos (3 y después 4)', () => {
    const h = harness([only(['goblin-torch'], 60)], { maxAlive: 5, maxBudget: 3, alive: 5 });
    h.run(600);
    expect(h.spawned).toHaveLength(0);
    h.kill(5);
    h.run(1);
    expect(h.alive()).toBe(3);
    h.run(1);
    expect(h.alive()).toBe(4);
  });

  it('Huecos sin presupuesto suficiente', () => {
    const h = harness([only(['goblin-torch'], 0)], { maxAlive: 5, maxBudget: 3, alive: 5 });
    h.kill(2);
    h.run(600);
    expect(h.alive()).toBe(3);
  });

  it('bajo el tope nunca aparecen más de los huecos libres, aunque sobre presupuesto', () => {
    const h = harness([only(['goblin-torch'], 6000)], { maxAlive: 5, maxBudget: 20, alive: 5 });
    h.run(10);
    h.kill(1);
    h.run(1);
    expect(h.alive()).toBe(5);
    expect(h.spawned).toHaveLength(1);
  });
});

describe('WaveDirector · máximo de presupuesto guardado', () => {
  it('El máximo acota los spawns de un tick (630/s, máximo 5 → 5)', () => {
    const h = harness([only(['goblin-torch'], 630)], { maxBudget: 5 });
    h.run(1);
    expect(h.spawned).toHaveLength(5);
  });

  it('Máximo de presupuesto igual al coste más caro: 1 goblin-tnt en 185 ticks', () => {
    const h = harness([only(['goblin-tnt'], 1)], { maxBudget: 3 });
    h.run(185);
    expect(h.spawned).toEqual([{ tick: 180, type: 'goblin-tnt' }]);
  });
});

describe('WaveDirector · aplazamiento', () => {
  it('El presupuesto no se pierde al aplazar', () => {
    const h = harness([only(['goblin-torch'], 1)], { accept: (tick) => tick >= 121 });
    h.run(120);
    expect(h.spawned).toHaveLength(0);
    h.run(1);
    expect(h.spawned.map((s) => s.tick)).toEqual([121, 121]);
  });

  it('aplazar mantiene el tipo pendiente y no vuelve a sortearlo', () => {
    const stub = new StubRandom(0.9);
    const h = harness([only(['goblin-torch', 'goblin-tnt'], 1)], {
      random: stub,
      accept: (tick) => tick > 300,
    });
    h.run(300);
    expect(stub.calls).toBe(1);
    stub.value = 0;
    h.run(1);
    expect(h.spawned[0]).toEqual({ tick: 301, type: 'goblin-tnt' });
  });

  it('un aplazamiento termina el tick: un solo intento de colocación por tick', () => {
    let attempts = 0;
    const h = harness([only(['goblin-torch'], 6000)], {
      accept: () => {
        attempts += 1;
        return false;
      },
    });
    h.run(10);
    expect(attempts).toBe(10);
  });
});

describe('WaveDirector · cambio de tramo', () => {
  it('Cambio de tramo', () => {
    const h = harness([only(['goblin-torch'], 1), only(['goblin-tnt'], 1, 30)]);
    h.run(3600);
    const before = h.spawned.filter((s) => s.tick < 1790).map((s) => s.type);
    const after = h.spawned.filter((s) => s.tick > 1810).map((s) => s.type);
    expect(new Set(before)).toEqual(new Set(['goblin-torch']));
    expect(new Set(after)).toEqual(new Set(['goblin-tnt']));
  });

  it('conserva el presupuesto y vuelve a elegir el pendiente con los tipos del tramo nuevo', () => {
    const h = harness([only(['goblin-tnt'], 1), only(['goblin-torch'], 1, 2)]);
    h.run(120);
    expect(h.spawned).toEqual([
      { tick: 120, type: 'goblin-torch' },
      { tick: 120, type: 'goblin-torch' },
    ]);
  });
});
