import { describe, expect, it } from 'vitest';
import { Experience } from '../../src/domain/progression/Experience';
import { XpCurve } from '../../src/domain/progression/XpCurve';

function defaultCurve(): XpCurve {
  const r = XpCurve.create({ baseXp: 5, xpGrowth: 5 });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const state = (e: Experience) => ({
  level: e.level,
  xp: e.xp,
  xpToNext: e.xpToNext,
  pending: e.pendingLevelUps,
});

describe('Experience', () => {
  it('empieza en nivel 1, XP 0, xpToNext 5 y sin subidas pendientes', () => {
    expect(state(new Experience(defaultCurve()))).toEqual({
      level: 1,
      xp: 0,
      xpToNext: 5,
      pending: 0,
    });
  });

  it('Scenario: Por debajo del umbral (4 XP en nivel 1)', () => {
    const e = new Experience(defaultCurve());
    e.gain(1);
    e.gain(3);
    expect(state(e)).toEqual({ level: 1, xp: 4, xpToNext: 5, pending: 0 });
  });

  it('Scenario: Umbral exacto (XP 4 + 1)', () => {
    const e = new Experience(defaultCurve(), 1, 4);
    e.gain(1);
    expect(state(e)).toEqual({ level: 2, xp: 0, xpToNext: 10, pending: 1 });
  });

  it('Scenario: Arrastre del sobrante (XP 4 + 4)', () => {
    const e = new Experience(defaultCurve(), 1, 4);
    e.gain(4);
    expect(state(e)).toEqual({ level: 2, xp: 3, xpToNext: 10, pending: 1 });
  });

  it('Scenario: Una gema que da dos niveles (valor 16)', () => {
    const e = new Experience(defaultCurve());
    e.gain(16);
    expect(state(e)).toEqual({ level: 3, xp: 1, xpToNext: 15, pending: 2 });
  });

  it('Scenario: Varias gemas que dan varios niveles (XP 4 + 12)', () => {
    const e = new Experience(defaultCurve(), 1, 4);
    e.gain(12);
    expect(state(e)).toEqual({ level: 3, xp: 1, xpToNext: 15, pending: 2 });
  });

  it('Scenario: Nivel 50 (nivel 49 + 245 XP)', () => {
    const e = new Experience(defaultCurve(), 49, 0);
    e.gain(245);
    expect(state(e)).toEqual({ level: 50, xp: 0, xpToNext: 250, pending: 1 });
  });

  it('resolveOne resta una subida pendiente y clearPending las descarta, sin tocar nivel ni XP', () => {
    const e = new Experience(defaultCurve());
    e.gain(16);
    e.resolveOne();
    expect(state(e)).toEqual({ level: 3, xp: 1, xpToNext: 15, pending: 1 });
    e.clearPending();
    expect(state(e)).toEqual({ level: 3, xp: 1, xpToNext: 15, pending: 0 });
    e.resolveOne();
    expect(e.pendingLevelUps).toBe(0);
  });
});
