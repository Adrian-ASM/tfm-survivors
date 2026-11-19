import { describe, expect, it } from 'vitest';
import { resolveSeed } from '../../src/infrastructure/url/resolveSeed';

const FALLBACK = 123_456;
const fallback = (): number => FALLBACK;

describe('resolveSeed', () => {
  it('Semilla válida por URL', () => {
    expect(resolveSeed('?seed=42', fallback)).toEqual({ seed: 42 });
    expect(resolveSeed('?e2e&seed=42', fallback)).toEqual({ seed: 42 });
  });

  it.each([
    ['0', 0],
    ['4294967295', 4294967295],
  ])('Límites del rango (%s)', (raw, seed) => {
    expect(resolveSeed(`?seed=${raw}`, fallback)).toEqual({ seed });
  });

  it.each(['-1', '4294967296', '1.5', 'abc', '', '1e3', ' 7'])('Semilla inválida (%j)', (raw) => {
    const r = resolveSeed(`?seed=${encodeURIComponent(raw)}`, fallback);
    expect(r.seed).toBe(FALLBACK);
    expect(r.warning).toContain('seed');
  });

  it('Sin semilla en la URL', () => {
    expect(resolveSeed('', fallback)).toEqual({ seed: FALLBACK });
    expect(resolveSeed('?e2e', fallback)).toEqual({ seed: FALLBACK });
  });

  it('solo llama al fallback cuando hace falta', () => {
    let calls = 0;
    resolveSeed('?seed=5', () => {
      calls += 1;
      return 1;
    });
    expect(calls).toBe(0);
  });

  it('trunca el valor crudo del aviso a 32 caracteres', () => {
    const raw = 'x'.repeat(500);
    const r = resolveSeed(`?seed=${raw}`, fallback);
    expect(r.warning).toContain('x'.repeat(32));
    expect(r.warning).not.toContain('x'.repeat(33));
  });

  it('normaliza un fallback fuera de rango a un entero de 32 bits sin signo', () => {
    const r = resolveSeed('', () => -1);
    expect(r.seed).toBe(4294967295);
  });
});
