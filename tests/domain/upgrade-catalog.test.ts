import { describe, expect, it } from 'vitest';
import type { DomainError, Result } from '../../src/domain/shared/Result';
import { UpgradeCatalog } from '../../src/domain/upgrade/UpgradeCatalog';
import {
  UPGRADE_ID_MUST_BE_UNIQUE,
  UPGRADE_STAT_INCOMPATIBLE,
  UPGRADE_UNKNOWN_WEAPON,
  type UpgradeTypeConfig,
} from '../../src/domain/upgrade/UpgradeType';
import { WeaponLoadout } from '../../src/domain/weapon/WeaponLoadout';
import { DEFAULT_UPGRADE_LIST, DEFAULT_WEAPONS, anUpgrade } from '../support/builders';

function loadout(): WeaponLoadout {
  const r = WeaponLoadout.create(DEFAULT_WEAPONS);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

function catalogOf(list: readonly UpgradeTypeConfig[]): Result<UpgradeCatalog, DomainError> {
  return UpgradeCatalog.create(list, loadout());
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
