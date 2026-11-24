import { describe, expect, it } from 'vitest';
import { structureSite } from '../../../src/domain/structure/StructureSite';
import { campRules } from '../../support/camps';

describe('StructureSite (goblin-structures)', () => {
  const rules = campRules();
  const house = rules.structures.byId('goblin-house');
  const tower = rules.structures.byId('goblin-tower');
  if (!house || !tower) throw new Error('tipos por defecto ausentes');

  it('Scenario: Puerta de una casa', () => {
    const site = structureSite(0, house, 20, 10, 2, 3, rules.map);
    expect([site.x, site.y]).toEqual([1260, 690]);
    expect(site.door).toEqual({ col: 21, row: 13, x: 1290, y: 810 });
    expect([site.col, site.row, site.cols, site.rows]).toEqual([20, 10, 2, 3]);
    expect(site.radius).toBe(house.radius);
    expect(Object.isFrozen(site)).toBe(true);
  });

  it('la torre no tiene puerta y su posición es el centro de la huella', () => {
    const site = structureSite(1, tower, 40, 5, 2, 2, rules.map);
    expect([site.x, site.y]).toEqual([2460, 360]);
    expect(site.door).toBeNull();
  });

  it('la puerta de una casa de 3 columnas va en la columna central', () => {
    const site = structureSite(0, house, 10, 4, 3, 2, rules.map);
    expect(site.door).toEqual({ col: 11, row: 6, x: 690, y: 390 });
  });
});
