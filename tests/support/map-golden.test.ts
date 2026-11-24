import { describe, expect, it } from 'vitest';
import { aDefaultConfig } from './builders';
import {
  MAP_GOLDEN,
  RESOURCE_GOLDEN,
  SHEEP_GOLDEN,
  STRUCTURE_GOLDEN,
  resourceSignatureOf,
  sheepSignatureOf,
  signatureOf,
  structureSignatureOf,
} from './mapGolden';
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

  // Spec procedural-map (0022): "Firma de referencia de los recursos" (`RESOURCE_STREAM`).
  it.each([42, 123] as const)('Scenario: Firma de referencia de los recursos (%i)', (seed) => {
    const run = startSeededRun(aDefaultConfig(), seed);
    expect(resourceSignatureOf(run.map)).toEqual(RESOURCE_GOLDEN[seed]);
    const s = run.snapshot();
    expect(resourceSignatureOf({ veins: s.veins, woodPiles: s.pickups })).toEqual(
      RESOURCE_GOLDEN[seed],
    );
  });

  // Spec procedural-map (0023): "Firma de referencia de las ovejas" (`SHEEP_STREAM`).
  it.each([42, 123] as const)('Scenario: Firma de referencia de las ovejas (%i)', (seed) => {
    const run = startSeededRun(aDefaultConfig(), seed);
    expect(sheepSignatureOf(run.snapshot())).toEqual(SHEEP_GOLDEN[seed]);
  });

  it('con el mapa vacío no hay estructuras', () => {
    expect(startSeededRun(aDefaultConfig(), 42, 'empty').map.structures).toEqual([]);
  });
});
