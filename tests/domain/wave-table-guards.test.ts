import { describe, expect, it } from 'vitest';
import { buildRunRules } from '../../src/domain/run/RunConfig';
import { GUARD_IN_WAVES } from '../../src/domain/wave/WaveTable';
import { aCampsConfig } from '../support/camps';

describe('WaveTable · guardias fuera de las oleadas (enemy-spawning)', () => {
  it('Scenario: Guardia citado en una oleada', () => {
    const base = aCampsConfig();
    const segments = base.waves.segments.map((s, i) =>
      i === 0 ? { ...s, types: ['goblin-torch', 'goblin-tnt-guard'] } : s,
    );
    const r = buildRunRules({ ...base, waves: { ...base.waves, segments } });
    if (r.ok) throw new Error('se esperaba un error');
    expect(r.error.field).toBe('waves.segments.0.types.1');
    expect(r.error.message).toContain(GUARD_IN_WAVES);
    expect(r.error.message).toContain('goblin-tnt-guard');
  });

  it('un guardia en el catálogo que no está en las oleadas es válido', () => {
    expect(buildRunRules(aCampsConfig()).ok).toBe(true);
  });
});
