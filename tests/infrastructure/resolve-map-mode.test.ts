import { describe, expect, it } from 'vitest';
import { resolveMapMode } from '../../src/infrastructure/url/resolveMapMode';

// Spec procedural-map (0015), "Mapa vacío en modo E2E" (reglas de la URL).
describe('resolveMapMode', () => {
  it('Scenario: Mapa vacío forzado (?e2e&map=empty&seed=42: sin avisos)', () => {
    expect(resolveMapMode('?e2e&map=empty&seed=42')).toEqual({ emptyForced: true });
  });

  it('Scenario: Mapa real por defecto en E2E (?e2e&seed=42: sin avisos)', () => {
    expect(resolveMapMode('?e2e&seed=42')).toEqual({ emptyForced: false });
  });

  it.each(['?e2e&map&seed=42', '?e2e&map=&seed=42', '?e2e&map=real&seed=42', '?e2e&map=1'])(
    'Scenario: Valor inválido (%s: mapa generado y 1 aviso que menciona map)',
    (search) => {
      const r = resolveMapMode(search);
      expect(r.emptyForced).toBe(false);
      expect(r.warning).toContain('map');
      expect(r.warning).not.toContain('seed');
    },
  );

  it('trunca el valor crudo del aviso a 32 caracteres', () => {
    const r = resolveMapMode(`?e2e&map=${'x'.repeat(500)}`);
    expect(r.warning).toContain('x'.repeat(32));
    expect(r.warning).not.toContain('x'.repeat(33));
  });

  it.each(['?map=empty&seed=42', '?map=real', '?map'])(
    'Scenario: Ignorado fuera de E2E (%s: sin avisos)',
    (search) => {
      expect(resolveMapMode(search)).toEqual({ emptyForced: false });
    },
  );
});
