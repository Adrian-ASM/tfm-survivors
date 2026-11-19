import { afterEach, describe, expect, it, vi } from 'vitest';
import { restartRandoms } from '../../src/composition/seedSource';
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
