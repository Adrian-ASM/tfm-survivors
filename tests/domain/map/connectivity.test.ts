import { describe, expect, it } from 'vitest';
import { GameMap } from '../../../src/domain/map/GameMap';
import { isFullyConnected, reachableCells } from '../../../src/domain/map/connectivity';
import { mapRules, mapWith } from '../../support/mapLayouts';

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
