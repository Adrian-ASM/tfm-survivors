import { describe, expect, it } from 'vitest';
import type { TerrainSource } from '../../../src/domain/map/TerrainSource';
import { Run } from '../../../src/domain/run/Run';
import { MAP_STRUCTURE_OUT_OF_GRID } from '../../../src/domain/structure/resolveStructures';
import { Mulberry32RandomGenerator } from '../../../src/infrastructure/random/Mulberry32RandomGenerator';
import { MAP_STREAM, deriveSeed } from '../../../src/infrastructure/random/deriveSeed';
import { aCampsConfig, resourceRandomFor, structureRandomFor } from '../../support/camps';
import { NO_RESOURCES, NO_STRUCTURES } from '../../support/builders';

const CONFIG = aCampsConfig();
const HOUSE = { type: 'goblin-house', col: 20, row: 10, cols: 2, rows: 3 } as const;
const TOWER = { type: 'goblin-tower', col: 40, row: 5, cols: 2, rows: 2 } as const;

const start = (terrain: TerrainSource, config = CONFIG) =>
  Run.start(config, new Mulberry32RandomGenerator(7), {}, terrain);

function started(terrain: TerrainSource, config = CONFIG): Run {
  const r = start(terrain, config);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const generated = (seed: number): TerrainSource => ({
  kind: 'generated',
  random: new Mulberry32RandomGenerator(deriveSeed(seed, MAP_STREAM)),
  structureRandom: structureRandomFor(seed),
  resourceRandom: resourceRandomFor(seed),
});

describe('Estructuras del mapa de la partida (procedural-map, goblin-structures)', () => {
  it('Scenario: Mapa explícito con estructuras declaradas', () => {
    const run = started({ kind: 'open', structures: [HOUSE, TOWER] });
    const { structures, cells } = run.map;
    expect(structures.map((s) => [s.id, s.type, s.col, s.row, s.cols, s.rows])).toEqual([
      [0, 'goblin-house', 20, 10, 2, 3],
      [1, 'goblin-tower', 40, 5, 2, 2],
    ]);
    expect(structures[0]).toMatchObject({ x: 1260, y: 690, radius: 48 });
    expect(structures[0]?.door).toEqual({ col: 21, row: 13, x: 1290, y: 810 });
    expect(structures[1]?.door).toBeNull();
    expect(cells.length).toBe(2304);
    expect(cells.every((t) => t === 'grass')).toBe(true);
    expect(Object.isFrozen(structures)).toBe(true);
    expect(Object.isFrozen(structures[0])).toBe(true);
  });

  it('un mapa de celdas también puede declarar estructuras', () => {
    const cells = Array.from({ length: 2304 }, () => 'grass' as const);
    const run = started({ kind: 'cells', cells, structures: [TOWER] });
    expect(run.map.structures.map((s) => s.type)).toEqual(['goblin-tower']);
  });

  it.each([
    ['columnas 63–64', { ...HOUSE, col: 63 }],
    ['filas 33–35 (puerta en la fila 36)', { ...HOUSE, row: 33 }],
    ['columna negativa', { ...HOUSE, col: -1 }],
    ['huella sin filas', { ...HOUSE, rows: 0 }],
  ])('Scenario: Estructura declarada fuera de la rejilla (%s)', (_label, house) => {
    const r = start({ kind: 'open', structures: [TOWER, house] });
    if (r.ok) throw new Error('se esperaba un error');
    expect(r.error.field).toBe('map.structures.1');
    expect(r.error.message).toContain(MAP_STRUCTURE_OUT_OF_GRID);
    expect(r.error.message).toContain('goblin-house');
  });

  it('una torre en las filas 33–35 cabe: no tiene puerta', () => {
    expect(start({ kind: 'open', structures: [{ ...TOWER, row: 33, rows: 3 }] }).ok).toBe(true);
  });

  it('una estructura de un tipo que el contenido no declara no crea la partida', () => {
    const r = start({ kind: 'open', structures: [{ ...TOWER, type: 'goblin-farm' }] });
    if (r.ok) throw new Error('se esperaba un error');
    expect(r.error.field).toBe('map.structures.0.type');
    expect(r.error.message).toContain('goblin-farm');
  });

  it('Scenario: Partida con mapa vacío', () => {
    const run = started({ kind: 'open' });
    expect(run.map.counts.grass).toBe(2304);
    expect(run.map.counts.castle).toBe(0);
    expect([run.map.start.x, run.map.start.y]).toEqual([1920, 1080]);
    expect(run.map.structures).toEqual([]);
  });

  it('Scenario: Mapa vacío sin estructuras', () => {
    expect(started({ kind: 'open' }).map.structures).toEqual([]);
  });

  it('el mapa generado tiene las estructuras que coloca su generador propio', () => {
    const structures = started(generated(42)).map.structures;
    expect(structures.map((s) => s.type)).toEqual([
      'goblin-house',
      'goblin-house',
      'goblin-house',
      'goblin-house',
      'goblin-tower',
      'goblin-tower',
      'goblin-tower',
    ]);
  });

  it('sin tipos de estructura, el mapa generado no tiene ninguna', () => {
    const config = { ...CONFIG, structures: NO_STRUCTURES, resources: NO_RESOURCES };
    expect(started(generated(42), config).map.structures).toEqual([]);
  });
});
