import { describe, expect, it } from 'vitest';
import { MAP_STREAM, deriveSeed } from '../../src/infrastructure/random/deriveSeed';

// ADR-0013: el mapa se siembra con una semilla derivada de la de la partida (flujo propio).
describe('deriveSeed', () => {
  it.each([0, 1, 42, 4294967295])('semilla %i: uint32 reproducible', (seed) => {
    const a = deriveSeed(seed, MAP_STREAM);
    expect(Number.isInteger(a) && a >= 0 && a <= 4294967295).toBe(true);
    expect(deriveSeed(seed, MAP_STREAM)).toBe(a);
  });

  it('no es la identidad y separa flujos y semillas vecinas', () => {
    expect(deriveSeed(42, MAP_STREAM)).not.toBe(42);
    expect(deriveSeed(42, MAP_STREAM)).not.toBe(deriveSeed(42, MAP_STREAM + 1));
    const seeds = Array.from({ length: 1000 }, (_, i) => deriveSeed(i + 1, MAP_STREAM));
    expect(new Set(seeds).size).toBe(1000);
  });

  it('vector de regresión: cambiarlo cambia todos los mapas (contrato de determinismo)', () => {
    expect([0, 1, 42].map((s) => deriveSeed(s, MAP_STREAM))).toEqual(REGRESSION);
  });
});

// Fijado al implementar 0015 (tarea 1.4); ver ADR-0013, "Consecuencias".
const REGRESSION = [2462723854, 920564995, 3856264912];
