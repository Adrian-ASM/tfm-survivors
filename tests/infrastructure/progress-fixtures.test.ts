import { describe, expect, it } from 'vitest';
import { decodeProgress } from '../../src/infrastructure/progress/progressCodec';
import { F, P0, progressText } from '../e2e/progressFixtures';

// Siembra de los E2E (design 0008): construida con el codec de producción y comprobada con zod,
// para que no se desincronice del esquema de 0007.
const decoded = (text: string) => {
  const r = decodeProgress(text);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe('progressFixtures', () => {
  it('Scenario: Sin violaciones en el bucle completo (GIVEN: P0 válido con 1 entrada)', () => {
    expect(decoded(progressText(P0))).toEqual(P0);
    expect(P0.history).toHaveLength(1);
  });

  it('F se decodifica igual campo a campo y tiene exactamente 1 entrada', () => {
    expect(decoded(progressText(F))).toEqual(F);
    expect(F.history).toHaveLength(1);
  });

  it('los fixtures del bucle: cada récord fusionado sale de una fuente distinta', () => {
    expect(P0.records).toEqual({ bestTimeSeconds: 300, bestLevel: 2, maxKills: 10 });
    expect(F.records).toEqual({ bestTimeSeconds: 60, bestLevel: 20, maxKills: 5 });
  });

  it('lanza si el progreso no pasa el esquema (entrada con level 0)', () => {
    const entry = P0.history[0];
    if (!entry) throw new Error('P0 debía tener 1 entrada');
    const invalid = { records: P0.records, history: [{ ...entry, level: 0 }] };

    expect(() => progressText(invalid)).toThrow(/history\.0\.level/);
  });
});
