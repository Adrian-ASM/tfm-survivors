import { describe, expect, it } from 'vitest';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { describeRandomGeneratorContract } from '../support/randomContract';

// Vector de regresión del mulberry32 de 0001: red para moverlo a infraestructura sin cambiar
// partidas.
const REGRESSION: Record<number, readonly number[]> = {
  2026: [
    0.45540769933722913, 0.30849614599719644, 0.6611574492417276, 0.6184752183035016,
    0.15228010178543627,
  ],
  0: [
    0.26642920868471265, 0.0003297457005828619, 0.2232720274478197, 0.1462021479383111,
    0.46732782293111086,
  ],
  42: [
    0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693,
    0.17481389874592423,
  ],
};

describeRandomGeneratorContract(
  'Mulberry32RandomGenerator',
  () => new Mulberry32RandomGenerator(7),
);

describe('Mulberry32RandomGenerator', () => {
  it.each([2026, 0, 42])('semilla %i: los 5 primeros valores no cambian', (seed) => {
    const random = new Mulberry32RandomGenerator(seed);
    expect(Array.from({ length: 5 }, () => random.next())).toStrictEqual(REGRESSION[seed]);
  });

  it('expone la semilla con la que se creó', () => {
    expect(new Mulberry32RandomGenerator(4294967295).seed).toBe(4294967295);
  });

  it('semillas distintas dan secuencias distintas', () => {
    expect(new Mulberry32RandomGenerator(1).next()).not.toBe(
      new Mulberry32RandomGenerator(2).next(),
    );
  });
});
