import { describe, expect, it } from 'vitest';
import {
  RING_RADIUS_MUST_BE_POSITIVE,
  SpawnRules,
  type SpawnConfig,
} from '../../src/domain/wave/SpawnRules';

// Spec enemy-spawning (0017, ADR-0015): el radio del anillo es contenido y no depende de la vista.
const SPAWN: SpawnConfig = {
  maxAlive: 200,
  maxBudget: 10,
  ringRadius: 1500,
  minDistance: 200,
  maxAttempts: 8,
};

describe('SpawnRules (0017): radio del anillo de contenido', () => {
  it('usa el ringRadius del contenido sin recibir ninguna vista', () => {
    const r = SpawnRules.create(SPAWN);

    expect(r.ok && r.value.ringRadius).toBe(1500);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rechaza ringRadius %s en waves.spawn.ringRadius',
    (ringRadius) => {
      const r = SpawnRules.create({ ...SPAWN, ringRadius });

      expect(r.ok ? null : r.error).toEqual({
        code: 'invalid-config',
        field: 'waves.spawn.ringRadius',
        message: RING_RADIUS_MUST_BE_POSITIVE,
      });
    },
  );

  it('minDistance ≥ ringRadius es válido (spec "Ninguna posición válida")', () => {
    expect(SpawnRules.create({ ...SPAWN, ringRadius: 100, minDistance: 100 }).ok).toBe(true);
    expect(SpawnRules.create({ ...SPAWN, ringRadius: 100, minDistance: 4500 }).ok).toBe(true);
  });
});
