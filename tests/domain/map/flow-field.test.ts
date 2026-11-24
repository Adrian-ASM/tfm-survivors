import { describe, expect, it } from 'vitest';
import { FlowField } from '../../../src/domain/map/FlowField';
import { GameMap } from '../../../src/domain/map/GameMap';
import type { MapRules } from '../../../src/domain/map/MapRules';
import { resolveTerrain } from '../../../src/domain/map/TerrainSource';
import { seededRun } from '../../../src/composition/seedSource';
import { BALANCE_SEEDS } from '../../support/balanceSeeds';
import { aDefaultConfig } from '../../support/builders';
import { mapRules, mapWith, type Layout } from '../../support/mapLayouts';

// Spec procedural-map, "Campo de distancias hacia una celda" (change 0019, design §2).
const RULES = mapRules();

/** Campo hacia (col, row) sobre `map`, como matriz de distancias (−1 = sin distancia). */
function fieldOf(map: GameMap, col: number, row: number): number[] {
  const field = new FlowField(map);
  field.retarget(col, row);
  return distances(field, map);
}

function distances(field: FlowField, map: GameMap): number[] {
  const out: number[] = [];
  for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) out.push(field.distanceAt(c, r));
  return out;
}

/** Mapa generado de una semilla con el contenido por defecto (el de `seededRun`). */
function generated(seed: number, rules: MapRules = RULES): GameMap {
  const map = resolveTerrain(seededRun(seed).terrain, rules);
  if (!map.ok) throw new Error(map.error.message);
  return map.value;
}

describe('Campo de distancias hacia una celda (spec procedural-map)', () => {
  it('Scenario: Mapa vacío (|c − 32| + |r − 18|)', () => {
    const map = GameMap.open(RULES);
    const field = new FlowField(map);
    field.retarget(32, 18);
    for (let r = 0; r < map.rows; r++)
      for (let c = 0; c < map.cols; c++)
        expect(field.distanceAt(c, r)).toBe(Math.abs(c - 32) + Math.abs(r - 18));
    expect(field.distanceAt(0, 0)).toBe(50);
    expect(field.distanceAt(63, 35)).toBe(48);
  });

  it('Scenario: Río con un único puente (columna 10 de agua salvo (10, 20))', () => {
    const river: Record<string, 'water' | 'bridge'> = {};
    for (let r = 0; r < RULES.rows; r++) river[`10,${String(r)}`] = r === 20 ? 'bridge' : 'water';
    const map = mapWith(RULES, river);
    const field = new FlowField(map);
    field.retarget(15, 4);
    expect(field.distanceAt(10, 20)).toBe(21);
    expect(field.distanceAt(9, 20)).toBe(22);
    expect(field.distanceAt(5, 4)).toBe(42);
    for (let r = 0; r < RULES.rows; r++) if (r !== 20) expect(field.distanceAt(10, r)).toBe(-1);
  });

  it('Scenario: Celda encerrada (la (10, 5) y los cuatro troncos sin distancia)', () => {
    const closed: Layout = { '10,4': 'trunk', '9,5': 'trunk', '11,5': 'trunk', '10,6': 'trunk' };
    const field = new FlowField(mapWith(RULES, closed));
    field.retarget(20, 5);
    expect(field.distanceAt(10, 5)).toBe(-1);
    for (const [c, r] of [
      [10, 4],
      [9, 5],
      [11, 5],
      [10, 6],
    ] as const)
      expect(field.distanceAt(c, r)).toBe(-1);
    expect(field.distanceAt(20, 5)).toBe(0);
  });

  it('Scenario: Objetivo no caminable (ninguna celda tiene distancia)', () => {
    const map = mapWith(RULES, { '10,4': 'trunk' });
    expect(fieldOf(map, 10, 4).every((d) => d === -1)).toBe(true);
  });

  it('Scenario: Toda celda caminable con distancia en el mapa generado (semillas 1..50)', () => {
    for (const seed of BALANCE_SEEDS) {
      const map = generated(seed);
      const exitCol = map.colAt(map.start.x);
      const exitRow = map.rowAt(map.start.y);
      expect([exitCol, exitRow]).toEqual([32, 19]);
      const field = fieldOf(map, exitCol, exitRow);
      for (let r = 0; r < map.rows; r++) {
        for (let c = 0; c < map.cols; c++) {
          const d = field[r * map.cols + c] ?? -1;
          expect(map.isWalkable(c, r) ? d >= 0 : d === -1).toBe(true);
        }
      }
    }
  });

  it('Scenario: Mismo campo, misma celda (tick 0, tras 3.600 ticks de historia y partida nueva)', () => {
    const map = generated(42);
    const field = new FlowField(map);
    field.retarget(40, 10);
    const first = distances(field, map);
    // Historia: el objetivo recorre 3.600 celdas distintas antes de volver a la (40, 10).
    for (let t = 0; t < 3600; t++) {
      field.retarget(t % map.cols, (t * 7) % map.rows);
      field.distanceAt(0, 0);
    }
    field.retarget(40, 10);
    const again = distances(field, map);
    const fresh = fieldOf(generated(42), 40, 10);
    expect(again).toEqual(first);
    expect(fresh).toEqual(first);
  });

  it('calcular el campo no consume el azar de la partida (el campo no recibe generador)', () => {
    const { random } = seededRun(42);
    const reference = seededRun(42).random;
    fieldOf(generated(42), 40, 10);
    expect(random.next()).toBe(reference.next());
  });

  it('el campo es perezoso: sin consultas no hace la BFS y un retarget igual no la repite', () => {
    const field = new FlowField(GameMap.open(RULES));
    field.retarget(1, 1);
    expect(field.computations).toBe(0);
    field.distanceAt(0, 0);
    field.retarget(1, 1);
    field.distanceAt(5, 5);
    expect(field.computations).toBe(1);
    field.retarget(2, 1);
    field.distanceAt(0, 0);
    expect(field.computations).toBe(2);
  });

  it('una celda fuera de la rejilla no tiene distancia', () => {
    const field = new FlowField(GameMap.open(RULES));
    field.retarget(0, 0);
    expect(field.distanceAt(-1, 0)).toBe(-1);
    expect(field.distanceAt(64, 0)).toBe(-1);
    expect(field.distanceAt(0, 36)).toBe(-1);
  });

  it('la configuración por defecto es la de la rejilla 64 × 36', () => {
    expect(aDefaultConfig().map.cellSize).toBe(60);
    expect([RULES.cols, RULES.rows]).toEqual([64, 36]);
  });
});
