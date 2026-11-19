import { describe, expect, it } from 'vitest';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';

const SAMPLES = 1000;

const draw = (random: RandomGenerator, n: number): number[] =>
  Array.from({ length: n }, () => random.next());

/**
 * Contrato del puerto RandomGenerator: toda implementación lo cumple.
 * `make` crea dos instancias con la misma configuración (semilla o valor fijo).
 */
export function describeRandomGeneratorContract(name: string, make: () => RandomGenerator): void {
  describe(`Contrato RandomGenerator · ${name}`, () => {
    it('devuelve valores finitos en [0, 1)', () => {
      for (const v of draw(make(), SAMPLES)) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });

    it('es reproducible con la misma configuración', () => {
      expect(draw(make(), SAMPLES)).toStrictEqual(draw(make(), SAMPLES));
    });
  });
}
