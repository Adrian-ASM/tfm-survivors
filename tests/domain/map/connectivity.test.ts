import { describe, expect, it } from 'vitest';
import { GameMap } from '../../../src/domain/map/GameMap';
import { isFullyConnected, reachableCells } from '../../../src/domain/map/connectivity';
import { mapRules, mapWith } from '../../support/mapLayouts';

const RULES = mapRules();

describe('Zona de inicio (spec procedural-map)', () => {
  it('Scenario: Celdas dentro y fuera de la zona ((18, 9) a 120 px sí; (19, 9) a 180 px no)', () => {
    expect(RULES.inStartZone(18, 9)).toBe(true);
    expect(RULES.inStartZone(19, 9)).toBe(false);
  });

  it('con el contenido por defecto la zona es el bloque 13..18 × 6..11 (36 celdas)', () => {
    const zone: string[] = [];
    for (let r = 0; r < RULES.rows; r++) {
      for (let c = 0; c < RULES.cols; c++)
        if (RULES.inStartZone(c, r)) zone.push(`${String(c)},${String(r)}`);
    }
    const cols = zone.map((k) => Number(k.split(',')[0]));
    const rows = zone.map((k) => Number(k.split(',')[1]));
    expect([Math.min(...cols), Math.max(...cols), Math.min(...rows), Math.max(...rows)]).toEqual([
      13, 18, 6, 11,
    ]);
    expect(zone).toHaveLength(36);
    expect(RULES.inStartZone(12, 6)).toBe(false);
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
