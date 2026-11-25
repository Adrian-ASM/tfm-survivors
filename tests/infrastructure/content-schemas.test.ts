import { describe, expect, it } from 'vitest';
import {
  GEM_RADIUS_MUST_BE_POSITIVE,
  MAGNET_SPEED_MUST_BE_POSITIVE,
  MAX_GEMS_MUST_BE_INTEGER,
  MAX_GOLD_MUST_BE_INTEGER,
  MAX_MEAT_MUST_BE_INTEGER,
  MAX_WOOD_MUST_BE_INTEGER,
} from '../../src/domain/pickup/PickupRules';
import {
  MEAT_HEAL_PERCENT_OUT_OF_RANGE,
  RESOURCE_AMOUNT_MUST_BE_INTEGER,
  RESOURCE_COUNT_MUST_BE_INTEGER,
  RESOURCE_PLACEMENT_MUST_BE_INTEGER,
  VEIN_RADIUS_MUST_BE_POSITIVE,
} from '../../src/domain/resource/ResourceRules';
import { MAX_WOOD_BELOW_WOOD_PILES } from '../../src/domain/run/RunConfig';
import { loadRunConfig, parseRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { PICKUP_RADIUS_MUST_BE_POSITIVE } from '../../src/domain/player/PlayerRules';
import { rawContent, type RawContent } from '../support/builders';
import { UPGRADE_STAT_OUT_OF_RANGE } from '../../src/domain/upgrade/UpgradeType';

// Specs xp-gems ("Contenido de gemas validado") y resources ("Contenido de recursos validado") de
// 0022 con el cargador: forma con zod (estricto) y las invariantes del dominio desde el superRefine.
type Raw = RawContent;

function failure(change: (raw: Raw) => void): { field: string; message: string } {
  const raw = rawContent();
  change(raw);
  const r = parseRunConfig(raw);
  if (r.ok) throw new Error('se esperaba un error de contenido');
  return r.error;
}

function loads(change: (raw: Raw) => void): boolean {
  const raw = rawContent();
  change(raw);
  return parseRunConfig(raw).ok;
}

const barrel = (raw: Raw) => {
  const d = raw.resources.drops.enemies['goblin-barrel'];
  if (!d) throw new Error('el barril suelta madera en el contenido por defecto');
  return d;
};
const house = (raw: Raw) => {
  const d = raw.resources.drops.structures['goblin-house'];
  if (!d) throw new Error('la casa suelta oro en el contenido por defecto');
  return d;
};
const tower = (raw: Raw) => {
  const d = raw.resources.drops.structures['goblin-tower'];
  if (!d) throw new Error('la torre suelta oro en el contenido por defecto');
  return d;
};

describe('Contenido de gemas validado (xp-gems, con zod)', () => {
  it('Scenario: Contenido por defecto (128, 5, 360, 300; topes de oro, madera y carne ≥ 1 y madera ≥ montones)', () => {
    const r = loadRunConfig();
    if (!r.ok) throw new Error(r.error.message);
    const { progression, player, resources } = r.value;
    expect([player.pickupRadius, progression.gemRadius, progression.magnetSpeed]).toEqual([
      128, 5, 360,
    ]);
    expect(progression.maxGems).toBe(300);
    const caps = [progression.maxGold, progression.maxWood, progression.maxMeat];
    expect(caps.every((v) => Number.isInteger(v) && v >= 1)).toBe(true);
    expect(progression.maxWood).toBeGreaterThanOrEqual(resources.woodPiles.count);
  });

  it.each([
    [
      'player.pickupRadius',
      (r: Raw) => (r.player.pickupRadius = 0),
      PICKUP_RADIUS_MUST_BE_POSITIVE,
    ],
    [
      'progression.gemRadius',
      (r: Raw) => (r.progression.gemRadius = 0),
      GEM_RADIUS_MUST_BE_POSITIVE,
    ],
    [
      'progression.magnetSpeed',
      (r: Raw) => (r.progression.magnetSpeed = -1),
      MAGNET_SPEED_MUST_BE_POSITIVE,
    ],
    ['progression.maxGems', (r: Raw) => (r.progression.maxGems = 0), MAX_GEMS_MUST_BE_INTEGER],
    ['progression.maxGold', (r: Raw) => (r.progression.maxGold = 0), MAX_GOLD_MUST_BE_INTEGER],
    ['progression.maxWood', (r: Raw) => (r.progression.maxWood = 0), MAX_WOOD_MUST_BE_INTEGER],
    ['progression.maxMeat', (r: Raw) => (r.progression.maxMeat = 0), MAX_MEAT_MUST_BE_INTEGER],
  ])('Scenario: Valores no positivos (%s)', (field, change, message) => {
    expect(failure(change)).toMatchObject({ field, message });
  });

  it('Scenario: Tope de gemas no entero (maxGems 12,5, tope de oro 2,5 y tope de carne 1,5)', () => {
    expect(failure((r) => (r.progression.maxGems = 12.5)).field).toBe('progression.maxGems');
    expect(failure((r) => (r.progression.maxGold = 2.5)).field).toBe('progression.maxGold');
    expect(failure((r) => (r.progression.maxMeat = 1.5)).field).toBe('progression.maxMeat');
  });

  it('Scenario: Campo desconocido o ausente (gemLifetime, sin magnetSpeed, sin los topes de madera y carne)', () => {
    expect(failure((r) => (r.progression.gemLifetime = 600)).field).toBe('progression.gemLifetime');
    expect(
      failure((r) => {
        delete (r.progression as Partial<Raw['progression']>).magnetSpeed;
      }).field,
    ).toBe('progression.magnetSpeed');
    expect(
      failure((r) => {
        delete (r.progression as Partial<Raw['progression']>).maxWood;
      }).field,
    ).toBe('progression.maxWood');
    expect(
      failure((r) => {
        delete (r.progression as Partial<Raw['progression']>).maxMeat;
      }).field,
    ).toBe('progression.maxMeat');
  });

  it('Scenario: Tope mínimo válido (maxGems 1, tope de oro 1 y tope de carne 1)', () => {
    expect(
      loads((r) => {
        r.progression.maxGems = 1;
        r.progression.maxGold = 1;
        r.progression.maxMeat = 1;
      }),
    ).toBe(true);
  });

  it('Scenario: Tope de madera menor que los montones (6 montones: tope 5 falla, 6 vale)', () => {
    const with6 = (maxWood: number) => (r: Raw) => {
      r.resources.woodPiles.count = 6;
      r.progression.maxWood = maxWood;
    };
    expect(failure(with6(5))).toEqual({
      code: 'invalid-config',
      field: 'progression.maxWood',
      message: MAX_WOOD_BELOW_WOOD_PILES,
    });
    expect(loads(with6(6))).toBe(true);
  });
});

describe('Contenido de recursos validado (resources, con zod)', () => {
  it('Scenario: Contenido por defecto (6 cantidades ≥ 1, montones y vetas ≥ 1, radio > 0; carne 1 y 20)', () => {
    const r = loadRunConfig();
    if (!r.ok) throw new Error(r.error.message);
    const { drops, woodPiles, goldVeins, meat } = r.value.resources;
    const amounts = [
      drops.enemies['goblin-barrel']?.wood,
      drops.structures['goblin-house']?.gold,
      drops.structures['goblin-tower']?.gold,
      goldVeins.gold,
      woodPiles.wood,
      meat.perSheep,
    ];
    expect(meat).toEqual({ perSheep: 1, healPercent: 20 });
    expect(amounts.every((v) => Number.isInteger(v) && (v ?? 0) >= 1)).toBe(true);
    expect(Math.min(woodPiles.count, goldVeins.count)).toBeGreaterThanOrEqual(1);
    expect(goldVeins.radius).toBeGreaterThan(0);
  });

  it.each([
    [
      'madera por barril 0',
      (r: Raw) => (barrel(r).wood = 0),
      'resources.drops.enemies.goblin-barrel.wood',
    ],
    [
      'madera por barril −1',
      (r: Raw) => (barrel(r).wood = -1),
      'resources.drops.enemies.goblin-barrel.wood',
    ],
    [
      'madera por barril 2,5',
      (r: Raw) => (barrel(r).wood = 2.5),
      'resources.drops.enemies.goblin-barrel.wood',
    ],
    [
      'oro por casa 0',
      (r: Raw) => (house(r).gold = 0),
      'resources.drops.structures.goblin-house.gold',
    ],
    [
      'oro por torre 1,5',
      (r: Raw) => (tower(r).gold = 1.5),
      'resources.drops.structures.goblin-tower.gold',
    ],
    ['oro por veta 0', (r: Raw) => (r.resources.goldVeins.gold = 0), 'resources.goldVeins.gold'],
    [
      'madera por montón 0',
      (r: Raw) => (r.resources.woodPiles.wood = 0),
      'resources.woodPiles.wood',
    ],
    ['carne por oveja 0', (r: Raw) => (r.resources.meat.perSheep = 0), 'resources.meat.perSheep'],
    [
      'carne por oveja 1,5',
      (r: Raw) => (r.resources.meat.perSheep = 1.5),
      'resources.meat.perSheep',
    ],
  ])('Scenario: Valores fuera de rango (%s)', (_name, change, field) => {
    expect(failure(change)).toMatchObject({ field, message: RESOURCE_AMOUNT_MUST_BE_INTEGER });
  });

  it.each([
    [
      'vetas −1',
      (r: Raw) => (r.resources.goldVeins.count = -1),
      'resources.goldVeins.count',
      RESOURCE_COUNT_MUST_BE_INTEGER,
    ],
    [
      'vetas 1,5',
      (r: Raw) => (r.resources.goldVeins.count = 1.5),
      'resources.goldVeins.count',
      RESOURCE_COUNT_MUST_BE_INTEGER,
    ],
    [
      'radio 0',
      (r: Raw) => (r.resources.goldVeins.radius = 0),
      'resources.goldVeins.radius',
      VEIN_RADIUS_MUST_BE_POSITIVE,
    ],
    [
      'radio −4',
      (r: Raw) => (r.resources.goldVeins.radius = -4),
      'resources.goldVeins.radius',
      VEIN_RADIUS_MUST_BE_POSITIVE,
    ],
    [
      'distancia −1',
      (r: Raw) => (r.resources.placement.minGapCells = -1),
      'resources.placement.minGapCells',
      RESOURCE_PLACEMENT_MUST_BE_INTEGER,
    ],
    [
      'curación de la carne 0',
      (r: Raw) => (r.resources.meat.healPercent = 0),
      'resources.meat.healPercent',
      MEAT_HEAL_PERCENT_OUT_OF_RANGE,
    ],
    [
      'curación de la carne 101',
      (r: Raw) => (r.resources.meat.healPercent = 101),
      'resources.meat.healPercent',
      MEAT_HEAL_PERCENT_OUT_OF_RANGE,
    ],
    [
      'curación de la carne 12.5',
      (r: Raw) => (r.resources.meat.healPercent = 12.5),
      'resources.meat.healPercent',
      MEAT_HEAL_PERCENT_OUT_OF_RANGE,
    ],
  ])('Scenario: Valores fuera de rango (%s)', (_name, change, field, message) => {
    expect(failure(change)).toMatchObject({ field, message });
  });

  it.each([
    [
      '0 montones y 0 vetas',
      (r: Raw) => {
        r.resources.woodPiles.count = 0;
        r.resources.goldVeins.count = 0;
      },
    ],
    [
      'todas las cantidades a 1',
      (r: Raw) => {
        barrel(r).wood = 1;
        house(r).gold = 1;
        tower(r).gold = 1;
        r.resources.goldVeins.gold = 1;
        r.resources.woodPiles.wood = 1;
        r.resources.meat.perSheep = 1;
      },
    ],
    ['curación de la carne 1', (r: Raw) => (r.resources.meat.healPercent = 1)],
    // Spec resources (0024), "Límites válidos": la curación 100 vale para el campo, pero con el
    // catálogo por defecto (`hunter` > 0) la carne efectiva pasaría de 100 (ver el caso de abajo).
    [
      'curación de la carne 100 (sin hunter)',
      (r: Raw) => {
        r.resources.meat.healPercent = 100;
        const hunter = r.upgrades.character.findIndex((u) => u.id === 'hunter');
        r.upgrades.character.splice(hunter, 1);
      },
    ],
    [
      'todas las distancias a 0',
      (r: Raw) => {
        r.resources.placement = { minStartCells: 0, minCastleCells: 0, minGapCells: 0 };
      },
    ],
  ])('Scenario: Límites válidos (%s)', (_name, change) => {
    expect(loads(change)).toBe(true);
  });

  it('Scenario: Límites válidos (curación de la carne 100 con hunter: error de upgrades, no de recursos)', () => {
    const e = failure((r) => (r.resources.meat.healPercent = 100));

    expect(e.field).toMatch(/^upgrades\.character\.\d+\.perLevel$/);
    expect(e.message).toContain(UPGRADE_STAT_OUT_OF_RANGE);
    expect(e.message).toContain('hunter');
    expect(e.message).toContain('meatHealPercent');
  });

  it('Scenario: Campos ausentes, desconocidos y tipo no admitido (oro por veta, curación, meatPerHouse, potion)', () => {
    const noGold = failure((r) => {
      delete (r.resources.goldVeins as Partial<Raw['resources']['goldVeins']>).gold;
    });
    expect(noGold.field).toBe('resources.goldVeins.gold');
    const noHeal = failure((r) => {
      delete (r.resources.meat as Partial<Raw['resources']['meat']>).healPercent;
    });
    expect(noHeal.field).toBe('resources.meat.healPercent');
    expect(failure((r) => (r.resources.meatPerHouse = 5)).field).toBe('resources.meatPerHouse');
    const potion = failure((r) => (barrel(r).potion = 2));
    expect(potion.field).toBe('resources.drops.enemies.goblin-barrel.potion');
    expect(failure((r) => (r.resources.drops.potion = {})).field).toBe('resources.drops.potion');
  });
});
