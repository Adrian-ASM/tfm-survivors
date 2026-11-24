import { describe, expect, it } from 'vitest';
import { buildRunRules, MAX_WOOD_BELOW_WOOD_PILES } from '../../src/domain/run/RunConfig';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import {
  RESOURCE_AMOUNT_MUST_BE_INTEGER,
  RESOURCE_COUNT_MUST_BE_INTEGER,
  RESOURCE_DROP_UNKNOWN_ENEMY,
  RESOURCE_DROP_UNKNOWN_STRUCTURE,
  RESOURCE_PLACEMENT_MUST_BE_INTEGER,
  VEIN_RADIUS_MUST_BE_POSITIVE,
  type ResourcesConfig,
} from '../../src/domain/resource/ResourceRules';
import { CONTENT_RESOURCES, aDefaultConfig, withResources } from '../support/builders';

type Patch = (r: ResourcesConfig) => ResourcesConfig;

const config = (patch: Patch): RunConfig =>
  withResources(aDefaultConfig(), patch(structuredClone(CONTENT_RESOURCES)));

function failure(c: RunConfig) {
  const r = buildRunRules(c);
  if (r.ok) throw new Error('se esperaba un error');
  return r.error;
}

const barrelWood =
  (wood: number): Patch =>
  (r) => ({
    ...r,
    drops: { ...r.drops, enemies: { 'goblin-barrel': { wood } } },
  });
const houseGold =
  (gold: number): Patch =>
  (r) => ({
    ...r,
    drops: { ...r.drops, structures: { ...r.drops.structures, 'goblin-house': { gold } } },
  });
const towerGold =
  (gold: number): Patch =>
  (r) => ({
    ...r,
    drops: { ...r.drops, structures: { ...r.drops.structures, 'goblin-tower': { gold } } },
  });
const veins =
  (patch: Partial<ResourcesConfig['goldVeins']>): Patch =>
  (r) => ({
    ...r,
    goldVeins: { ...r.goldVeins, ...patch },
  });
const piles =
  (patch: Partial<ResourcesConfig['woodPiles']>): Patch =>
  (r) => ({
    ...r,
    woodPiles: { ...r.woodPiles, ...patch },
  });
const placement =
  (patch: Partial<ResourcesConfig['placement']>): Patch =>
  (r) => ({
    ...r,
    placement: { ...r.placement, ...patch },
  });

describe('ResourceRules (spec resources, "Contenido de recursos validado", dominio)', () => {
  it('Scenario: Contenido por defecto (drops resueltos por id, cantidades ≥ 1)', () => {
    const r = buildRunRules(aDefaultConfig());
    if (!r.ok) throw new Error(r.error.message);
    const res = r.value.resources;
    expect(res.woodFor('goblin-barrel')).toBeGreaterThanOrEqual(1);
    expect(res.woodFor('goblin-torch')).toBe(0);
    expect(res.goldFor('goblin-house')).toBeGreaterThanOrEqual(1);
    expect(res.goldFor('goblin-tower')).toBeGreaterThanOrEqual(1);
    expect(res.woodPiles.count).toBeGreaterThanOrEqual(1);
    expect(res.goldVeins.count).toBeGreaterThanOrEqual(1);
    expect(res.goldVeins.radius).toBeGreaterThan(0);
  });

  it.each([
    ['madera por barril 0', barrelWood(0), 'resources.drops.enemies.goblin-barrel.wood'],
    ['madera por barril −1', barrelWood(-1), 'resources.drops.enemies.goblin-barrel.wood'],
    ['madera por barril 2,5', barrelWood(2.5), 'resources.drops.enemies.goblin-barrel.wood'],
    ['oro por casa 0', houseGold(0), 'resources.drops.structures.goblin-house.gold'],
    ['oro por torre 1,5', towerGold(1.5), 'resources.drops.structures.goblin-tower.gold'],
    ['oro por veta 0', veins({ gold: 0 }), 'resources.goldVeins.gold'],
    ['madera por montón 0', piles({ wood: 0 }), 'resources.woodPiles.wood'],
  ])('Scenario: Valores fuera de rango (%s)', (_name, patch, field) => {
    expect(failure(config(patch))).toEqual({
      code: 'invalid-config',
      field,
      message: RESOURCE_AMOUNT_MUST_BE_INTEGER,
    });
  });

  it.each([
    ['vetas −1', veins({ count: -1 }), 'resources.goldVeins.count', RESOURCE_COUNT_MUST_BE_INTEGER],
    [
      'vetas 1,5',
      veins({ count: 1.5 }),
      'resources.goldVeins.count',
      RESOURCE_COUNT_MUST_BE_INTEGER,
    ],
    ['radio 0', veins({ radius: 0 }), 'resources.goldVeins.radius', VEIN_RADIUS_MUST_BE_POSITIVE],
    ['radio −4', veins({ radius: -4 }), 'resources.goldVeins.radius', VEIN_RADIUS_MUST_BE_POSITIVE],
    [
      'distancia −1',
      placement({ minGapCells: -1 }),
      'resources.placement.minGapCells',
      RESOURCE_PLACEMENT_MUST_BE_INTEGER,
    ],
  ])('Scenario: Valores fuera de rango (%s)', (_name, patch, field, message) => {
    expect(failure(config(patch))).toEqual({ code: 'invalid-config', field, message });
  });

  it('un drop de un tipo de enemigo o de estructura desconocido nombra la clave', () => {
    const enemy = config((r) => ({ ...r, drops: { ...r.drops, enemies: { sheep: { wood: 1 } } } }));
    expect(failure(enemy)).toMatchObject({
      field: 'resources.drops.enemies.sheep',
      message: `${RESOURCE_DROP_UNKNOWN_ENEMY}: sheep`,
    });
    const site = config((r) => ({
      ...r,
      drops: { ...r.drops, structures: { mill: { gold: 1 } } },
    }));
    expect(failure(site)).toMatchObject({
      field: 'resources.drops.structures.mill',
      message: `${RESOURCE_DROP_UNKNOWN_STRUCTURE}: mill`,
    });
  });

  it.each([
    ['0 montones y 0 vetas', (r: ResourcesConfig) => piles({ count: 0 })(veins({ count: 0 })(r))],
    [
      'todas las cantidades a 1',
      (r: ResourcesConfig) =>
        barrelWood(1)(houseGold(1)(towerGold(1)(veins({ gold: 1 })(piles({ wood: 1 })(r))))),
    ],
    [
      'todas las distancias a 0',
      placement({ minStartCells: 0, minCastleCells: 0, minGapCells: 0 }),
    ],
    [
      'mapas de drops vacíos',
      (r: ResourcesConfig) => ({ ...r, drops: { enemies: {}, structures: {} } }),
    ],
  ])('Scenario: Límites válidos (%s)', (_name, patch) => {
    expect(buildRunRules(config(patch)).ok).toBe(true);
  });
});

describe('Tope de madera y montones (spec xp-gems, "Contenido de gemas validado")', () => {
  const withPilesAndTope = (count: number, maxWood: number): RunConfig => {
    const c = config(piles({ count }));
    return { ...c, progression: { ...c.progression, maxWood } };
  };

  it('Scenario: Tope de madera menor que los montones (6 montones: tope 5 falla, 6 vale)', () => {
    expect(failure(withPilesAndTope(6, 5))).toEqual({
      code: 'invalid-config',
      field: 'progression.maxWood',
      message: MAX_WOOD_BELOW_WOOD_PILES,
    });
    expect(buildRunRules(withPilesAndTope(6, 6)).ok).toBe(true);
  });
});
