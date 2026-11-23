import { describe, expect, it } from 'vitest';
import { DEFAULT_CPU_THROTTLE, parseThrottle } from '../support/cpuThrottle';

// Frenado de CPU por CDP en CI_LIKE (design 0014 §4.2): `CPU_THROTTLE` es entrada de la
// herramienta de test; si es inválida, la config de Playwright falla al cargar.
describe('parseThrottle', () => {
  it('sin valor usa DEFAULT_CPU_THROTTLE', () => {
    expect(parseThrottle(undefined)).toBe(DEFAULT_CPU_THROTTLE);
  });

  it('el valor por defecto es válido para parseThrottle', () => {
    expect(parseThrottle(String(DEFAULT_CPU_THROTTLE))).toBe(DEFAULT_CPU_THROTTLE);
  });

  it.each([
    ['4', 4],
    ['1', 1],
    ['2.5', 2.5],
  ])('%s da %d', (raw, rate) => {
    expect(parseThrottle(raw)).toBe(rate);
  });

  it.each(['0', 'abc', '-1', '', 'Infinity', '0.5'])('%j lanza', (raw) => {
    expect(() => parseThrottle(raw)).toThrow(/CPU_THROTTLE/);
  });
});
