import { describe, expect, it } from 'vitest';
import { LEVEL_UP_HEAL_PERCENT_OUT_OF_RANGE } from '../../src/domain/progression/LevelUpHeal';
import { REGEN_INTERVAL_MUST_BE_INTEGER } from '../../src/domain/player/PlayerRules';
import { RESOURCE_GOLD_PER_KILL_INVALID } from '../../src/domain/resource/ResourceRules';
import {
  SHOP_HEAL_ID_TAKEN,
  SHOP_HEAL_MUST_BE_INTEGER,
  SHOP_RADIUS_MUST_BE_POSITIVE,
  SHOP_REARM_MUST_EXCEED_RADIUS,
} from '../../src/domain/shop/ShopRules';
import { UPGRADE_PRICES_INVALID } from '../../src/domain/upgrade/UpgradeType';
import { loadRunConfig, parseRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { CONTENT_SHOP, rawContent, type RawContent } from '../support/builders';

// Spec castle-shop (0024), "Contenido de la tienda validado"; resources "Tabla de oro por baja
// inválida"; leveling "Valores inválidos" (curación por subida); player-health (intervalo de
// regeneración). Todo pasa por `parseRunConfig` (zod + `buildRunRules`), como el arranque.

type Change = (raw: RawContent) => void;

function failure(change: Change): { field: string; message: string } {
  const raw = rawContent();
  change(raw);
  const r = parseRunConfig(raw);
  if (r.ok) throw new Error('se esperaba un error de contenido');
  return r.error;
}

function loads(change: Change): boolean {
  const raw = rawContent();
  change(raw);
  return parseRunConfig(raw).ok;
}

const weapon = (raw: RawContent, id: string) => {
  const u = raw.upgrades.weapons.find((x) => x.id === id);
  if (!u) throw new Error(id);
  return u;
};

describe('Contenido de la tienda validado (castle-shop 0024)', () => {
  it('Scenario: Contenido por defecto (radio > 0 < re-armado; precios y curación enteros ≥ 1)', () => {
    const r = loadRunConfig();
    if (!r.ok) throw new Error(r.error.message);
    const { shop, upgrades } = r.value;

    expect(shop).toEqual(CONTENT_SHOP);
    expect(shop.door.radius).toBeGreaterThan(0);
    expect(shop.door.rearmDistance).toBeGreaterThan(shop.door.radius);
    expect(upgrades.weapons).toHaveLength(6);
    for (const u of upgrades.weapons) {
      const prices = u.prices ?? [];
      expect(prices).toHaveLength(u.maxLevel);
      expect(
        prices.every((p, i) => Number.isInteger(p) && p >= Math.max(1, prices[i - 1] ?? 1)),
      ).toBe(true);
    }
    for (const v of [shop.heal.price, shop.heal.amount])
      expect(Number.isInteger(v) && v >= 1).toBe(true);
    // El re-armado cabe en la zona de inicio libre (design §2): siempre se puede re-armar.
    expect(shop.door.rearmDistance).toBeLessThan(r.value.map.startRadius);
  });

  it.each<[string, Change, string, string]>([
    ['radio 0', (r) => (r.shop.door.radius = 0), 'shop.door.radius', SHOP_RADIUS_MUST_BE_POSITIVE],
    [
      'radio −5',
      (r) => (r.shop.door.radius = -5),
      'shop.door.radius',
      SHOP_RADIUS_MUST_BE_POSITIVE,
    ],
    [
      're-armado igual al radio',
      (r) => (r.shop.door.rearmDistance = r.shop.door.radius),
      'shop.door.rearmDistance',
      SHOP_REARM_MUST_EXCEED_RADIUS,
    ],
    [
      'precio de curación 0',
      (r) => (r.shop.heal.price = 0),
      'shop.heal.price',
      SHOP_HEAL_MUST_BE_INTEGER,
    ],
    [
      'precio de curación 2,5',
      (r) => (r.shop.heal.price = 2.5),
      'shop.heal.price',
      SHOP_HEAL_MUST_BE_INTEGER,
    ],
    [
      'porción de curación 0',
      (r) => (r.shop.heal.amount = 0),
      'shop.heal.amount',
      SHOP_HEAL_MUST_BE_INTEGER,
    ],
    [
      'id de curación = fast-ci',
      (r) => (r.shop.heal.id = 'fast-ci'),
      'shop.heal.id',
      SHOP_HEAL_ID_TAKEN,
    ],
  ])('Scenario: Valores inválidos (%s)', (_name, change, field, message) => {
    const e = failure(change);

    expect(e.field).toBe(field);
    expect(e.message).toContain(message);
  });

  it.each<[string, Change]>([
    ['un precio 0', (r) => (weapon(r, 'strict-rules').prices = [0, 15, 22, 30, 40])],
    ['fast-ci 10, 8, 12, 14, 16', (r) => (weapon(r, 'fast-ci').prices = [10, 8, 12, 14, 16])],
    ['4 precios para maxLevel 5', (r) => (weapon(r, 'fast-ci').prices = [10, 15, 22, 30])],
    ['mejora de arma sin precios', (r) => delete weapon(r, 'fast-ci').prices],
  ])('Scenario: Valores inválidos (%s: el error nombra el campo o la mejora)', (_name, change) => {
    const e = failure(change);

    expect(e.field).toMatch(/^upgrades\.weapons\.\d\.prices/);
    expect(e.message).toContain(UPGRADE_PRICES_INVALID);
  });

  it('Scenario: Valores inválidos (campo extra discount)', () => {
    const e = failure((r) => (r.shop.discount = 5));

    expect(`${e.field} ${e.message}`).toContain('discount');
  });

  it.each<[string, Change]>([
    ['re-armado = radio + 0,001', (r) => (r.shop.door.rearmDistance = r.shop.door.radius + 0.001)],
    ['precios iguales (5 × 5)', (r) => (weapon(r, 'fast-ci').prices = [5, 5, 5, 5, 5])],
    [
      'precio y porción de la curación 1',
      (r) => {
        r.shop.heal.price = 1;
        r.shop.heal.amount = 1;
      },
    ],
  ])('Scenario: Límites válidos (%s)', (_name, change) => {
    expect(loads(change)).toBe(true);
  });

  it('prices en una mejora de personaje es un campo desconocido', () => {
    const e = failure((r) => {
      const [first] = r.upgrades.character;
      first.prices = [1, 2, 3, 4, 5];
    });

    expect(`${e.field} ${e.message}`).toContain('prices');
  });
});

describe('Tabla de oro por baja inválida (resources 0024, vía parseContent)', () => {
  it.each<[string, Change, string]>([
    [
      'sin goblin-tnt-guard',
      (r) => delete r.resources.drops.goldPerKill['goblin-tnt-guard'],
      'goblin-tnt-guard',
    ],
    ['con goblin-ogre', (r) => (r.resources.drops.goldPerKill['goblin-ogre'] = 3), 'goblin-ogre'],
    [
      'goblin-torch −1',
      (r) => (r.resources.drops.goldPerKill['goblin-torch'] = -1),
      'goblin-torch',
    ],
    [
      'goblin-torch 1,5',
      (r) => (r.resources.drops.goldPerKill['goblin-torch'] = 1.5),
      'goblin-torch',
    ],
  ])('Scenario: Tabla de oro por baja inválida (%s)', (_name, change, id) => {
    const e = failure(change);

    expect(e.field).toBe(`resources.drops.goldPerKill.${id}`);
    expect(e.message).toContain(RESOURCE_GOLD_PER_KILL_INVALID);
  });

  it('sin la tabla de oro por baja el fichero no carga', () => {
    const e = failure((r) => {
      const drops: Record<string, unknown> = r.resources.drops;
      delete drops.goldPerKill;
    });

    expect(e.field).toBe('resources.drops.goldPerKill');
  });
});

describe('Curación por subida e intervalo de regeneración (leveling, player-health 0024)', () => {
  it.each<[string, unknown]>([
    ['0', 0],
    ['101', 101],
    ['2,5', 2.5],
    ['ausente', undefined],
  ])('Scenario: Valores inválidos (curación por subida %s)', (_name, value) => {
    const e = failure((r) => {
      const progression: Record<string, unknown> = r.progression;
      if (value === undefined) delete progression.levelUpHealPercent;
      else progression.levelUpHealPercent = value;
    });

    expect(e).toMatchObject({
      field: 'progression.levelUpHealPercent',
      message: LEVEL_UP_HEAL_PERCENT_OUT_OF_RANGE,
    });
  });

  it.each<[string, unknown]>([
    ['0', 0],
    ['1,5', 1.5],
    ['ausente', undefined],
  ])('intervalo de regeneración inválido (%s)', (_name, value) => {
    const e = failure((r) => {
      const player: Record<string, unknown> = r.player;
      if (value === undefined) delete player.regenIntervalTicks;
      else player.regenIntervalTicks = value;
    });

    expect(e).toMatchObject({
      field: 'player.regenIntervalTicks',
      message: REGEN_INTERVAL_MUST_BE_INTEGER,
    });
  });
});
