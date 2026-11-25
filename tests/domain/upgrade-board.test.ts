import { describe, expect, it } from 'vitest';
import { OFFER_SIZE, UpgradeBoard } from '../../src/domain/upgrade/UpgradeBoard';
import { ScriptedRandom, StubRandom } from '../support/random';
import { DEFAULT_UPGRADES } from '../support/builders';
import { aCatalog, allMaxedExcept, levelsOf } from '../support/upgrades';

const offerIds = (b: UpgradeBoard) => b.offer.map((u) => u.id);
/** Niveles con las 9 de personaje al máximo salvo las dadas; las de arma, a 0. */
const characterMaxed = (byId: Record<string, number> = {}) =>
  levelsOf({
    ...Object.fromEntries(DEFAULT_UPGRADES.character.map((u) => [u.id, u.maxLevel])),
    ...byId,
  });

// Índices del catálogo por defecto (0024): personaje 0..8 (guardrail, shortcuts, context-window,
// regeneration, armor, steady-nerves, scholar, prospector, hunter) y arma 9..14 (strict-rules,
// fast-ci, wide-analysis, hard-asserts, watch-mode, coverage).
const FAST_CI = 10;

describe('UpgradeBoard · niveles y oferta', () => {
  it('Scenario: Ninguna adquirida al empezar (15 niveles a 0, sin oferta)', () => {
    const b = new UpgradeBoard(aCatalog());
    expect(b.levels).toEqual(Array.from({ length: 15 }, () => 0));
    expect(b.isOpen).toBe(false);
    expect(b.offer).toEqual([]);
    expect(OFFER_SIZE).toBe(3);
  });

  it('Scenario: Ninguna adquirida al empezar (sortea entre las 9 de personaje: m = 9)', () => {
    const b = new UpgradeBoard(aCatalog());
    // m = 9: j0 = ⌊0,5·9⌋ = 4; j1 = 1 + ⌊0·8⌋ = 1; j2 = 2 + ⌊0,99·7⌋ = 8 (con m = 15 sería 14).
    const random = new ScriptedRandom([0.5, 0, 0.99]);
    expect(b.open(random)).toBe(true);
    expect(random.calls).toBe(3);
    expect(offerIds(b)).toEqual(['armor', 'shortcuts', 'hunter']);
    expect(b.isOpen).toBe(true);
  });

  it('Scenario: Dos disponibles (guardrail y shortcuts): 2 opciones y 2 valores de azar', () => {
    const b = new UpgradeBoard(aCatalog(), allMaxedExcept({ guardrail: 4, shortcuts: 0 }));
    const random = new StubRandom(0.9);
    expect(b.open(random)).toBe(true);
    expect([...offerIds(b)].sort()).toEqual(['guardrail', 'shortcuts']);
    expect(random.calls).toBe(2);
  });

  it('Scenario: Una disponible (context-window, con las de arma a nivel 0)', () => {
    const b = new UpgradeBoard(aCatalog(), characterMaxed({ 'context-window': 2 }));
    expect(b.open(new StubRandom(0.3))).toBe(true);
    expect(offerIds(b)).toEqual(['context-window']);
  });

  it('Scenario: Mejoras de arma fuera de la oferta (personaje al máximo y armas a 0: sin oferta)', () => {
    const b = new UpgradeBoard(aCatalog(), characterMaxed());
    const random = new StubRandom(0.5);
    expect(b.open(random)).toBe(false);
    expect(random.calls).toBe(0);
    for (const v of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
      const open = new UpgradeBoard(aCatalog());
      open.open(new StubRandom(v));
      expect(open.offer.every((u) => u.source === 'level')).toBe(true);
    }
  });

  it('Scenario: Mejora en su nivel máximo (shortcuts a 5 nunca sale) y ninguna disponible', () => {
    const none = new UpgradeBoard(aCatalog(), allMaxedExcept({}));
    const random = new StubRandom(0.5);
    expect(none.open(random)).toBe(false);
    expect(random.calls).toBe(0);
    expect(none.isOpen).toBe(false);
    for (const v of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
      const b = new UpgradeBoard(aCatalog(), levelsOf({ shortcuts: 5 }));
      b.open(new StubRandom(v));
      expect(offerIds(b)).not.toContain('shortcuts');
      expect(b.levelOf(1)).toBe(5);
    }
  });
});

describe('UpgradeBoard.raise (compra, 0024)', () => {
  it('sube 1 nivel la mejora de arma dada sin consumir azar ni abrir oferta', () => {
    const b = new UpgradeBoard(aCatalog());

    b.raise(FAST_CI);
    b.raise(FAST_CI);

    expect(b.levelOf(FAST_CI)).toBe(2);
    expect(b.isOpen).toBe(false);
    expect(b.levels.filter((l) => l > 0)).toEqual([2]);
  });
});

describe('UpgradeBoard.pick', () => {
  function opened(levels?: number[]): UpgradeBoard {
    const b = new UpgradeBoard(aCatalog(), levels);
    b.open(new ScriptedRandom([0.5, 0, 0.99]));
    return b;
  }

  it('Scenario: Elección válida (shortcuts, guardrail y armor; índice 1 sube guardrail)', () => {
    const b = new UpgradeBoard(aCatalog());
    // j0 = ⌊0,15·9⌋ = 1 (shortcuts); j1 = 1 + ⌊0·8⌋ = 1 (guardrail, tras el intercambio);
    // j2 = 2 + ⌊0,3·7⌋ = 4 (armor).
    b.open(new ScriptedRandom([0.15, 0, 0.3]));
    expect(offerIds(b)).toEqual(['shortcuts', 'guardrail', 'armor']);

    const r = b.pick(1);

    expect(r.ok && r.value.id).toBe('guardrail');
    expect(b.levelOf(0)).toBe(1);
    expect([b.levelOf(1), b.levelOf(4)]).toEqual([0, 0]);
    expect(b.isOpen).toBe(false);
    expect(b.offer).toEqual([]);
  });

  it.each([3, -1, 1.5, Number.NaN])('Scenario: Índice fuera de rango (%s con 3 opciones)', (i) => {
    const b = opened();
    expect(b.pick(i)).toEqual({
      ok: false,
      error: { code: 'choice-out-of-range', index: i, size: 3 },
    });
    expect(b.levels.every((l) => l === 0)).toBe(true);
    expect(offerIds(b)).toEqual(['armor', 'shortcuts', 'hunter']);
    expect(b.pick(0).ok).toBe(true);
  });

  it('Scenario: Índice fuera de rango (2 con 2 opciones)', () => {
    const b = new UpgradeBoard(aCatalog(), allMaxedExcept({ guardrail: 0, shortcuts: 0 }));
    b.open(new StubRandom(0));
    expect(b.pick(2)).toEqual({
      ok: false,
      error: { code: 'choice-out-of-range', index: 2, size: 2 },
    });
    expect(b.isOpen).toBe(true);
  });

  it('sin oferta abierta devuelve no-offer', () => {
    expect(new UpgradeBoard(aCatalog()).pick(0)).toEqual({
      ok: false,
      error: { code: 'no-offer' },
    });
  });
});
