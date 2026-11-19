import { describe, expect, it } from 'vitest';
import {
  INVULNERABILITY_TICKS_MUST_BE_INTEGER,
  MAX_BUDGET_BELOW_MAX_COST,
  PICKUP_RADIUS_MUST_BE_POSITIVE,
  PLAYER_HEALTH_MUST_BE_POSITIVE,
  RADIUS_MUST_FIT,
  SPEED_MUST_BE_POSITIVE,
  buildRunRules,
  type RunConfig,
} from '../../src/domain/run/RunConfig';
import { UNKNOWN_ENEMY_TYPE } from '../../src/domain/wave/WaveTable';
import {
  MAX_ALIVE_MUST_BE_INTEGER,
  MAX_ATTEMPTS_MUST_BE_INTEGER,
  MAX_BUDGET_MUST_BE_POSITIVE,
  SPAWN_DISTANCE_MUST_BE_NON_NEGATIVE,
} from '../../src/domain/wave/SpawnRules';
import { WEAPON_ID_MUST_BE_UNIQUE } from '../../src/domain/weapon/WeaponLoadout';
import { PULSE_VISUAL_TICKS_MUST_BE_INTEGER } from '../../src/domain/weapon/WeaponType';
import {
  GEM_RADIUS_MUST_BE_POSITIVE,
  MAGNET_SPEED_MUST_BE_POSITIVE,
  MAX_GEMS_MUST_BE_INTEGER,
} from '../../src/domain/progression/GemRules';
import {
  BASE_XP_MUST_BE_INTEGER,
  XP_GROWTH_MUST_BE_INTEGER,
} from '../../src/domain/progression/XpCurve';
import {
  DEFAULT_PROGRESSION,
  DEFAULT_UPGRADES,
  DEFAULT_WEAPONS,
  LINTER,
  TESTS,
  aRunConfig,
  anUpgrade,
  withUpgrades,
  withWeapons,
} from '../support/builders';

type Waves = RunConfig['waves'];
const withWaves = (waves: Partial<Waves>, spawn: Partial<Waves['spawn']> = {}): RunConfig => {
  const base = aRunConfig();
  return { ...base, waves: { ...base.waves, ...waves, spawn: { ...base.waves.spawn, ...spawn } } };
};

function failure(config: RunConfig): { field: string; message: string } {
  const r = buildRunRules(config);
  if (r.ok) throw new Error('se esperaba un error');
  return r.error;
}

describe('buildRunRules', () => {
  it('compone arena, vista, catálogo, tabla y reglas de spawn del contenido por defecto', () => {
    const r = buildRunRules(aRunConfig());
    if (!r.ok) throw new Error(r.error.message);
    const { arena, view, catalog, table, spawn } = r.value;
    expect([arena.width, arena.height, view.width, view.height]).toEqual([960, 540, 960, 540]);
    expect(catalog.ids).toEqual(['bug', 'memory-leak', 'merge-conflict']);
    expect(table.segments.map((s) => s.fromSecond)).toEqual([0, 60, 180, 300, 480]);
    expect(spawn).toMatchObject({ maxAlive: 200, minDistance: 200, maxAttempts: 8, margin: 32 });
  });

  it('radio del anillo = mitad de la diagonal de la vista + margin ≈ 582,727', () => {
    const r = buildRunRules(aRunConfig());
    expect(r.ok && r.value.spawn.ringRadius).toBeCloseTo(582.7268, 4);
  });

  it.each([0, 12.5, -3])('Tope de vivos no entero (maxAlive %s)', (maxAlive) => {
    expect(failure(withWaves({ maxAlive }))).toEqual({
      code: 'invalid-config',
      field: 'waves.maxAlive',
      message: MAX_ALIVE_MUST_BE_INTEGER,
    });
  });

  it.each([0, 2.5])('rechaza maxAttempts no entero o < 1 (%s)', (maxAttempts) => {
    expect(failure(withWaves({}, { maxAttempts }))).toMatchObject({
      field: 'waves.spawn.maxAttempts',
      message: MAX_ATTEMPTS_MUST_BE_INTEGER,
    });
  });

  it.each(['margin', 'minDistance'] as const)('rechaza %s negativo', (key) => {
    expect(failure(withWaves({}, { [key]: -1 }))).toMatchObject({
      field: `waves.spawn.${key}`,
      message: SPAWN_DISTANCE_MUST_BE_NON_NEGATIVE,
    });
  });

  it('acepta margin y minDistance 0, y minDistance mayor que el anillo', () => {
    expect(buildRunRules(withWaves({}, { margin: 0, minDistance: 0 })).ok).toBe(true);
    expect(buildRunRules(withWaves({}, { minDistance: 2000 })).ok).toBe(true);
  });

  it('rechaza una vista sin tamaño', () => {
    const base = aRunConfig();
    const config = { ...base, arena: { ...base.arena, view: { width: 0, height: 540 } } };
    expect(failure(config).field).toBe('arena.view.width');
  });

  it('propaga las reglas del catálogo y de la tabla con la ruta del campo', () => {
    const base = aRunConfig();
    const badType = {
      ...base,
      enemies: {
        types: [{ id: 'bug', speed: 0, radius: 10, cost: 1, damage: 5, health: 10, xp: 1 }],
      },
    };
    expect(failure(badType).field).toBe('enemies.types.0.speed');
    const segments = [{ fromSecond: 0, budgetPerSecond: 1, types: ['bug', 'segfault'] }];
    const e = failure(withWaves({ segments }));
    expect(e.field).toBe('waves.segments.0.types.1');
    expect(e.message).toBe(`${UNKNOWN_ENEMY_TYPE}: segfault`);
  });

  it.each([0, -1, Number.NaN])('Máximo de presupuesto no positivo (maxBudget %s)', (maxBudget) => {
    expect(failure(withWaves({ maxBudget }))).toEqual({
      code: 'invalid-config',
      field: 'waves.maxBudget',
      message: MAX_BUDGET_MUST_BE_POSITIVE,
    });
  });

  it('Máximo de presupuesto menor que el coste más caro (2,5 con coste 3)', () => {
    const e = failure(withWaves({ maxBudget: 2.5 }));
    expect(e.field).toBe('waves.maxBudget');
    expect(e.message).toContain(MAX_BUDGET_BELOW_MAX_COST);
    expect(e.message).toContain('3');
    expect(e.message).toContain('memory-leak');
  });

  it('Máximo de presupuesto igual al coste más caro (validación)', () => {
    const r = buildRunRules(withWaves({ maxBudget: 3 }));
    expect(r.ok && r.value.spawn.maxBudget).toBe(3);
  });

  it('pasa al dominio la vida máxima y la invulnerabilidad del jugador', () => {
    const r = buildRunRules(aRunConfig({ maxHealth: 1, invulnerabilityTicks: 1 }));
    expect(r.ok && r.value.player).toMatchObject({ maxHealth: 1, invulnerabilityTicks: 1 });
  });

  it.each([0, -10, Number.NaN, Number.POSITIVE_INFINITY])(
    'Vida máxima cero o negativa (maxHealth %s)',
    (maxHealth) => {
      expect(failure(aRunConfig({ maxHealth }))).toEqual({
        code: 'invalid-config',
        field: 'player.maxHealth',
        message: PLAYER_HEALTH_MUST_BE_POSITIVE,
      });
    },
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'Radio de recogida inválido o ausente (pickupRadius %s)',
    (pickupRadius) => {
      expect(failure(aRunConfig({ pickupRadius }))).toEqual({
        code: 'invalid-config',
        field: 'player.pickupRadius',
        message: PICKUP_RADIUS_MUST_BE_POSITIVE,
      });
    },
  );

  it('Radio de recogida por defecto (64) en los builders', () => {
    const r = buildRunRules(aRunConfig());
    expect(r.ok && r.value.player.pickupRadius).toBe(64);
  });

  it.each([
    ['Duración cero', 0],
    ['Duración negativa', -1],
    ['duración no entera', 2.5],
  ])('%s de invulnerabilidad', (_name, invulnerabilityTicks) => {
    expect(failure(aRunConfig({ invulnerabilityTicks }))).toEqual({
      code: 'invalid-config',
      field: 'player.invulnerabilityTicks',
      message: INVULNERABILITY_TICKS_MUST_BE_INTEGER,
    });
  });

  it('construye el arsenal en el orden del contenido; sin armas por defecto en los builders', () => {
    const r = buildRunRules(withWeapons(aRunConfig(), DEFAULT_WEAPONS));
    expect(r.ok && r.value.loadout.weapons.map((w) => w.id)).toEqual(['linter', 'tests']);
    const none = buildRunRules(aRunConfig());
    expect(none.ok && none.value.loadout.weapons).toEqual([]);
  });

  it('propaga los errores de las armas con la ruta weapons.weapons.i.…', () => {
    const bad = { ...TESTS, attack: { type: 'pulse', visualTicks: 0 } } as const;
    const e = failure(withWeapons(aRunConfig(), { ...DEFAULT_WEAPONS, weapons: [LINTER, bad] }));
    expect(e).toEqual({
      code: 'invalid-config',
      field: 'weapons.weapons.1.attack.visualTicks',
      message: PULSE_VISUAL_TICKS_MUST_BE_INTEGER,
    });
    const dup = withWeapons(aRunConfig(), { ...DEFAULT_WEAPONS, weapons: [LINTER, LINTER] });
    expect(failure(dup).message).toBe(`${WEAPON_ID_MUST_BE_UNIQUE}: linter`);
  });

  it('mantiene las invariantes del jugador', () => {
    expect(failure(aRunConfig({ speed: 0 }))).toMatchObject({
      field: 'player.speed',
      message: SPEED_MUST_BE_POSITIVE,
    });
    expect(failure(aRunConfig({ radius: 300 }))).toMatchObject({
      field: 'player.radius',
      message: RADIUS_MUST_FIT,
    });
  });
});

describe('buildRunRules · progresión y mejoras', () => {
  const withProgression = (patch: Partial<RunConfig['progression']>): RunConfig => ({
    ...aRunConfig(),
    progression: { ...DEFAULT_PROGRESSION, ...patch },
  });

  it('construye la curva, las reglas de las gemas y un catálogo vacío por defecto', () => {
    const r = buildRunRules(aRunConfig());
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.curve.toNext(1)).toBe(5);
    expect(r.value.gems).toMatchObject({ gemRadius: 5, magnetSpeed: 360, maxGems: 300 });
    expect(r.value.upgrades.size).toBe(0);
  });

  it.each([
    ['baseXp', 0, BASE_XP_MUST_BE_INTEGER],
    ['xpGrowth', -1, XP_GROWTH_MUST_BE_INTEGER],
    ['gemRadius', 0, GEM_RADIUS_MUST_BE_POSITIVE],
    ['magnetSpeed', -1, MAGNET_SPEED_MUST_BE_POSITIVE],
    ['maxGems', 12.5, MAX_GEMS_MUST_BE_INTEGER],
  ] as const)('propaga los errores de progresión (%s %s)', (key, value, message) => {
    expect(failure(withProgression({ [key]: value }))).toEqual({
      code: 'invalid-config',
      field: `progression.${key}`,
      message,
    });
  });

  it('construye el catálogo por defecto sobre las armas y propaga sus errores con su ruta', () => {
    const full = withUpgrades(withWeapons(aRunConfig(), DEFAULT_WEAPONS), DEFAULT_UPGRADES);
    const r = buildRunRules(full);
    expect(r.ok && r.value.upgrades.upgrades.map((u) => u.id)).toHaveLength(9);
    const noWeapons = withUpgrades(aRunConfig(), DEFAULT_UPGRADES);
    expect(failure(noWeapons).field).toBe('upgrades.upgrades.0.target.weapon');
  });

  it('pulseCapacity es la del peor caso de las mejoras (Tests a 6 ticks: 2 ecos)', () => {
    const weapons = withWeapons(aRunConfig(), DEFAULT_WEAPONS);
    const fast = withUpgrades(weapons, { upgrades: [anUpgrade('watch-mode', { maxLevel: 7 })] });
    const a = buildRunRules(weapons);
    const b = buildRunRules(fast);
    expect(a.ok && a.value.pulseCapacity).toBe(1);
    expect(b.ok && b.value.pulseCapacity).toBe(2);
  });
});
