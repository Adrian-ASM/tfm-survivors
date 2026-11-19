import { describe, expect, it } from 'vitest';
import {
  HIT_FLASH_TICKS_MUST_BE_INTEGER,
  MAX_PROJECTILES_MUST_BE_INTEGER,
  WEAPON_ID_MUST_BE_UNIQUE,
  WeaponLoadout,
  type WeaponsConfig,
} from '../../src/domain/weapon/WeaponLoadout';
import {
  WEAPON_DAMAGE_MUST_BE_INTEGER,
  type WeaponTypeConfig,
} from '../../src/domain/weapon/WeaponType';
import { DEFAULT_WEAPONS, LINTER, NO_WEAPONS, TESTS } from '../support/builders';

function failure(config: WeaponsConfig): { field: string; message: string } {
  const r = WeaponLoadout.create(config);
  if (r.ok) throw new Error('se esperaba un error');
  return r.error;
}

function loadout(config: WeaponsConfig): WeaponLoadout {
  const r = WeaponLoadout.create(config);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('WeaponLoadout', () => {
  it('conserva el orden de la lista y los parámetros globales', () => {
    const l = loadout(DEFAULT_WEAPONS);
    expect(l.weapons.map((w) => w.id)).toEqual(['linter', 'tests']);
    expect([l.maxProjectiles, l.hitFlashTicks]).toEqual([32, 4]);
    expect(Object.isFrozen(l)).toBe(true);
    expect(Object.isFrozen(l.weapons)).toBe(true);
  });

  it('Scenario: Armas equipadas al inicio (una partida sin armas es válida en el dominio)', () => {
    expect(loadout(NO_WEAPONS).weapons).toEqual([]);
  });

  it('Scenario: Identificadores duplicados (dos armas linter)', () => {
    const e = failure({ ...DEFAULT_WEAPONS, weapons: [LINTER, TESTS, LINTER] });
    expect(e.field).toBe('weapons.weapons.2.id');
    expect(e.message).toBe(`${WEAPON_ID_MUST_BE_UNIQUE}: linter`);
  });

  it('propaga el error de un arma con su índice en la ruta', () => {
    const e = failure({ ...DEFAULT_WEAPONS, weapons: [LINTER, { ...TESTS, damage: 0 }] });
    expect(e).toEqual({
      code: 'invalid-config',
      field: 'weapons.weapons.1.damage',
      message: WEAPON_DAMAGE_MUST_BE_INTEGER,
    });
  });

  it.each([0, 3.2, -1])('rechaza maxProjectiles %s', (maxProjectiles) => {
    expect(failure({ ...DEFAULT_WEAPONS, maxProjectiles })).toMatchObject({
      field: 'weapons.maxProjectiles',
      message: MAX_PROJECTILES_MUST_BE_INTEGER,
    });
  });

  it.each([0, 1.5])('rechaza hitFlashTicks %s', (hitFlashTicks) => {
    expect(failure({ ...DEFAULT_WEAPONS, hitFlashTicks })).toMatchObject({
      field: 'weapons.hitFlashTicks',
      message: HIT_FLASH_TICKS_MUST_BE_INTEGER,
    });
  });

  it('pulseCapacity = Σ ⌈visualTicks / cooldownTicks⌉ de las armas de pulso', () => {
    expect(loadout(DEFAULT_WEAPONS).pulseCapacity).toBe(1);
    expect(loadout(NO_WEAPONS).pulseCapacity).toBe(0);
    const fast: WeaponTypeConfig = { ...TESTS, id: 'fast', cooldownTicks: 3 };
    const l = loadout({ ...DEFAULT_WEAPONS, weapons: [LINTER, TESTS, fast] });
    expect(l.pulseCapacity).toBe(1 + 3);
  });
});
