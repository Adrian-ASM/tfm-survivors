import { describe, expect, it } from 'vitest';
import type { ProgressionSnapshot } from '../../src/domain/run/RunSnapshot';
import { XpBar, type BarSprite, type LabelSprite } from '../../src/infrastructure/phaser/XpBar';
import { xpBarFill } from '../../src/infrastructure/phaser/xpBarFill';

class FakeBar implements BarSprite {
  width = -1;
  height = -1;
  resizes = 0;
  setSize(width: number, height: number): this {
    this.width = width;
    this.height = height;
    this.resizes += 1;
    return this;
  }
}

class FakeLabel implements LabelSprite {
  text = '';
  writes = 0;
  setText(text: string): this {
    this.text = text;
    this.writes += 1;
    return this;
  }
}

const progression = (level: number, xp: number, xpToNext: number): ProgressionSnapshot => ({
  level,
  xp,
  xpToNext,
  pendingLevelUps: 0,
});

function bar() {
  const fill = new FakeBar();
  const label = new FakeLabel();
  return { fill, label, xpBar: new XpBar(fill, label, 200, 8) };
}

describe('xpBarFill', () => {
  it('es XP / xpToNext, recortado a [0, 1]', () => {
    expect(xpBarFill(0, 5)).toBe(0);
    expect(xpBarFill(3, 10)).toBeCloseTo(0.3, 3);
    expect(xpBarFill(12, 10)).toBe(1);
    expect(xpBarFill(-1, 10)).toBe(0);
    expect(xpBarFill(1, 0)).toBe(0);
  });
});

describe('XpBar', () => {
  it('Scenario: Barra vacía al empezar (relleno 0 y nivel 1)', () => {
    const { fill, label, xpBar } = bar();
    xpBar.sync(progression(1, 0, 5));
    expect([fill.width, fill.height, label.text]).toEqual([0, 8, 'Nv 1']);
  });

  it('Scenario: Relleno parcial (nivel 2, XP 3 de 10: relleno 0,3)', () => {
    const { fill, label, xpBar } = bar();
    xpBar.sync(progression(2, 3, 10));
    expect(fill.width / 200).toBeCloseTo(0.3, 3);
    expect(label.text).toBe('Nv 2');
  });

  it('Scenario: Tras subir de nivel (de nivel 1 con XP 4 a nivel 2 con XP 0)', () => {
    const { fill, label, xpBar } = bar();
    xpBar.sync(progression(1, 4, 5));
    xpBar.sync(progression(2, 0, 10));
    expect([fill.width, label.text]).toEqual([0, 'Nv 2']);
  });

  it('solo repinta si cambian los valores', () => {
    const { fill, label, xpBar } = bar();
    xpBar.sync(progression(1, 2, 5));
    xpBar.sync(progression(1, 2, 5));
    xpBar.sync(progression(1, 2, 5));
    expect([fill.resizes, label.writes]).toEqual([1, 1]);
  });
});
