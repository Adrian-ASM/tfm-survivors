import { afterEach, describe, expect, it, vi } from 'vitest';
import { restartRandoms, seededRun } from '../../src/composition/seedSource';
import { MAP_STREAM, deriveSeed } from '../../src/infrastructure/random/deriveSeed';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';

const sequence = (r: { next(): number }, n: number): number[] =>
  Array.from({ length: n }, () => r.next());

describe('restartRandoms (spec simulation-loop: Semilla de la partida)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Scenario: Semilla nueva al reiniciar (la fuente da 123: generador con 123 y aviso al probe)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const seeds: number[] = [];
    const next = restartRandoms(
      () => 123,
      (s) => seeds.push(s),
    );

    const random = next();

    expect(sequence(random, 5)).toEqual(sequence(new Mulberry32RandomGenerator(123), 5));
    expect(seeds).toEqual([123]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('Scenario: Reinicio tras una semilla inválida (3 reinicios: semillas nuevas, sin avisos)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const draws = [7, 4_294_967_295, 0];
    const seeds: number[] = [];
    const next = restartRandoms(
      () => draws[seeds.length] ?? -1,
      (s) => seeds.push(s),
    );

    for (let i = 0; i < 3; i++) next();

    expect(seeds).toEqual(draws);
    expect(seeds.every((s) => Number.isInteger(s) && s >= 0 && s <= 4_294_967_295)).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });
});

// ADR-0013: la composición siembra la partida (oleadas) y el mapa (flujo derivado) por separado.
describe('seededRun', () => {
  it('oleadas con Mulberry32(seed) y mapa con Mulberry32(deriveSeed(seed, MAP_STREAM))', () => {
    const seeding = seededRun(42, 'generated');
    expect(sequence(seeding.random, 5)).toEqual(sequence(new Mulberry32RandomGenerator(42), 5));
    if (seeding.terrain.kind !== 'generated') throw new Error('se esperaba un mapa generado');
    const mapRandom = new Mulberry32RandomGenerator(deriveSeed(42, MAP_STREAM));
    expect(sequence(seeding.terrain.random, 5)).toEqual(sequence(mapRandom, 5));
  });

  it('con el modo vacío el mapa es el abierto', () => {
    expect(seededRun(42, 'empty').terrain).toEqual({ kind: 'open' });
  });
});
