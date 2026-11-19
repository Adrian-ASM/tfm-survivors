import { describe, expect, it } from 'vitest';
import { OFFER_SIZE, UpgradeBoard } from '../../src/domain/upgrade/UpgradeBoard';
import { ScriptedRandom, StubRandom } from '../support/random';
import { aCatalog, allMaxedExcept } from '../support/upgrades';

const offerIds = (b: UpgradeBoard) => b.offer.map((u) => u.id);

describe('UpgradeBoard · niveles y oferta', () => {
  it('Scenario: Ninguna adquirida al empezar (niveles 0, 9 disponibles, sin oferta)', () => {
    const b = new UpgradeBoard(aCatalog());
    expect(b.levels).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(b.isOpen).toBe(false);
    expect(b.offer).toEqual([]);
    expect(OFFER_SIZE).toBe(3);
  });

  it('abre 3 opciones distintas con Fisher–Yates parcial (3 valores de azar, orden extraído)', () => {
    const b = new UpgradeBoard(aCatalog());
    // m = 9: j0 = 0 + ⌊0,5·9⌋ = 4; j1 = 1 + ⌊0·8⌋ = 1; j2 = 2 + ⌊0,99·7⌋ = 8.
    const random = new ScriptedRandom([0.5, 0, 0.99]);
    expect(b.open(random)).toBe(true);
    expect(random.calls).toBe(3);
    expect(offerIds(b)).toEqual(['watch-mode', 'fast-ci', 'context-window']);
    expect(b.isOpen).toBe(true);
  });

  it('Scenario: Dos disponibles (guardrail y shortcuts): 2 opciones y 2 valores de azar', () => {
    const b = new UpgradeBoard(aCatalog(), allMaxedExcept({ guardrail: 4, shortcuts: 0 }));
    const random = new StubRandom(0.9);
    expect(b.open(random)).toBe(true);
    expect([...offerIds(b)].sort()).toEqual(['guardrail', 'shortcuts']);
    expect(random.calls).toBe(2);
  });

  it('Scenario: Una disponible (coverage)', () => {
    const b = new UpgradeBoard(aCatalog(), allMaxedExcept({ coverage: 2 }));
    expect(b.open(new StubRandom(0.3))).toBe(true);
    expect(offerIds(b)).toEqual(['coverage']);
  });

  it('Scenario: Mejora en su nivel máximo (fast-ci a 5 nunca sale) y ninguna disponible', () => {
    const levels = allMaxedExcept({});
    const none = new UpgradeBoard(aCatalog(), levels);
    const random = new StubRandom(0.5);
    expect(none.open(random)).toBe(false);
    expect(random.calls).toBe(0);
    expect(none.isOpen).toBe(false);
    for (const v of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
      const b = new UpgradeBoard(
        aCatalog(),
        levels.map((l, i) => (i === 1 ? l : 0)),
      );
      b.open(new StubRandom(v));
      expect(offerIds(b)).not.toContain('fast-ci');
      expect(b.levelOf(1)).toBe(5);
    }
  });
});

describe('UpgradeBoard.pick', () => {
  function opened(levels?: number[]): UpgradeBoard {
    const b = new UpgradeBoard(aCatalog(), levels);
    b.open(new ScriptedRandom([0.5, 0, 0.99]));
    return b;
  }

  it('Scenario: Elección válida (índice 1: sube solo esa mejora y cierra la oferta)', () => {
    const b = opened();
    const r = b.pick(1);
    expect(r.ok && r.value.id).toBe('fast-ci');
    expect(b.levels).toEqual([0, 1, 0, 0, 0, 0, 0, 0, 0]);
    expect(b.isOpen).toBe(false);
    expect(b.offer).toEqual([]);
  });

  it.each([3, -1, 1.5, Number.NaN])('Scenario: Índice fuera de rango (%s con 3 opciones)', (i) => {
    const b = opened();
    expect(b.pick(i)).toEqual({
      ok: false,
      error: { code: 'choice-out-of-range', index: i, size: 3 },
    });
    expect(b.levels).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(offerIds(b)).toEqual(['watch-mode', 'fast-ci', 'context-window']);
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
