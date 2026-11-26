import { describe, expect, it } from 'vitest';
import { resolveMobile } from '../../src/infrastructure/url/resolveMobile';

/** Doble de `matchMedia('(pointer: coarse)')`: un `{ matches }` mutable y cuántas veces se lee. */
function pointer(matches: boolean) {
  const query = { matches, reads: 0 };
  const coarse = (): boolean => {
    query.reads += 1;
    return query.matches;
  };
  return { query, coarse };
}

// Spec mobile-display (0033), "Activación del modo móvil".
describe('resolveMobile (0033)', () => {
  it('Scenario: Puntero grueso sin parámetros (activo y sin avisos)', () => {
    expect(resolveMobile('', pointer(true).coarse)).toEqual({ on: true });
  });

  it('Scenario: Puntero fino sin parámetros (no activo)', () => {
    expect(resolveMobile('', pointer(false).coarse)).toEqual({ on: false });
  });

  it('Scenario: Forzado por URL (?mobile=1 con puntero fino, ?mobile=0 con grueso; sin avisos)', () => {
    expect(resolveMobile('?mobile=1', pointer(false).coarse)).toEqual({ on: true });
    expect(resolveMobile('?mobile=0', pointer(true).coarse)).toEqual({ on: false });
  });

  it('Scenario: E2E desactiva solo la autodetección (?e2e grueso: no; ?e2e&mobile=1 fino: sí)', () => {
    expect(resolveMobile('?e2e&seed=42', pointer(true).coarse)).toEqual({ on: false });
    expect(resolveMobile('?e2e&mobile=1&seed=42', pointer(false).coarse)).toEqual({ on: true });
  });

  it('Scenario: Valor de mobile inválido (?mobile=abc → autodetección; ?e2e&mobile=true → no)', () => {
    const abc = resolveMobile('?mobile=abc', pointer(true).coarse);
    const e2e = resolveMobile('?e2e&mobile=true', pointer(true).coarse);

    expect([abc.on, e2e.on]).toEqual([true, false]);
    expect(abc.warning).toContain('mobile');
    expect(e2e.warning).toContain('mobile');
  });

  it.each(['?mobile', '?mobile=', '?mobile=2', '?mobile=true'])(
    'Valor de mobile inválido (%s): exactamente 1 aviso',
    (search) => {
      const r = resolveMobile(search, pointer(false).coarse);
      expect(r.on).toBe(false);
      expect(typeof r.warning).toBe('string');
    },
  );

  it('trunca el valor crudo del aviso a 32 caracteres', () => {
    const r = resolveMobile(`?mobile=${'x'.repeat(500)}`, pointer(false).coarse);
    expect(r.warning).toContain('x'.repeat(32));
    expect(r.warning).not.toContain('x'.repeat(33));
  });

  it('Scenario: Cambio del puntero tras la carga (la consulta se lee una vez; el modo no cambia)', () => {
    const { query, coarse } = pointer(true);
    const mode = resolveMobile('', coarse);

    query.matches = false;

    expect(mode.on).toBe(true);
    expect(query.reads).toBe(1);
  });

  it('el forzado no consulta el puntero', () => {
    const { query, coarse } = pointer(true);
    resolveMobile('?mobile=0', coarse);
    resolveMobile('?e2e', coarse);
    expect(query.reads).toBe(0);
  });
});
