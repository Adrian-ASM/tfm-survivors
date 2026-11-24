import { describe, expect, it } from 'vitest';
import {
  GEM_RADIUS_MUST_BE_POSITIVE,
  MAGNET_SPEED_MUST_BE_POSITIVE,
  MAX_GEMS_MUST_BE_INTEGER,
} from '../../src/domain/progression/GemRules';
import {
  BASE_XP_MUST_BE_INTEGER,
  XP_GROWTH_MUST_BE_INTEGER,
} from '../../src/domain/progression/XpCurve';
import { buildRunRules } from '../../src/domain/run/RunConfig';
import {
  UPGRADE_ID_MUST_BE_UNIQUE,
  UPGRADE_MAX_LEVEL_MUST_BE_INTEGER,
  UPGRADE_STAT_INCOMPATIBLE,
  UPGRADE_STAT_OUT_OF_RANGE,
  UPGRADE_STEP_MUST_BE_INTEGER,
  UPGRADE_STEP_MUST_NOT_BE_ZERO,
  UPGRADE_UNKNOWN_WEAPON,
} from '../../src/domain/upgrade/UpgradeType';
import { loadRunConfig, parseRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { UPGRADES_REQUIRED, UPGRADE_TEXT_REQUIRED } from '../../src/infrastructure/content/schemas';
import { rawContent, type RawContent } from '../support/builders';

function failure(raw: RawContent): { field: string; message: string } {
  const r = parseRunConfig(raw);
  if (r.ok) throw new Error('se esperaba un error de contenido');
  return r.error;
}

/** Contenido crudo con la mejora `id` de la lista por defecto cambiada. */
function withUpgrade(id: string, patch: Record<string, unknown>): RawContent {
  const raw = rawContent();
  const u = raw.upgrades.upgrades.find((x) => x.id === id);
  if (!u) throw new Error(id);
  Object.assign(u, patch);
  return raw;
}

const indexOf = (id: string) => rawContent().upgrades.upgrades.findIndex((u) => u.id === id);

describe('Contenido de progresión (content/progression.json)', () => {
  it('Scenario: Contenido por defecto (gemRadius 5, magnetSpeed 360, maxGems 300) y curva 9/4 (0020)', () => {
    const r = loadRunConfig();
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.progression).toEqual({
      baseXp: 9,
      xpGrowth: 4,
      gemRadius: 5,
      magnetSpeed: 360,
      maxGems: 300,
    });
    expect(r.value.player.pickupRadius).toBe(128);
  });

  // Spec leveling (delta 0020): curva de calibración 9/4 (27/50 victorias del bot v3, 0 quietos).
  it('Scenario: Curva por defecto (baseXp 9, xpGrowth 4: xpToNext 9, 13, 17 y 205 en el 50)', () => {
    const r = loadRunConfig();
    expect(r.ok && [r.value.progression.baseXp, r.value.progression.xpGrowth]).toEqual([9, 4]);
    const rules = r.ok ? buildRunRules(r.value) : null;
    const curve = rules?.ok ? rules.value.curve : null;
    expect([1, 2, 3, 50].map((n) => curve?.toNext(n))).toEqual([9, 13, 17, 205]);
  });

  it('Scenario: Curva de escenario (baseXp 5, xpGrowth 5: xpToNext 5, 10, 15 y 250 en el 50)', () => {
    const raw = rawContent();
    raw.progression.baseXp = 5;
    raw.progression.xpGrowth = 5;
    const r = parseRunConfig(raw);
    const rules = r.ok ? buildRunRules(r.value) : null;
    const curve = rules?.ok ? rules.value.curve : null;
    expect([1, 2, 3, 50].map((n) => curve?.toNext(n))).toEqual([5, 10, 15, 250]);
  });

  it.each([
    ['gemRadius', 0, GEM_RADIUS_MUST_BE_POSITIVE],
    ['magnetSpeed', 0, MAGNET_SPEED_MUST_BE_POSITIVE],
    ['magnetSpeed', -1, MAGNET_SPEED_MUST_BE_POSITIVE],
    ['maxGems', 0, MAX_GEMS_MUST_BE_INTEGER],
  ] as const)('Scenario: Valores no positivos (%s %s)', (key, value, message) => {
    const raw = rawContent();
    raw.progression[key] = value;
    expect(failure(raw)).toEqual({ code: 'invalid-config', field: `progression.${key}`, message });
  });

  it('Scenario: Tope de gemas no entero (maxGems 12,5)', () => {
    const raw = rawContent();
    raw.progression.maxGems = 12.5;
    expect(failure(raw).field).toBe('progression.maxGems');
  });

  it('Scenario: Tope mínimo válido (maxGems 1)', () => {
    const raw = rawContent();
    raw.progression.maxGems = 1;
    expect(parseRunConfig(raw).ok).toBe(true);
  });

  it('Scenario: Campo desconocido o ausente (gemLifetime 600; sin magnetSpeed)', () => {
    const extra = rawContent();
    Object.assign(extra.progression, { gemLifetime: 600 });
    expect(failure(extra).message).toContain('gemLifetime');
    const missing = rawContent();
    Reflect.deleteProperty(missing.progression, 'magnetSpeed');
    expect(failure(missing).field).toBe('progression.magnetSpeed');
  });

  it.each([
    ['baseXp', 0, BASE_XP_MUST_BE_INTEGER],
    ['baseXp', 2.5, BASE_XP_MUST_BE_INTEGER],
    ['xpGrowth', -1, XP_GROWTH_MUST_BE_INTEGER],
    ['xpGrowth', 1.5, XP_GROWTH_MUST_BE_INTEGER],
  ] as const)('Scenario: Valores inválidos de la curva (%s %s)', (key, value, message) => {
    const raw = rawContent();
    raw.progression[key] = value;
    expect(failure(raw)).toEqual({ code: 'invalid-config', field: `progression.${key}`, message });
  });

  it('Scenario: Curva plana (baseXp 3, xpGrowth 0)', () => {
    const raw = rawContent();
    Object.assign(raw.progression, { baseXp: 3, xpGrowth: 0 });
    const r = parseRunConfig(raw);
    const rules = r.ok ? buildRunRules(r.value) : null;
    expect(rules?.ok && [1, 9].map((n) => rules.value.curve.toNext(n))).toEqual([3, 3]);
  });
});

describe('Catálogo de mejoras (content/upgrades.json)', () => {
  it('Scenario: Catálogo por defecto (9 mejoras, 6 de arma y 3 de jugador, maxLevel 5)', () => {
    const r = loadRunConfig();
    if (!r.ok) throw new Error(r.error.message);
    const list = r.value.upgrades.upgrades;
    expect(list.map((u) => u.id)).toEqual([
      'strict-rules',
      'fast-ci',
      'wide-analysis',
      'hard-asserts',
      'watch-mode',
      'coverage',
      'guardrail',
      'shortcuts',
      'context-window',
    ]);
    expect(list.filter((u) => u.target.kind === 'weapon')).toHaveLength(6);
    expect(list.every((u) => u.maxLevel === 5)).toBe(true);
    expect(list.map((u) => u.perLevel)).toEqual([3, -4, 60, 2, -12, 15, 20, 20, 32]);
    expect(r.value.weapons.weapons.map((w) => w.id)).toEqual(['linter', 'tests']);
  });

  it('Scenario: Identificador repetido o lista vacía', () => {
    const dup = withUpgrade('guardrail', { id: 'fast-ci' });
    expect(failure(dup).message).toContain(UPGRADE_ID_MUST_BE_UNIQUE);
    const empty = rawContent();
    (empty.upgrades as { upgrades: unknown[] }).upgrades = [];
    expect(failure(empty)).toMatchObject({
      field: 'upgrades.upgrades',
      message: UPGRADES_REQUIRED,
    });
  });

  it('Scenario: Arma inexistente (refactor)', () => {
    const raw = withUpgrade('strict-rules', { target: { kind: 'weapon', weapon: 'refactor' } });
    const e = failure(raw);
    expect(e.field).toBe(`upgrades.upgrades.${String(indexOf('strict-rules'))}.target.weapon`);
    expect(e.message).toContain(UPGRADE_UNKNOWN_WEAPON);
    expect(e.message).toContain('refactor');
  });

  it.each([
    ['coverage', 'range'],
    ['wide-analysis', 'radius'],
    ['strict-rules', 'pickupRadius'],
    ['guardrail', 'damage'],
  ])('Scenario: Estadística incompatible (%s con %s)', (id, stat) => {
    const e = failure(withUpgrade(id, { stat }));
    expect(e.field).toBe(`upgrades.upgrades.${String(indexOf(id))}.stat`);
    expect(e.message).toContain(UPGRADE_STAT_INCOMPATIBLE);
    expect(e.message).toContain(id);
  });

  it('Scenario: Nivel máximo que saca la cadencia de rango (fast-ci −6 × 5)', () => {
    const e = failure(withUpgrade('fast-ci', { perLevel: -6 }));
    expect(e.field).toBe(`upgrades.upgrades.${String(indexOf('fast-ci'))}.perLevel`);
    expect(e.message).toBe(`${UPGRADE_STAT_OUT_OF_RANGE}: linter.cooldownTicks = 0 (fast-ci)`);
  });

  it('Scenario: Límite exacto de la cadencia (fast-ci −29 × 1)', () => {
    expect(parseRunConfig(withUpgrade('fast-ci', { perLevel: -29, maxLevel: 1 })).ok).toBe(true);
  });

  it('Scenario: Suma de varias mejoras sobre la misma estadística (−4 × 4 dos veces)', () => {
    const raw = withUpgrade('fast-ci', { maxLevel: 4 });
    Object.assign(raw.upgrades.upgrades[0], {
      id: 'faster-ci',
      target: { kind: 'weapon', weapon: 'linter' },
      stat: 'cooldownTicks',
      perLevel: -4,
      maxLevel: 4,
    });
    const e = failure(raw);
    expect(e.message).toContain('cooldownTicks');
    expect(e.message).toContain(UPGRADE_STAT_OUT_OF_RANGE);
  });

  it.each([
    ['perLevel', { perLevel: 0 }, UPGRADE_STEP_MUST_NOT_BE_ZERO],
    ['maxLevel', { maxLevel: 0 }, UPGRADE_MAX_LEVEL_MUST_BE_INTEGER],
    ['maxLevel', { maxLevel: 2.5 }, UPGRADE_MAX_LEVEL_MUST_BE_INTEGER],
    ['name', { name: '  ' }, UPGRADE_TEXT_REQUIRED],
  ] as const)('Scenario: Valores inválidos (%s %o)', (field, patch, message) => {
    expect(failure(withUpgrade('guardrail', patch))).toMatchObject({
      field: `upgrades.upgrades.${String(indexOf('guardrail'))}.${field}`,
      message,
    });
  });

  it('Scenario: Valores inválidos (perLevel 1,5 en damage)', () => {
    const e = failure(withUpgrade('strict-rules', { perLevel: 1.5 }));
    expect(e.field).toBe('upgrades.upgrades.0.perLevel');
    expect(e.message).toContain(UPGRADE_STEP_MUST_BE_INTEGER);
  });

  it('Scenario: Valores inválidos (campo extra rarity)', () => {
    expect(failure(withUpgrade('guardrail', { rarity: 'common' })).message).toContain('rarity');
  });
});
