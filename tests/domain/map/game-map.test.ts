import { describe, expect, it } from 'vitest';
import { GameMap, MAP_DIMENSIONS_MISMATCH } from '../../../src/domain/map/GameMap';
import { cellsWith, mapRules, mapWith } from '../../support/mapLayouts';

const RULES = mapRules();

describe('GameMap · rejilla de celdas tipadas (spec procedural-map)', () => {
  it('Scenario: Rejilla por defecto (mapa abierto de 32 × 18, todo hierba)', () => {
    const map = GameMap.open(RULES);
    expect([map.cols, map.rows, map.cellSize]).toEqual([32, 18, 60]);
    expect(map.typeAt(0, 0)).toBe('grass');
    expect(map.typeAt(31, 17)).toBe('grass');
    expect(map.cellRect(3, 2)).toEqual({ left: 180, top: 120, right: 240, bottom: 180 });
  });

  it('Scenario: Mundo no múltiplo de la celda (columna 66 en [3.960, 4.000])', () => {
    const map = GameMap.open(mapRules(undefined, 4000, 4000));
    const rect = map.cellRect(66, 0);
    expect([rect.left, rect.right]).toEqual([3960, 4000]);
    expect(rect.right - rect.left).toBe(40);
  });

  it.each([
    [959.9, 539.9, 15, 8],
    [960, 540, 16, 9],
    [0, 0, 0, 0],
    [1920, 1080, 31, 17],
  ])('Scenario: Celda de un punto (%d, %d) ⇒ (%d, %d)', (x, y, col, row) => {
    const map = GameMap.open(RULES);
    expect(map.cellAt(x, y)).toEqual({ col, row });
  });

  it('Scenario: Caminabilidad por tipo y fuera de la rejilla', () => {
    const map = mapWith(RULES, {
      '3,3': 'trunk',
      '4,3': 'water',
      '5,3': 'bridge',
      '6,3': 'castle',
    });
    const cells: [number, number][] = [
      [3, 3],
      [4, 3],
      [5, 3],
      [6, 3],
      [7, 3],
      [-1, 0],
      [32, 0],
      [0, 18],
    ];
    expect(cells.map(([c, r]) => map.isWalkable(c, r))).toEqual([
      false,
      false,
      true,
      false,
      true,
      false,
      false,
      false,
    ]);
  });

  it('typeAt devuelve el tipo de cada celda dada', () => {
    const map = mapWith(RULES, {
      '3,3': 'trunk',
      '4,3': 'water',
      '5,3': 'bridge',
      '6,3': 'castle',
    });
    expect([map.typeAt(3, 3), map.typeAt(4, 3), map.typeAt(5, 3), map.typeAt(6, 3)]).toEqual([
      'trunk',
      'water',
      'bridge',
      'castle',
    ]);
  });

  it('una celda castle bloquea el círculo como un tronco (tangencia legal)', () => {
    const map = mapWith(RULES, { '6,3': 'castle' });
    expect(map.overlapsBlocked(344, 210, 16)).toBe(false);
    expect(map.overlapsBlocked(345, 210, 16)).toBe(true);
  });

  it('Scenario: Mapa de dimensiones incorrectas (30 × 17 con la rejilla de 32 × 18)', () => {
    const wrong = cellsWith(mapRules(undefined, 1800, 1020), {});
    const r = GameMap.fromCells(wrong, RULES);
    expect(!r.ok && r.error.field).toBe('map.cells');
    expect(!r.ok && r.error.message).toContain('dimensiones');
    expect(!r.ok && r.error.message.startsWith(MAP_DIMENSIONS_MISMATCH)).toBe(true);
  });

  it('fromCells copia la lista: cambiarla después no cambia el mapa', () => {
    const cells = cellsWith(RULES, {});
    const r = GameMap.fromCells(cells, RULES);
    cells[0] = 'trunk';
    expect(r.ok && r.value.isWalkable(0, 0)).toBe(true);
  });
});
