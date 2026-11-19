import { describe, expect, it } from 'vitest';
import {
  PROJECTILE_LIFETIME_MUST_BE_INTEGER,
  PROJECTILE_RADIUS_MUST_BE_POSITIVE,
  PROJECTILE_SPEED_MUST_BE_POSITIVE,
  PULSE_VISUAL_TICKS_MUST_BE_INTEGER,
  TARGETING_RADIUS_MUST_BE_POSITIVE,
  TARGETING_RANGE_MUST_BE_POSITIVE,
  WEAPON_COOLDOWN_MUST_BE_INTEGER,
  WEAPON_DAMAGE_MUST_BE_INTEGER,
  WeaponType,
  type WeaponTypeConfig,
} from '../../src/domain/weapon/WeaponType';
import { LINTER, TESTS } from '../support/builders';

const PATH = 'weapons.weapons.0';

function failure(config: WeaponTypeConfig): { field: string; message: string } {
  const r = WeaponType.create(config, PATH);
  if (r.ok) throw new Error('se esperaba un error');
  return r.error;
}

const linterWith = (patch: object): WeaponTypeConfig => ({ ...LINTER, ...patch });
const linterAttack = (patch: object): WeaponTypeConfig => ({
  ...LINTER,
  attack: { ...LINTER.attack, ...patch },
});
const testsWith = (patch: object): WeaponTypeConfig => ({ ...TESTS, ...patch });
const testsAttack = (patch: object): WeaponTypeConfig => ({
  ...TESTS,
  attack: { ...TESTS.attack, ...patch },
});

describe('WeaponType', () => {
  it('crea las armas por defecto con sus valores, inmutables', () => {
    const r = WeaponType.create(LINTER, PATH);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toMatchObject(LINTER);
    expect(Object.isFrozen(r.value)).toBe(true);
    expect(WeaponType.create(TESTS, PATH).ok).toBe(true);
  });

  it.each([
    [
      'cooldownTicks 0',
      linterWith({ cooldownTicks: 0 }),
      'cooldownTicks',
      WEAPON_COOLDOWN_MUST_BE_INTEGER,
    ],
    ['damage 0', linterWith({ damage: 0 }), 'damage', WEAPON_DAMAGE_MUST_BE_INTEGER],
    ['damage −1', linterWith({ damage: -1 }), 'damage', WEAPON_DAMAGE_MUST_BE_INTEGER],
    [
      'range 0',
      linterWith({ targeting: { mode: 'nearest-in-range', range: 0 } }),
      'targeting.range',
      TARGETING_RANGE_MUST_BE_POSITIVE,
    ],
    [
      'radius del criterio 0',
      testsWith({ targeting: { mode: 'any-in-radius', radius: 0 } }),
      'targeting.radius',
      TARGETING_RADIUS_MUST_BE_POSITIVE,
    ],
    ['speed 0', linterAttack({ speed: 0 }), 'attack.speed', PROJECTILE_SPEED_MUST_BE_POSITIVE],
    [
      'radius del proyectil 0',
      linterAttack({ radius: 0 }),
      'attack.radius',
      PROJECTILE_RADIUS_MUST_BE_POSITIVE,
    ],
    [
      'lifetimeTicks 0',
      linterAttack({ lifetimeTicks: 0 }),
      'attack.lifetimeTicks',
      PROJECTILE_LIFETIME_MUST_BE_INTEGER,
    ],
    [
      'visualTicks 0',
      testsAttack({ visualTicks: 0 }),
      'attack.visualTicks',
      PULSE_VISUAL_TICKS_MUST_BE_INTEGER,
    ],
  ])('Scenario: Valores no positivos (%s)', (_name, config, field, message) => {
    expect(failure(config)).toEqual({
      code: 'invalid-config',
      field: `${PATH}.${field}`,
      message,
    });
  });

  it.each([
    ['cooldownTicks 1,5', linterWith({ cooldownTicks: 1.5 }), 'cooldownTicks'],
    ['damage 2,5', linterWith({ damage: 2.5 }), 'damage'],
    ['lifetimeTicks 10,5', linterAttack({ lifetimeTicks: 10.5 }), 'attack.lifetimeTicks'],
    ['visualTicks 2,5', testsAttack({ visualTicks: 2.5 }), 'attack.visualTicks'],
  ])('Scenario: Valores no enteros (%s)', (_name, config, field) => {
    expect(failure(config).field).toBe(`${PATH}.${field}`);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('rechaza range y speed no finitos (%s)', (v) => {
    expect(failure(linterWith({ targeting: { mode: 'nearest-in-range', range: v } })).field).toBe(
      `${PATH}.targeting.range`,
    );
    expect(failure(linterAttack({ speed: v })).field).toBe(`${PATH}.attack.speed`);
  });

  it('Scenario: Daño mayor que la vida de un enemigo (damage 50 es válido)', () => {
    expect(WeaponType.create(linterWith({ damage: 50 }), PATH).ok).toBe(true);
  });
});
