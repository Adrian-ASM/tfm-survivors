import { describe, expect, it } from 'vitest';
import { aDefaultConfig } from './builders';
import { MAP_GOLDEN, STRUCTURE_GOLDEN, signatureOf, structureSignatureOf } from './mapGolden';
import { startSeededRun } from './runs';

// La firma de los E2E (sin imports) debe ser la del núcleo con la siembra de la composición.
describe('Firma dorada del mapa', () => {
  it.each([42, 123] as const)('semilla %i: igual al mapa de la partida sembrada', (seed) => {
    const map = startSeededRun(aDefaultConfig(), seed).map;
    expect(signatureOf(map.cells)).toBe(MAP_GOLDEN[seed]);
    expect(MAP_GOLDEN[seed]).toHaveLength(2304);
  });
});

// Spec goblin-structures (0021): "Firma de referencia de las estructuras", con la siembra de la
// composición (`seededRun`: `STRUCT_STREAM`) y el contenido por defecto.
describe('Firma dorada de las estructuras', () => {
  it.each([42, 123] as const)('Scenario: Firma de referencia de las estructuras (%i)', (seed) => {
    const run = startSeededRun(aDefaultConfig(), seed);
    expect(structureSignatureOf(run.map.structures)).toEqual(STRUCTURE_GOLDEN[seed]);
    // La lista del snapshot es la del mapa, en el mismo orden.
    expect(structureSignatureOf(run.snapshot().structures)).toEqual(STRUCTURE_GOLDEN[seed]);
  });

  it('con el mapa vacío no hay estructuras', () => {
    expect(startSeededRun(aDefaultConfig(), 42, 'empty').map.structures).toEqual([]);
  });
});
