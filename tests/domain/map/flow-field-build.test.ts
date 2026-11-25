import { describe, expect, it } from 'vitest';
import { FlowField } from '../../../src/domain/map/FlowField';
import { GameMap } from '../../../src/domain/map/GameMap';
import { mapRules, mapWith } from '../../support/mapLayouts';
import { FOOTPRINT, TEST_SITE, TEST_SITE_CELLS } from '../../support/sites';

// Spec procedural-map 0026, "Campo de distancias hacia una celda", y build-sites, "Edificios que
// bloquean el paso": el campo se invalida por la revisión del mapa (ADR-0025), con `build` directo.
const RULES = mapRules();
const build = (map: GameMap) =>
  map.build(TEST_SITE.col, TEST_SITE.row, FOOTPRINT.cols, FOOTPRINT.rows);

function distances(field: FlowField, map: GameMap): number[] {
  const out: number[] = [];
  for (let r = 0; r < map.rows; r++)
    for (let c = 0; c < map.cols; c++) out.push(field.distanceAt(c, r));
  return out;
}

describe('FlowField con la capa de obra (ADR-0025)', () => {
  it('Scenario: Campo con un edificio', () => {
    const map = GameMap.open(RULES);
    const field = new FlowField(map);
    // T = (20, 14), debajo de la huella (filas 10–11): la celda (20, 8) queda al otro lado.
    field.retarget(20, 14);
    const before = distances(field, map);
    const manhattan = before.every((d, i) => {
      const c = i % map.cols;
      const r = (i - c) / map.cols;
      return d === Math.abs(c - 20) + Math.abs(r - 14);
    });

    build(map);
    const after = distances(field, map);

    expect(manhattan).toBe(true);
    expect(TEST_SITE_CELLS.map(([c, r]) => after[r * map.cols + c])).toEqual([-1, -1, -1, -1]);
    const behind = 8 * map.cols + 20;
    expect(after[behind]).toBeGreaterThan(before[behind] ?? 0);
  });

  it('solo recalcula al cambiar la revisión (perezoso, una BFS por obra)', () => {
    const map = GameMap.open(RULES);
    const field = new FlowField(map);
    field.retarget(20, 14);
    field.distanceAt(0, 0);
    field.distanceAt(1, 1);
    const once = field.computations;
    build(map);
    field.distanceAt(0, 0);
    field.distanceAt(1, 1);
    expect([once, field.computations]).toEqual([1, 2]);
  });

  it('Scenario: Mismo campo con los mismos edificios (a nivel de campo)', () => {
    const early = GameMap.open(RULES);
    const late = GameMap.open(RULES);
    const a = new FlowField(early);
    const b = new FlowField(late);
    a.retarget(40, 10);
    b.retarget(40, 10);
    build(early);
    // En `late` el campo se consulta y se mueve de objetivo antes de la misma obra.
    distances(b, late);
    b.retarget(3, 3);
    distances(b, late);
    build(late);
    b.retarget(40, 10);
    expect(distances(b, late)).toEqual(distances(a, early));
  });

  it('un mapa sin bloqueos pasa a navegar por BFS tras la primera obra', () => {
    const map = GameMap.open(RULES);
    const field = new FlowField(map);
    const out = { x: 0, y: 0 };
    // Enemigo encima de la huella (celda (20, 9)) y jugador debajo (celda (20, 13)).
    field.retarget(20, 13);
    field.steer(1230, 570, 1230, 810, out);
    expect(out).toEqual({ x: 1230, y: 810 });
    build(map);
    field.steer(1230, 570, 1230, 810, out);
    expect(out).not.toEqual({ x: 1230, y: 810 });
    expect(map.isBuilt(map.colAt(out.x), map.rowAt(out.y))).toBe(false);
  });
});

describe('Línea libre con edificios (spec build-sites 0026)', () => {
  it('Scenario: El edificio corta la línea libre', () => {
    const map = mapWith(RULES, {});
    const free = new FlowField(map).hasClearLine(1100, 660, 1400, 660);
    build(map);
    expect(free).toBe(true);
    expect(new FlowField(map).hasClearLine(1100, 660, 1400, 660)).toBe(false);
  });
});
