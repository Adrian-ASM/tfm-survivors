import { describe, expect, it } from 'vitest';
import { Mulberry32RandomGenerator } from '../../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aCampsConfig, aStructuresConfig, startCampRun } from '../../support/camps';
import { MAP_GOLDEN, signatureOf } from '../../support/mapGolden';
import { CountingRandom } from '../../support/random';

const SEEDS_50 = Array.from({ length: 50 }, (_, i) => i + 1);

describe('Azar propio de la colocación (goblin-structures, simulation-loop)', () => {
  it('Scenario: Las estructuras no cambian las celdas', () => {
    const base = aCampsConfig();
    const doubled = aCampsConfig(aStructuresConfig({ house: { count: 8 }, tower: { count: 0 } }));
    const differing = SEEDS_50.filter(
      (seed) =>
        startCampRun(base, seed).map.cells.join() !== startCampRun(doubled, seed).map.cells.join(),
    );
    expect(differing).toEqual([]);
    expect(startCampRun(doubled, 1).map.structures.length).toBeGreaterThan(4);
  });

  it('Scenario: Mapa intacto (la firma dorada de celdas no cambia con estructuras)', () => {
    for (const seed of [42, 123] as const) {
      const run = startCampRun(aCampsConfig(), seed);
      expect(run.map.structures.length).toBe(7);
      expect(signatureOf(run.map.cells)).toBe(MAP_GOLDEN[seed]);
    }
  });

  it('Scenario: Misma semilla, mismas estructuras', () => {
    const a = startCampRun(aCampsConfig(), 42).map.structures;
    const b = startCampRun(aCampsConfig(), 42).map.structures;
    expect(a.length).toBe(7);
    expect(a).toEqual(b);
  });

  it('Scenario: Colocar no consume el azar de la partida', () => {
    const none = aCampsConfig(aStructuresConfig({ house: { count: 0 }, tower: { count: 0 } }));
    const withCamps = new CountingRandom(new Mulberry32RandomGenerator(7));
    const without = new CountingRandom(new Mulberry32RandomGenerator(7));
    const a = startCampRun(aCampsConfig(), 7, {}, withCamps);
    const b = startCampRun(none, 7, {}, without);
    expect([a.map.structures.length, b.map.structures.length]).toEqual([7, 0]);
    expect([withCamps.calls, without.calls]).toEqual([0, 0]);
    expect(withCamps.next()).toBe(without.next());
  });
});
