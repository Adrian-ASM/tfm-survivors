import { describe, expect, it } from 'vitest';
import { seededRun } from '../../../src/composition/seedSource';
import { FlowField } from '../../../src/domain/map/FlowField';
import { GameMap } from '../../../src/domain/map/GameMap';
import { resolveTerrain } from '../../../src/domain/map/TerrainSource';
import {
  isFullyConnected,
  isFullyConnectedFrom,
  reachableCells,
  reachableCellsFrom,
} from '../../../src/domain/map/connectivity';
import { BALANCE_SEEDS } from '../../support/balanceSeeds';
import { aDefaultConfig } from '../../support/builders';
import { mapRules, mapWith } from '../../support/mapLayouts';
import { startSeededRun } from '../../support/runs';

const RULES = mapRules();

describe('Zona de inicio (spec procedural-map)', () => {
  it('Scenario: Celdas dentro y fuera de la zona (salida (1.950, 1.170): (35, 19) y (32, 22) sí)', () => {
    expect(RULES.inStartZone(35, 19)).toBe(true);
    expect(RULES.inStartZone(36, 19)).toBe(false);
    expect(RULES.inStartZone(32, 22)).toBe(true);
    expect(RULES.inStartZone(32, 23)).toBe(false);
  });

  it('la zona del generador se centra en la salida del castillo; la del centro no cambia', () => {
    expect(RULES.castleStart).toEqual({ x: 1950, y: 1170, radius: 180 });
    expect(RULES.centerStart).toEqual({ x: 1920, y: 1080, radius: 180 });
  });

  it('con el contenido por defecto la zona es el bloque 29..35 × 16..22 sin esquinas (45)', () => {
    const zone: string[] = [];
    for (let r = 0; r < RULES.rows; r++) {
      for (let c = 0; c < RULES.cols; c++)
        if (RULES.inStartZone(c, r)) zone.push(`${String(c)},${String(r)}`);
    }
    const cols = zone.map((k) => Number(k.split(',')[0]));
    const rows = zone.map((k) => Number(k.split(',')[1]));
    expect([Math.min(...cols), Math.max(...cols), Math.min(...rows), Math.max(...rows)]).toEqual([
      29, 35, 16, 22,
    ]);
    expect(zone).toHaveLength(45);
    const corners = [
      [29, 16],
      [35, 16],
      [29, 22],
      [35, 22],
    ] as const;
    expect(corners.map(([c, r]) => RULES.inStartZone(c, r))).toEqual([false, false, false, false]);
  });
});

describe('Conectividad (spec procedural-map)', () => {
  it('el mapa vacío está conectado', () => {
    expect(isFullyConnected(GameMap.open(RULES))).toBe(true);
  });

  it('Scenario: Celda encerrada no es alcanzable', () => {
    const map = mapWith(RULES, {
      '10,4': 'trunk',
      '11,5': 'trunk',
      '9,5': 'trunk',
      '10,6': 'trunk',
    });
    const reached = reachableCells(map);
    expect(reached[5 * RULES.cols + 10]).toBe(0);
    expect(reached[0]).toBe(1);
    expect(isFullyConnected(map)).toBe(false);
  });

  it('dos troncos en diagonal no aíslan nada; un muro de agua con puente conecta', () => {
    const diagonal = mapWith(RULES, { '10,4': 'trunk', '11,5': 'trunk' });
    expect(isFullyConnected(diagonal)).toBe(true);
    const river: Record<string, 'water' | 'bridge'> = {};
    for (let c = 0; c < RULES.cols; c++) river[`${String(c)},2`] = c === 5 ? 'bridge' : 'water';
    expect(isFullyConnected(mapWith(RULES, river))).toBe(true);
    river['5,2'] = 'water';
    expect(isFullyConnected(mapWith(RULES, river))).toBe(false);
  });
});

// Spec procedural-map 0027, "Conectividad con los edificios construidos" y "Campo de distancias hacia
// una celda": el mapa de la partida con las huellas de sus 6 solares en la capa de obra (libres en el
// tick 0 y, como casa o torre, la misma huella).
describe('Conectividad y campo con los solares (spec procedural-map 0027)', () => {
  const CONTENT = aDefaultConfig();
  const FULL = mapRules(CONTENT.map, CONTENT.arena.width, CONTENT.arena.height);
  /** Mapa de la semilla con las huellas de sus solares marcadas, y los solares. */
  const withSites = (seed: number) => {
    const sites = startSeededRun(CONTENT, seed).map.sites;
    const map = resolveTerrain(seededRun(seed).terrain, FULL);
    if (!map.ok) throw new Error(map.error.message);
    for (const s of sites) map.value.build(s.col, s.row, s.cols, s.rows);
    return { map: map.value, sites };
  };

  it('Scenario: Sin zonas aisladas con los solares (libres; casa y torre son la misma huella)', () => {
    const bad: string[] = [];
    for (const seed of BALANCE_SEEDS) {
      const { map, sites } = withSites(seed);
      const exit = map.start;
      expect([exit.x, exit.y]).toEqual([1950, 1170]);
      const [ec, er] = [map.colAt(exit.x), map.rowAt(exit.y)];
      if (!isFullyConnectedFrom(map, ec, er)) bad.push(`${String(seed)}: aisladas`);
      const reached = reachableCellsFrom(map, ec, er);
      for (const s of sites) {
        const ring: [number, number][] = [];
        for (let c = s.col; c < s.col + s.cols; c++) ring.push([c, s.row - 1], [c, s.row + s.rows]);
        for (let r = s.row; r < s.row + s.rows; r++) ring.push([s.col - 1, r], [s.col + s.cols, r]);
        const ok = ring.some(([c, r]) => map.isWalkable(c, r) && reached[r * map.cols + c] === 1);
        if (!ok) bad.push(`${String(seed)}#${String(s.id)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('Scenario: Toda celda caminable con distancia con los solares libres (hacia (32, 19))', () => {
    const bad: string[] = [];
    for (const seed of BALANCE_SEEDS) {
      const { map, sites } = withSites(seed);
      const field = new FlowField(map);
      field.retarget(32, 19);
      const inSite = (c: number, r: number) =>
        sites.some((s) => c >= s.col && c < s.col + s.cols && r >= s.row && r < s.row + s.rows);
      for (let r = 0; r < map.rows; r++) {
        for (let c = 0; c < map.cols; c++) {
          const d = field.distanceAt(c, r);
          const blocked = map.typeAt(c, r) !== 'grass' && map.typeAt(c, r) !== 'bridge';
          if (map.isWalkable(c, r) ? d < 0 : d >= 0)
            bad.push(`${String(seed)}@${String(c)},${String(r)}`);
          if ((blocked || inSite(c, r)) && d >= 0)
            bad.push(`${String(seed)}!${String(c)},${String(r)}`);
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });
});
