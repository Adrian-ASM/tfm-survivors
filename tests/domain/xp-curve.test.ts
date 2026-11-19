import { describe, expect, it } from 'vitest';
import {
  BASE_XP_MUST_BE_INTEGER,
  XP_GROWTH_MUST_BE_INTEGER,
  XpCurve,
} from '../../src/domain/progression/XpCurve';

function curve(baseXp: number, xpGrowth: number): XpCurve {
  const r = XpCurve.create({ baseXp, xpGrowth });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('XpCurve', () => {
  it('Scenario: Curva por defecto (xpToNext 5, 10, 15 y 250 en el nivel 50)', () => {
    const c = curve(5, 5);
    expect([c.toNext(1), c.toNext(2), c.toNext(3), c.toNext(50)]).toEqual([5, 10, 15, 250]);
  });

  it('Scenario: Curva plana (baseXp 3, xpGrowth 0)', () => {
    const c = curve(3, 0);
    expect([c.toNext(1), c.toNext(7), c.toNext(100)]).toEqual([3, 3, 3]);
  });

  it.each([0, 2.5, -1, Number.NaN])('Scenario: Valores inválidos (baseXp %s)', (baseXp) => {
    const r = XpCurve.create({ baseXp, xpGrowth: 5 });
    expect(r.ok ? null : r.error).toEqual({
      code: 'invalid-config',
      field: 'progression.baseXp',
      message: BASE_XP_MUST_BE_INTEGER,
    });
  });

  it.each([-1, 1.5, Number.NaN])('Scenario: Valores inválidos (xpGrowth %s)', (xpGrowth) => {
    const r = XpCurve.create({ baseXp: 5, xpGrowth });
    expect(r.ok ? null : r.error).toEqual({
      code: 'invalid-config',
      field: 'progression.xpGrowth',
      message: XP_GROWTH_MUST_BE_INTEGER,
    });
  });

  it('es inmutable', () => {
    const c = curve(5, 5);
    expect(() => {
      (c as unknown as { baseXp: number }).baseXp = 1;
    }).toThrow(TypeError);
  });
});
