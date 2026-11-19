import { describe, expect, it } from 'vitest';
import { Arena } from '../../src/domain/arena/Arena';
import type { DomainError, Result } from '../../src/domain/shared/Result';
import { UpgradeCatalog } from '../../src/domain/upgrade/UpgradeCatalog';
import {
  UPGRADE_ID_MUST_BE_UNIQUE,
  UPGRADE_MAX_LEVEL_MUST_BE_INTEGER,
  UPGRADE_STAT_OUT_OF_RANGE,
  UPGRADE_STEP_MUST_BE_INTEGER,
  UPGRADE_STEP_MUST_NOT_BE_ZERO,
  UPGRADE_STAT_INCOMPATIBLE,
  UPGRADE_UNKNOWN_WEAPON,
  type UpgradeTypeConfig,
} from '../../src/domain/upgrade/UpgradeType';
import { WeaponLoadout } from '../../src/domain/weapon/WeaponLoadout';
import { DEFAULT_UPGRADE_LIST, DEFAULT_WEAPONS, aRunConfig, anUpgrade } from '../support/builders';

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

function catalogOf(list: readonly UpgradeTypeConfig[]): Result<UpgradeCatalog, DomainError> {
  return UpgradeCatalog.create(list, loadout(), aRunConfig().player, arena());
}

function failure(list: readonly UpgradeTypeConfig[]): DomainError {
  const r = catalogOf(list);
  if (r.ok) throw new Error('se esperaba un error');
  return r.error;
}

describe('UpgradeCatalog · reglas cruzadas', () => {
  it('acepta el catálogo por defecto en su orden, y también un catálogo vacío', () => {
    const r = catalogOf(DEFAULT_UPGRADE_LIST);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.upgrades.map((u) => u.id)).toEqual(DEFAULT_UPGRADE_LIST.map((u) => u.id));
    expect(catalogOf([]).ok).toBe(true);
  });

  it('Scenario: Identificador repetido o lista vacía (dos fast-ci)', () => {
    const e = failure([anUpgrade('fast-ci'), anUpgrade('guardrail'), anUpgrade('fast-ci')]);
    expect(e.field).toBe('upgrades.upgrades.2.id');
    expect(e.message).toContain(UPGRADE_ID_MUST_BE_UNIQUE);
    expect(e.message).toContain('fast-ci');
  });

  it('Scenario: Arma inexistente (refactor)', () => {
    const e = failure([
      anUpgrade('strict-rules', { target: { kind: 'weapon', weapon: 'refactor' } }),
    ]);
    expect(e.field).toBe('upgrades.upgrades.0.target.weapon');
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
    ['damage para el jugador', anUpgrade('guardrail', { id: 'x-damage', stat: 'damage' })],
  ])('Scenario: Estadística incompatible (%s)', (_name, upgrade) => {
    const e = failure([anUpgrade('guardrail'), upgrade]);
    expect(e.field).toBe('upgrades.upgrades.1.stat');
    expect(e.message).toContain(UPGRADE_STAT_INCOMPATIBLE);
    expect(e.message).toContain(upgrade.id);
  });
});

const outOfRange = (detail: string) => `${UPGRADE_STAT_OUT_OF_RANGE}: ${detail}`;

describe('UpgradeCatalog · rango con las mejoras al máximo (build de peor caso)', () => {
  it('Scenario: Nivel máximo que saca la cadencia de rango (fast-ci −6 × 5 sobre 30)', () => {
    const e = failure([anUpgrade('strict-rules'), anUpgrade('fast-ci', { perLevel: -6 })]);
    expect(e).toEqual({
      code: 'invalid-config',
      field: 'upgrades.upgrades.1.perLevel',
      message: outOfRange('linter.cooldownTicks = 0 (fast-ci)'),
    });
  });

  it('Scenario: Límite exacto de la cadencia (fast-ci −29 × 1 = 1)', () => {
    expect(catalogOf([anUpgrade('fast-ci', { perLevel: -29, maxLevel: 1 })]).ok).toBe(true);
  });

  it('Scenario: Suma de varias mejoras sobre la misma estadística (−4 × 4 dos veces)', () => {
    const a = anUpgrade('fast-ci', { maxLevel: 4 });
    const b = anUpgrade('fast-ci', { id: 'faster-ci', maxLevel: 4 });
    const e = failure([anUpgrade('guardrail'), a, b]);
    expect(e.field).toBe('upgrades.upgrades.1.perLevel');
    expect(e.message).toBe(outOfRange('linter.cooldownTicks = -2 (fast-ci, faster-ci)'));
  });

  it('una estadística del jugador que sale de rango nombra al jugador y la mejora', () => {
    const e = failure([anUpgrade('guardrail', { perLevel: -20 })]);
    expect(e.field).toBe('upgrades.upgrades.0.perLevel');
    expect(e.message).toBe(outOfRange('player.maxHealth = 0 (guardrail)'));
  });

  it('una distancia del criterio que sale de rango (range 400 − 80 × 5)', () => {
    const e = failure([anUpgrade('wide-analysis', { perLevel: -80 })]);
    expect(e.message).toBe(outOfRange('linter.range = 0 (wide-analysis)'));
  });

  it('los incrementos positivos no compensan en el peor caso', () => {
    const up = anUpgrade('strict-rules', { id: 'up', perLevel: 100 });
    expect(catalogOf([up, anUpgrade('strict-rules', { id: 'down', perLevel: -1 })]).ok).toBe(true);
    const down = anUpgrade('strict-rules', { id: 'down', perLevel: -2, maxLevel: 3 });
    expect(failure([up, down]).message).toBe(outOfRange('linter.damage = 0 (down)'));
  });

  it.each([
    ['perLevel', { perLevel: 0 }, UPGRADE_STEP_MUST_NOT_BE_ZERO],
    ['maxLevel', { maxLevel: 0 }, UPGRADE_MAX_LEVEL_MUST_BE_INTEGER],
    ['maxLevel', { maxLevel: 2.5 }, UPGRADE_MAX_LEVEL_MUST_BE_INTEGER],
  ] as const)('Scenario: Valores inválidos (%s %o)', (field, patch, message) => {
    expect(failure([anUpgrade('guardrail', patch)])).toMatchObject({
      field: `upgrades.upgrades.0.${field}`,
      message,
    });
  });

  it.each(['strict-rules', 'fast-ci'])('Scenario: Valores inválidos (perLevel 1,5 en %s)', (id) => {
    const e = failure([anUpgrade(id, { perLevel: 1.5 })]);
    expect(e.field).toBe('upgrades.upgrades.0.perLevel');
    expect(e.message).toContain(UPGRADE_STEP_MUST_BE_INTEGER);
    expect(e.message).toContain(id);
  });

  it('pulseCapacity sale del peor caso: Tests a 90 − 12 × 7 = 6 ticks deja ver ⌈8 / 6⌉ = 2', () => {
    const r = catalogOf([anUpgrade('watch-mode', { maxLevel: 7 })]);
    const d = catalogOf(DEFAULT_UPGRADE_LIST);
    expect(r.ok && r.value.pulseCapacity).toBe(2);
    expect(d.ok && d.value.pulseCapacity).toBe(1);
  });
});
