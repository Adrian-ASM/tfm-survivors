import { describe, expect, it } from 'vitest';
import {
  GEM_RADIUS_MUST_BE_POSITIVE,
  MAGNET_SPEED_MUST_BE_POSITIVE,
  MAX_GEMS_MUST_BE_INTEGER,
  MAX_GOLD_MUST_BE_INTEGER,
  MAX_WOOD_MUST_BE_INTEGER,
  PickupRules,
} from '../../src/domain/pickup/PickupRules';
import { Pickup } from '../../src/domain/pickup/Pickup';
import { PICKUP_KINDS } from '../../src/domain/pickup/PickupKind';

const DEFAULT = { gemRadius: 5, magnetSpeed: 360, maxGems: 300, maxGold: 32, maxWood: 64 };

describe('PickupRules (spec xp-gems, "Contenido de gemas validado")', () => {
  it('con los valores por defecto, el imán avanza 6 px por tick y los topes son por tipo', () => {
    const r = PickupRules.create(DEFAULT);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toMatchObject(DEFAULT);
    expect(r.value.pullPerTick).toBeCloseTo(6, 12);
    expect(PICKUP_KINDS.map((k) => r.value.max(k))).toEqual([300, 32, 64]);
    expect(r.value.capacity).toBe(396);
  });

  it.each([
    ['gemRadius', 0, GEM_RADIUS_MUST_BE_POSITIVE],
    ['gemRadius', Number.NaN, GEM_RADIUS_MUST_BE_POSITIVE],
    ['magnetSpeed', 0, MAGNET_SPEED_MUST_BE_POSITIVE],
    ['magnetSpeed', -1, MAGNET_SPEED_MUST_BE_POSITIVE],
    ['maxGems', 0, MAX_GEMS_MUST_BE_INTEGER],
    ['maxGold', 0, MAX_GOLD_MUST_BE_INTEGER],
    ['maxWood', 0, MAX_WOOD_MUST_BE_INTEGER],
  ])('Scenario: Valores no positivos (%s %s)', (key, value, message) => {
    const r = PickupRules.create({ ...DEFAULT, [key]: value });
    expect(r.ok ? null : r.error).toEqual({
      code: 'invalid-config',
      field: `progression.${key}`,
      message,
    });
  });

  it.each([
    ['maxGems', 12.5, MAX_GEMS_MUST_BE_INTEGER],
    ['maxGold', 2.5, MAX_GOLD_MUST_BE_INTEGER],
  ])('Scenario: Tope de gemas no entero (%s %s)', (key, value, message) => {
    const r = PickupRules.create({ ...DEFAULT, [key]: value });
    expect(r.ok ? null : r.error).toMatchObject({ field: `progression.${key}`, message });
  });

  it('Scenario: Tope mínimo válido (maxGems 1 y tope de oro 1)', () => {
    expect(PickupRules.create({ ...DEFAULT, maxGems: 1, maxGold: 1 }).ok).toBe(true);
  });
});

describe('Pickup.pull', () => {
  it('avanza `step` hacia el jugador', () => {
    const g = new Pickup();
    g.set(0, 'xp', 544, 270, 1, false);
    g.pull(480, 270, 6);
    expect([g.x, g.y]).toEqual([538, 270]);
  });

  it('Scenario: No sobrepasa al jugador (distancia 3 < 6: queda en su centro)', () => {
    const g = new Pickup();
    g.set(0, 'xp', 483, 270, 1, false);
    g.pull(480, 270, 6);
    expect([g.x, g.y]).toEqual([480, 270]);
  });

  it('set reinicia el estado de un recogible reutilizado, también su tipo', () => {
    const g = new Pickup();
    g.set(0, 'xp', 1, 2, 3, true);
    g.collected = true;
    g.set(7, 'gold', 10, 20, 4, false);
    expect(g).toMatchObject({
      id: 7,
      kind: 'gold',
      x: 10,
      y: 20,
      value: 4,
      attracted: false,
      collected: false,
    });
  });
});
