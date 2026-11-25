import { describe, expect, it } from 'vitest';
import { MAP_DOOR_OUTSIDE } from '../../src/domain/map/TerrainSource';
import { Run } from '../../src/domain/run/Run';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aDefaultConfig } from '../support/builders';
import { startOn } from '../support/camps';
import { startSeededRun } from '../support/runs';

// Spec procedural-map (0024), "Puerta de la tienda en cada mapa": el generado la tiene en la puerta
// del castillo (su salida); el vacío no; un mapa explícito solo la que declare (dentro del mundo).

const CASTLE_DOOR = { x: 1950, y: 1170 };
const SEEDS = [...Array.from({ length: 50 }, (_, i) => i + 1), 0, 4_294_967_295];

describe('Puerta de la tienda en cada mapa (procedural-map 0024)', () => {
  it.each(SEEDS)('Scenario: Puerta en el mapa generado (semilla %i: (1.950, 1.170))', (seed) => {
    const run = startSeededRun(aDefaultConfig(), seed);

    expect(run.map.door).toEqual(CASTLE_DOOR);
    expect([run.map.start.x, run.map.start.y]).toEqual([CASTLE_DOOR.x, CASTLE_DOOR.y]);
    expect(run.snapshot().shop.door).toEqual({ ...CASTLE_DOOR, radius: 40 });
  });

  it('Scenario: Sin puerta en el mapa vacío (semilla 7, y con la salida (1.950, 1.170))', () => {
    const empty = startSeededRun(aDefaultConfig(), 7, 'empty');
    const withStart = startOn(aDefaultConfig(), { kind: 'open', start: CASTLE_DOOR });

    expect([empty.map.door, withStart.map.door]).toEqual([null, null]);
    expect([empty.snapshot().shop.door, withStart.snapshot().shop.door]).toEqual([null, null]);
  });

  it('Scenario: Puerta declarada en un mapa explícito ((1.000, 1.000) sí; (−10, 1.000) no)', () => {
    const declared = startOn(aDefaultConfig(), { kind: 'open', door: { x: 1000, y: 1000 } });
    const bad = Run.start(
      aDefaultConfig(),
      new Mulberry32RandomGenerator(42),
      {},
      { kind: 'open', door: { x: -10, y: 1000 } },
    );

    expect(declared.map.door).toEqual({ x: 1000, y: 1000 });
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.error).toMatchObject({ field: 'map.door', message: MAP_DOOR_OUTSIDE });
    expect(MAP_DOOR_OUTSIDE).toContain('puerta de la tienda');
  });

  it('la puerta no cambia ninguna celda (mismo mapa con y sin puerta declarada)', () => {
    const plain = startOn(aDefaultConfig(), { kind: 'open' });
    const door = startOn(aDefaultConfig(), { kind: 'open', door: { x: 1000, y: 1000 } });

    expect(door.map.cells).toEqual(plain.map.cells);
    expect(door.map.start).toEqual(plain.map.start);
  });
});
