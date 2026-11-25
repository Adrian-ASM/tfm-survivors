import { describe, expect, it } from 'vitest';
import { GameMap } from '../../../src/domain/map/GameMap';
import { toMapSnapshot } from '../../../src/domain/map/MapSnapshot';
import { codesOf, isFullyConnected } from '../../../src/domain/map/connectivity';
import { mapRules, mapWith } from '../../support/mapLayouts';
import { FOOTPRINT, TEST_SITE, TEST_SITE_CELLS } from '../../support/sites';

// Spec procedural-map 0026, "Rejilla de celdas tipadas" y ADR-0025: el terreno no cambia y la capa
// de obra hace no caminables las celdas construidas.
const RULES = mapRules();
const buildTestSite = (map: GameMap) =>
  map.build(TEST_SITE.col, TEST_SITE.row, FOOTPRINT.cols, FOOTPRINT.rows);

describe('GameMap · capa de obra (ADR-0025)', () => {
  it('Scenario: Caminabilidad de una celda construida', () => {
    const map = GameMap.open(RULES);
    const before = TEST_SITE_CELLS.map(([c, r]) => [map.isWalkable(c, r), map.typeAt(c, r)]);

    const built = buildTestSite(map);

    expect(built.ok).toBe(true);
    expect(before).toEqual(TEST_SITE_CELLS.map(() => [true, 'grass']));
    expect(TEST_SITE_CELLS.map(([c, r]) => [map.isWalkable(c, r), map.typeAt(c, r)])).toEqual(
      TEST_SITE_CELLS.map(() => [false, 'grass']),
    );
    expect(TEST_SITE_CELLS.every(([c, r]) => map.isBuilt(c, r))).toBe(true);
    expect(map.isBuilt(22, 10)).toBe(false);
    expect(map.isWalkable(22, 10)).toBe(true);
  });

  it('cada obra sube la revisión en 1; sin obras es 0', () => {
    const map = GameMap.open(RULES);
    expect(map.revision).toBe(0);
    buildTestSite(map);
    expect(map.revision).toBe(1);
    map.build(40, 20, 2, 2);
    expect(map.revision).toBe(2);
  });

  it('una huella fuera de la rejilla falla sin cambiar nada', () => {
    const map = GameMap.open(RULES);
    const r = map.build(63, 10, 2, 2);
    expect(r.ok).toBe(false);
    expect(map.revision).toBe(0);
    expect(map.isWalkable(63, 10)).toBe(true);
  });

  it('marca la obra sea cual sea el terreno, sin cambiar su tipo', () => {
    const map = mapWith(RULES, { '20,10': 'trunk' });
    buildTestSite(map);
    expect(map.typeAt(20, 10)).toBe('trunk');
    expect(map.isBuilt(20, 10)).toBe(true);
  });

  it('el solape, el barrido y la recolocación leen la obra', () => {
    const map = GameMap.open(RULES);
    const out = { x: 0, y: 0 };
    expect(map.overlapsBlocked(1260, 660, 16)).toBe(false);
    buildTestSite(map);
    expect(map.overlapsBlocked(1260, 660, 16)).toBe(true);
    expect(map.limitMoveX(1100, 1300, 660, 16)).toBeCloseTo(1184, 6);
    map.nearestWalkable(1230, 630, out);
    expect(map.isBuilt(map.colAt(out.x), map.rowAt(out.y))).toBe(false);
  });

  it('el terreno, la vista del mapa y codesOf: el tipo no cambia, los códigos vivos sí', () => {
    const map = GameMap.open(RULES);
    const terrain = toMapSnapshot(map).cells;
    buildTestSite(map);
    expect(toMapSnapshot(map).cells).toEqual(terrain);
    const codes = codesOf(map);
    const i = TEST_SITE.row * map.cols + TEST_SITE.col;
    expect(codes[i]).not.toBe(codes[i + 2]);
    expect(Array.from(map.liveCodes)).toEqual(Array.from(codes));
  });

  it('una obra rodeada de hierba no aísla ninguna celda (conectividad sobre la capa viva)', () => {
    const map = GameMap.open(RULES);
    buildTestSite(map);
    expect(isFullyConnected(map)).toBe(true);
  });
});
