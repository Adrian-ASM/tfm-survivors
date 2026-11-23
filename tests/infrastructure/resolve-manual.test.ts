import { describe, expect, it } from 'vitest';
import { resolveManual } from '../../src/infrastructure/url/resolveManual';

describe('resolveManual (spec simulation-loop, "Modo de avance manual en modo E2E")', () => {
  it.each(['?e2e&manual', '?e2e&manual=', '?e2e&manual=1', '?e2e&manual=true'])(
    'Scenario: Modo manual activo (%s)',
    (search) => {
      expect(resolveManual(`${search}&seed=7`)).toEqual({ manual: true });
    },
  );

  it.each(['0', 'false', 'abc', '2'])(
    'Scenario: Valor de manual inválido en modo E2E (%j)',
    (raw) => {
      const r = resolveManual(`?e2e&manual=${raw}`);

      expect(r.manual).toBe(false);
      expect(r.warning).toContain('manual');
      expect(r.warning).not.toContain('seed');
      expect(r.warning).not.toContain('speed');
    },
  );

  it('trunca el valor crudo del aviso a 32 caracteres', () => {
    const r = resolveManual(`?e2e&manual=${'x'.repeat(500)}`);

    expect(r.warning).toContain('x'.repeat(32));
    expect(r.warning).not.toContain('x'.repeat(33));
  });

  it.each(['?manual', '?manual=1&seed=42', '?manual=abc'])(
    'Scenario: Manual ignorado fuera de E2E (%s)',
    (search) => {
      expect(resolveManual(search)).toEqual({ manual: false });
    },
  );

  it('Scenario: Sin manual en modo E2E (?e2e&seed=7)', () => {
    expect(resolveManual('?e2e&seed=7')).toEqual({ manual: false });
  });
});
