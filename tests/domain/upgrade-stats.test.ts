import { describe, expect, it } from 'vitest';
import { Arena } from '../../src/domain/arena/Arena';
import { UpgradeCatalog } from '../../src/domain/upgrade/UpgradeCatalog';
import { upgradedPlayer, upgradedWeapon } from '../../src/domain/upgrade/upgradeStats';
import { WeaponLoadout } from '../../src/domain/weapon/WeaponLoadout';
import {
  DEFAULT_UPGRADE_LIST,
  DEFAULT_WEAPONS,
  LINTER,
  TESTS,
  aRunConfig,
} from '../support/builders';

function catalog(): UpgradeCatalog {
  const arena = Arena.create(960, 540);
  const loadout = WeaponLoadout.create(DEFAULT_WEAPONS);
  if (!arena.ok || !loadout.ok) throw new Error('contenido inválido');
  const r = UpgradeCatalog.create(
    DEFAULT_UPGRADE_LIST,
    loadout.value,
    aRunConfig().player,
    arena.value,
  );
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** Niveles por id sobre el catálogo por defecto (el resto a 0). */
function levels(byId: Record<string, number>): number[] {
  return DEFAULT_UPGRADE_LIST.map((u) => byId[u.id] ?? 0);
}

describe('upgradedWeapon / upgradedPlayer', () => {
  it('Scenario: Más daño del Linter (strict-rules 1 → damage 9)', () => {
    expect(upgradedWeapon(LINTER, catalog(), levels({ 'strict-rules': 1 })).damage).toBe(9);
  });

  it('Scenario: Mejoras acumuladas (strict-rules 5 → damage 21) y cadencia (fast-ci 1 → 26)', () => {
    const w = upgradedWeapon(LINTER, catalog(), levels({ 'strict-rules': 5, 'fast-ci': 1 }));
    expect([w.damage, w.cooldownTicks]).toEqual([21, 26]);
  });

  it('Scenario: Más alcance (wide-analysis 1 → range 460)', () => {
    const w = upgradedWeapon(LINTER, catalog(), levels({ 'wide-analysis': 1 }));
    expect(w.targeting).toEqual({ mode: 'nearest-in-range', range: 460 });
  });

  it('Scenario: Más radio del pulso (coverage 1 → radius 105); Tests sin tocar el Linter', () => {
    const lv = levels({ coverage: 1, 'hard-asserts': 1, 'watch-mode': 1 });
    const w = upgradedWeapon(TESTS, catalog(), lv);
    expect(w.targeting).toEqual({ mode: 'any-in-radius', radius: 105 });
    expect([w.damage, w.cooldownTicks]).toEqual([6, 78]);
    expect(upgradedWeapon(LINTER, catalog(), lv)).toEqual(LINTER);
  });

  it('Scenario: Más velocidad (220) y Más radio de recogida (96); vida máxima 200 al máximo', () => {
    const lv = levels({ shortcuts: 1, 'context-window': 1, guardrail: 5 });
    expect(upgradedPlayer(aRunConfig().player, catalog(), lv)).toMatchObject({
      speed: 220,
      pickupRadius: 96,
      maxHealth: 200,
      radius: 16,
      invulnerabilityTicks: 30,
    });
  });

  it('El contenido base no cambia (se deriva siempre desde la base)', () => {
    const base = structuredClone(LINTER);
    upgradedWeapon(base, catalog(), levels({ 'strict-rules': 3 }));
    expect(base).toEqual(LINTER);
    expect(upgradedWeapon(LINTER, catalog(), levels({})).damage).toBe(6);
  });
});
