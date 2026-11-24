import { describe, expect, it } from 'vitest';
import { Arena } from '../../src/domain/arena/Arena';
import type { UpgradesConfig } from '../../src/domain/run/RunConfig';
import type { DomainError, Result } from '../../src/domain/shared/Result';
import { UpgradeCatalog } from '../../src/domain/upgrade/UpgradeCatalog';
import {
  UPGRADE_ID_MUST_BE_UNIQUE,
  UPGRADE_MAX_LEVEL_MUST_BE_INTEGER,
  UPGRADE_PRICES_INVALID,
  UPGRADE_STAT_OUT_OF_RANGE,
  UPGRADE_STEP_MUST_BE_INTEGER,
  UPGRADE_STEP_MUST_NOT_BE_ZERO,
  UPGRADE_STAT_INCOMPATIBLE,
  UPGRADE_UNKNOWN_WEAPON,
  UPGRADE_WRONG_CATALOG,
  type UpgradeTypeConfig,
} from '../../src/domain/upgrade/UpgradeType';
import { WeaponLoadout } from '../../src/domain/weapon/WeaponLoadout';
import { DEFAULT_UPGRADES, DEFAULT_WEAPONS, aRunConfig, anUpgrade } from '../support/builders';

function arena(): Arena {
  const r = Arena.create(960, 540);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

function loadout(): WeaponLoadout {
  const r = WeaponLoadout.create(DEFAULT_WEAPONS);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const lists = (
  character: readonly UpgradeTypeConfig[] = [],
  weapons: readonly UpgradeTypeConfig[] = [],
): UpgradesConfig => ({ character, weapons });

function catalogOf(c: UpgradesConfig): Result<UpgradeCatalog, DomainError> {
  return UpgradeCatalog.create(c, loadout(), aRunConfig().player, arena());
}

function failure(c: UpgradesConfig): DomainError {
  const r = catalogOf(c);
  if (r.ok) throw new Error('se esperaba un error');
  return r.error;
}

const CHARACTER_IDS = [
  'guardrail',
  'shortcuts',
  'context-window',
  'regeneration',
  'armor',
  'steady-nerves',
  'scholar',
  'prospector',
  'hunter',
];
const WEAPON_IDS = [
  'strict-rules',
  'fast-ci',
  'wide-analysis',
  'hard-asserts',
  'watch-mode',
  'coverage',
];

describe('UpgradeCatalog · dos catálogos (0024)', () => {
  it('Scenario: Catálogos por defecto (9 de personaje, 6 de arma, personaje primero)', () => {
    const r = catalogOf(DEFAULT_UPGRADES);
    if (!r.ok) throw new Error(r.error.message);
    const { upgrades, levelIndices, shopIndices } = r.value;

    expect(upgrades.map((u) => u.id)).toEqual([...CHARACTER_IDS, ...WEAPON_IDS]);
    expect(levelIndices.map((i) => upgrades[i]?.id)).toEqual(CHARACTER_IDS);
    expect(shopIndices.map((i) => upgrades[i]?.id)).toEqual(WEAPON_IDS);
    expect(levelIndices.every((i) => upgrades[i]?.target.kind === 'player')).toBe(true);
    expect(shopIndices.every((i) => upgrades[i]?.target.kind === 'weapon')).toBe(true);
    expect(upgrades.map((u) => u.source)).toEqual([
      ...CHARACTER_IDS.map(() => 'level'),
      ...WEAPON_IDS.map(() => 'shop'),
    ]);
  });

  it('Scenario: Catálogo por defecto (15 mejoras; las 9 previas a maxLevel 5)', () => {
    const r = catalogOf(DEFAULT_UPGRADES);
    if (!r.ok) throw new Error(r.error.message);
    const previous = [...WEAPON_IDS, 'guardrail', 'shortcuts', 'context-window'];

    expect(r.value.size).toBe(15);
    for (const u of r.value.upgrades.filter((x) => previous.includes(x.id)))
      expect(u.maxLevel).toBe(5);
  });

  it('acepta dos catálogos vacíos (válido en el dominio, no en el fichero)', () => {
    expect(catalogOf(lists()).ok).toBe(true);
  });

  it('Scenario: Id repetido entre catálogos (fast-ci en los dos)', () => {
    const twin = anUpgrade('guardrail', { id: 'fast-ci' });
    const e = failure(lists([twin], [anUpgrade('strict-rules'), anUpgrade('fast-ci')]));

    expect(e.field).toBe('upgrades.weapons.1.id');
    expect(e.message).toContain(UPGRADE_ID_MUST_BE_UNIQUE);
    expect(e.message).toContain('fast-ci');
  });

  it('Scenario: Mejora en el catálogo equivocado (damage del Linter como personaje)', () => {
    const e = failure(lists([anUpgrade('guardrail'), anUpgrade('strict-rules')]));

    expect(e.field).toBe('upgrades.character.1.target');
    expect(e.message).toContain(UPGRADE_WRONG_CATALOG);
    expect(e.message).toContain('strict-rules');
  });

  it('Scenario: Mejora en el catálogo equivocado (speed en el de arma)', () => {
    const e = failure(lists([], [anUpgrade('shortcuts', { prices: [1, 2, 3, 4, 5] })]));

    expect(e.field).toBe('upgrades.weapons.0.target');
    expect(e.message).toContain(UPGRADE_WRONG_CATALOG);
    expect(e.message).toContain('shortcuts');
  });

  it('Scenario: Estadísticas nuevas en el contenido por defecto (stat, perLevel entero > 0)', () => {
    const stats = {
      regeneration: 'regeneration',
      armor: 'armor',
      'steady-nerves': 'invulnerabilityTicks',
      scholar: 'xpBonusPercent',
      prospector: 'goldBonusPercent',
      hunter: 'meatHealPercent',
    };
    const r = catalogOf(DEFAULT_UPGRADES);
    if (!r.ok) throw new Error(r.error.message);

    for (const [id, stat] of Object.entries(stats)) {
      const u = r.value.upgrades.find((x) => x.id === id);
      expect(u?.stat).toBe(stat);
      expect(Number.isInteger(u?.perLevel) && (u?.perLevel ?? 0) > 0).toBe(true);
      expect(u?.maxLevel).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('UpgradeCatalog · reglas cruzadas', () => {
  it('Scenario: Identificador repetido o lista vacía (dos fast-ci en el catálogo de arma)', () => {
    const e = failure(
      lists([], [anUpgrade('fast-ci'), anUpgrade('strict-rules'), anUpgrade('fast-ci')]),
    );
    expect(e.field).toBe('upgrades.weapons.2.id');
    expect(e.message).toContain(UPGRADE_ID_MUST_BE_UNIQUE);
    expect(e.message).toContain('fast-ci');
  });

  it('Scenario: Arma inexistente (refactor)', () => {
    const e = failure(
      lists([], [anUpgrade('strict-rules', { target: { kind: 'weapon', weapon: 'refactor' } })]),
    );
    expect(e.field).toBe('upgrades.weapons.0.target.weapon');
    expect(e.message).toContain(UPGRADE_UNKNOWN_WEAPON);
    expect(e.message).toContain('refactor');
  });

  it.each([
    ['range para tests', anUpgrade('coverage', { id: 'x-range', stat: 'range' })],
    ['radius para linter', anUpgrade('wide-analysis', { id: 'x-radius', stat: 'radius' })],
    [
      'pickupRadius para un arma',
      anUpgrade('strict-rules', { id: 'x-pick', stat: 'pickupRadius' }),
    ],
  ])('Scenario: Estadística incompatible (%s)', (_name, upgrade) => {
    const e = failure(lists([], [anUpgrade('fast-ci'), upgrade]));
    expect(e.field).toBe('upgrades.weapons.1.stat');
    expect(e.message).toContain(UPGRADE_STAT_INCOMPATIBLE);
    expect(e.message).toContain(upgrade.id);
  });

  it('Scenario: Estadística incompatible (damage para el jugador)', () => {
    const upgrade = anUpgrade('guardrail', { id: 'x-damage', stat: 'damage' });
    const e = failure(lists([anUpgrade('guardrail'), upgrade]));
    expect(e.field).toBe('upgrades.character.1.stat');
    expect(e.message).toContain(UPGRADE_STAT_INCOMPATIBLE);
    expect(e.message).toContain('x-damage');
  });
});

describe('UpgradeCatalog · precios por nivel (castle-shop 0024)', () => {
  it('Scenario: Contenido por defecto (cada mejora de arma con maxLevel precios no decrecientes)', () => {
    const r = catalogOf(DEFAULT_UPGRADES);
    if (!r.ok) throw new Error(r.error.message);

    for (const i of r.value.shopIndices) {
      const u = r.value.upgrades[i];
      const prices = u?.prices ?? [];
      expect(prices).toHaveLength(u?.maxLevel ?? -1);
      expect(
        prices.every((p, k) => Number.isInteger(p) && p >= 1 && p >= (prices[k - 1] ?? 0)),
      ).toBe(true);
    }
    for (const i of r.value.levelIndices) expect(r.value.upgrades[i]?.prices).toEqual([]);
  });

  it.each([
    ['un precio 0', [0, 15, 22, 30, 40]],
    ['un precio no entero', [10, 15.5, 22, 30, 40]],
    ['precios que bajan (10, 8, 12, 14, 16)', [10, 8, 12, 14, 16]],
    ['4 precios para maxLevel 5', [10, 15, 22, 30]],
    ['sin precios', undefined],
  ])('Scenario: Valores inválidos (%s en fast-ci)', (_name, prices) => {
    const { id, name, description, target, stat, perLevel, maxLevel } = anUpgrade('fast-ci');
    const base: UpgradeTypeConfig = { id, name, description, target, stat, perLevel, maxLevel };
    const fast: UpgradeTypeConfig = prices ? { ...base, prices } : base;
    const e = failure(lists([], [anUpgrade('strict-rules'), fast]));

    expect(e.field).toBe('upgrades.weapons.1.prices');
    expect(e.message).toContain(UPGRADE_PRICES_INVALID);
    expect(e.message).toContain('fast-ci');
  });

  it('Scenario: Límites válidos (precios iguales 5, 5, 5, 5, 5)', () => {
    expect(catalogOf(lists([], [anUpgrade('fast-ci', { prices: [5, 5, 5, 5, 5] })])).ok).toBe(true);
  });
});

const outOfRange = (detail: string) => `${UPGRADE_STAT_OUT_OF_RANGE}: ${detail}`;
const weapons = (...u: UpgradeTypeConfig[]) => lists([], u);
const character = (...u: UpgradeTypeConfig[]) => lists(u);

describe('UpgradeCatalog · rango con las mejoras al máximo (build de peor caso)', () => {
  it('Scenario: Nivel máximo que saca la cadencia de rango (fast-ci −6 × 5 sobre 30)', () => {
    const e = failure(weapons(anUpgrade('strict-rules'), anUpgrade('fast-ci', { perLevel: -6 })));
    expect(e).toEqual({
      code: 'invalid-config',
      field: 'upgrades.weapons.1.perLevel',
      message: outOfRange('linter.cooldownTicks = 0 (fast-ci)'),
    });
  });

  it('Scenario: Límite exacto de la cadencia (fast-ci −29 × 1 = 1)', () => {
    const fast = anUpgrade('fast-ci', { perLevel: -29, maxLevel: 1, prices: [10] });
    expect(catalogOf(weapons(fast)).ok).toBe(true);
  });

  it('Scenario: Suma de varias mejoras sobre la misma estadística (−4 × 4 dos veces)', () => {
    const prices = [1, 2, 3, 4];
    const a = anUpgrade('fast-ci', { maxLevel: 4, prices });
    const b = anUpgrade('fast-ci', { id: 'faster-ci', maxLevel: 4, prices });
    const e = failure(lists([anUpgrade('guardrail')], [a, b]));
    expect(e.field).toBe('upgrades.weapons.0.perLevel');
    expect(e.message).toBe(outOfRange('linter.cooldownTicks = -2 (fast-ci, faster-ci)'));
  });

  it('una estadística del jugador que sale de rango nombra al jugador y la mejora', () => {
    const e = failure(character(anUpgrade('guardrail', { perLevel: -20 })));
    expect(e.field).toBe('upgrades.character.0.perLevel');
    expect(e.message).toBe(outOfRange('player.maxHealth = 0 (guardrail)'));
  });

  it('una distancia del criterio que sale de rango (range 400 − 80 × 5)', () => {
    const e = failure(weapons(anUpgrade('wide-analysis', { perLevel: -80 })));
    expect(e.message).toBe(outOfRange('linter.range = 0 (wide-analysis)'));
  });

  it('los incrementos positivos no compensan en el peor caso', () => {
    const up = anUpgrade('strict-rules', { id: 'up', perLevel: 100 });
    const down1 = anUpgrade('strict-rules', { id: 'down', perLevel: -1 });
    expect(catalogOf(weapons(up, down1)).ok).toBe(true);
    const down = anUpgrade('strict-rules', {
      id: 'down',
      perLevel: -2,
      maxLevel: 3,
      prices: [1, 2, 3],
    });
    expect(failure(weapons(up, down)).message).toBe(outOfRange('linter.damage = 0 (down)'));
  });

  it.each([
    ['perLevel', { perLevel: 0 }, UPGRADE_STEP_MUST_NOT_BE_ZERO],
    ['maxLevel', { maxLevel: 0 }, UPGRADE_MAX_LEVEL_MUST_BE_INTEGER],
    ['maxLevel', { maxLevel: 2.5 }, UPGRADE_MAX_LEVEL_MUST_BE_INTEGER],
  ] as const)('Scenario: Valores inválidos (%s %o)', (field, patch, message) => {
    expect(failure(character(anUpgrade('guardrail', patch)))).toMatchObject({
      field: `upgrades.character.0.${field}`,
      message,
    });
  });

  it.each(['strict-rules', 'fast-ci'])('Scenario: Valores inválidos (perLevel 1,5 en %s)', (id) => {
    const e = failure(weapons(anUpgrade(id, { perLevel: 1.5 })));
    expect(e.field).toBe('upgrades.weapons.0.perLevel');
    expect(e.message).toContain(UPGRADE_STEP_MUST_BE_INTEGER);
    expect(e.message).toContain(id);
  });

  it('pulseCapacity sale del peor caso: Tests a 90 − 12 × 7 = 6 ticks deja ver ⌈8 / 6⌉ = 2', () => {
    const watch = anUpgrade('watch-mode', { maxLevel: 7, prices: [1, 1, 1, 1, 1, 1, 1] });
    const r = catalogOf(weapons(watch));
    const d = catalogOf(DEFAULT_UPGRADES);
    expect(r.ok && r.value.pulseCapacity).toBe(2);
    expect(d.ok && d.value.pulseCapacity).toBe(1);
  });
});

describe('UpgradeCatalog · estadísticas de personaje nuevas al máximo (0024)', () => {
  it.each([
    ['armor −1', anUpgrade('armor', { perLevel: -1 }), 'player.armor = -3 (armor)'],
    [
      'invulnerabilityTicks −10 × 3 sobre 30',
      anUpgrade('steady-nerves', { perLevel: -10, maxLevel: 3 }),
      'player.invulnerabilityTicks = 0 (steady-nerves)',
    ],
    [
      'regeneration −1',
      anUpgrade('regeneration', { perLevel: -1 }),
      'player.regeneration = -5 (regeneration)',
    ],
    [
      'goldBonusPercent −10',
      anUpgrade('prospector', { perLevel: -10 }),
      'player.goldBonusPercent = -50 (prospector)',
    ],
  ])('Scenario: Peor caso fuera de rango (%s)', (_name, upgrade, detail) => {
    const e = failure(character(upgrade));

    expect(e.field).toBe('upgrades.character.0.perLevel');
    expect(e.message).toBe(outOfRange(detail));
  });

  it('Scenario: Peor caso fuera de rango (xpBonusPercent con perLevel 2,5)', () => {
    const e = failure(character(anUpgrade('scholar', { perLevel: 2.5 })));

    expect(e.field).toBe('upgrades.character.0.perLevel');
    expect(e.message).toContain(UPGRADE_STEP_MUST_BE_INTEGER);
    expect(e.message).toContain('scholar');
    expect(e.message).toContain('xpBonusPercent');
  });

  it('Scenario: Límite exacto de la invulnerabilidad (−29 × 1 sobre 30)', () => {
    const nerves = anUpgrade('steady-nerves', { perLevel: -29, maxLevel: 1 });

    expect(catalogOf(character(nerves)).ok).toBe(true);
  });
});
