import { describe, expect, it } from 'vitest';
import {
  GEM_RADIUS_MUST_BE_POSITIVE,
  GemRules,
  MAGNET_SPEED_MUST_BE_POSITIVE,
  MAX_GEMS_MUST_BE_INTEGER,
} from '../../src/domain/progression/GemRules';
import { XpGem } from '../../src/domain/progression/XpGem';

const DEFAULT = { gemRadius: 5, magnetSpeed: 360, maxGems: 300 };

describe('GemRules', () => {
  it('con los valores por defecto, el imán avanza 6 px por tick', () => {
    const r = GemRules.create(DEFAULT);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toMatchObject(DEFAULT);
    expect(r.value.pullPerTick).toBeCloseTo(6, 12);
  });

  it.each([
    ['gemRadius', 0, GEM_RADIUS_MUST_BE_POSITIVE],
    ['gemRadius', Number.NaN, GEM_RADIUS_MUST_BE_POSITIVE],
    ['magnetSpeed', 0, MAGNET_SPEED_MUST_BE_POSITIVE],
    ['magnetSpeed', -1, MAGNET_SPEED_MUST_BE_POSITIVE],
    ['maxGems', 0, MAX_GEMS_MUST_BE_INTEGER],
    ['maxGems', 12.5, MAX_GEMS_MUST_BE_INTEGER],
  ])('Scenario: Valores no positivos (%s %s)', (key, value, message) => {
    const r = GemRules.create({ ...DEFAULT, [key]: value });
    expect(r.ok ? null : r.error).toEqual({
      code: 'invalid-config',
      field: `progression.${key}`,
      message,
    });
  });

  it('Scenario: Tope mínimo válido (maxGems 1)', () => {
    expect(GemRules.create({ ...DEFAULT, maxGems: 1 }).ok).toBe(true);
  });
});

describe('XpGem.pull', () => {
  it('avanza `step` hacia el jugador', () => {
    const g = new XpGem();
    g.set(0, 544, 270, 1, false);
    g.pull(480, 270, 6);
    expect([g.x, g.y]).toEqual([538, 270]);
  });

  it('Scenario: No sobrepasa al jugador (distancia 3 < 6: queda en su centro)', () => {
    const g = new XpGem();
    g.set(0, 483, 270, 1, false);
    g.pull(480, 270, 6);
    expect([g.x, g.y]).toEqual([480, 270]);
  });

  it('set reinicia el estado de una gema reutilizada', () => {
    const g = new XpGem();
    g.set(0, 1, 2, 3, true);
    g.collected = true;
    g.set(7, 10, 20, 4, false);
    expect(g).toMatchObject({ id: 7, x: 10, y: 20, value: 4, attracted: false, collected: false });
  });
});
