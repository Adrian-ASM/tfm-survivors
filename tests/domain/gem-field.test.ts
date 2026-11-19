import { describe, expect, it } from 'vitest';
import { GemField } from '../../src/domain/progression/GemField';
import { GemRules } from '../../src/domain/progression/GemRules';

function field(maxGems = 300): GemField {
  const r = GemRules.create({ gemRadius: 5, magnetSpeed: 360, maxGems });
  if (!r.ok) throw new Error(r.error.message);
  return new GemField(r.value);
}

const ids = (f: GemField) => f.gems.map((g) => g.id);
const values = (f: GemField) => f.gems.map((g) => g.value);

describe('GemField.drop', () => {
  it('crea gemas en orden con ids desde 0, en su posición y sin atraer', () => {
    const f = field();
    f.drop(780, 270, 1);
    f.drop(100, 50, 4);
    expect(f.gems.map((g) => [g.id, g.x, g.y, g.value, g.attracted])).toEqual([
      [0, 780, 270, 1, false],
      [1, 100, 50, 4, false],
    ]);
  });

  it('Scenario: Tope lleno (300 gemas: la XP se suma a la más antigua)', () => {
    const f = field(300);
    for (let i = 0; i < 300; i++) f.drop(10, 10, 1);
    const before = ids(f);
    f.drop(900, 500, 1);
    expect(ids(f)).toEqual(before);
    expect(f.gems[0]?.value).toBe(2);
    expect(f.gems[299]?.value).toBe(1);
  });

  it('Scenario: Varias bajas con el tope lleno (maxGems 1: 1 + 1 + 2 + 4)', () => {
    const f = field(1);
    f.drop(10, 10, 1);
    f.drop(800, 10, 1);
    f.drop(800, 20, 2);
    f.drop(800, 30, 4);
    expect(ids(f)).toEqual([0]);
    expect(values(f)).toEqual([8]);
  });
});
