import { describe, expect, it } from 'vitest';
import { aDefaultConfig } from './builders';
import { MAP_GOLDEN, signatureOf } from './mapGolden';
import { startSeededRun } from './runs';

// La firma de los E2E (sin imports) debe ser la del núcleo con la siembra de la composición.
describe('Firma dorada del mapa', () => {
  it.each([42, 123] as const)('semilla %i: igual al mapa de la partida sembrada', (seed) => {
    const map = startSeededRun(aDefaultConfig(), seed).map;
    expect(signatureOf(map.cells)).toBe(MAP_GOLDEN[seed]);
    expect(MAP_GOLDEN[seed]).toHaveLength(576);
  });
});
