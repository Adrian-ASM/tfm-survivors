import { describe, expect, it } from 'vitest';
import { MAX_SIM_SPEED, resolveSpeed } from '../../src/infrastructure/url/resolveSpeed';

describe('resolveSpeed', () => {
  it('Scenario: Velocidad válida en modo E2E', () => {
    expect(resolveSpeed('?e2e&speed=8')).toEqual({ speed: 8 });
  });

  it.each([
    ['1', 1],
    ['15', 15],
  ])('Scenario: Límites del rango (%s)', (raw, speed) => {
    expect(resolveSpeed(`?e2e&speed=${raw}`)).toEqual({ speed });
  });

  it('el tope es 15', () => {
    expect(MAX_SIM_SPEED).toBe(15);
  });

  it.each(['0', '16', '-1', '2.5', 'abc', ''])(
    'Scenario: Velocidad inválida en modo E2E (%j)',
    (raw) => {
      const r = resolveSpeed(`?e2e&speed=${encodeURIComponent(raw)}`);
      expect(r.speed).toBe(1);
      expect(r.warning).toContain('speed');
    },
  );

  it('Scenario: Sin velocidad en modo E2E', () => {
    expect(resolveSpeed('?e2e&seed=42')).toEqual({ speed: 1 });
    expect(resolveSpeed('?e2e')).toEqual({ speed: 1 });
  });

  it.each(['?speed=8', '?seed=42&speed=8'])(
    'Scenario: Velocidad ignorada fuera de E2E (%s)',
    (search) => {
      expect(resolveSpeed(search)).toEqual({ speed: 1 });
    },
  );

  it.each(['?speed=abc', '?speed=16'])(
    'Scenario: Velocidad inválida ignorada fuera de E2E (%s)',
    (search) => {
      expect(resolveSpeed(search)).toEqual({ speed: 1 });
    },
  );

  it('trunca el valor crudo del aviso a 32 caracteres', () => {
    const r = resolveSpeed(`?e2e&speed=${'x'.repeat(500)}`);
    expect(r.warning).toContain('x'.repeat(32));
    expect(r.warning).not.toContain('x'.repeat(33));
  });
});
