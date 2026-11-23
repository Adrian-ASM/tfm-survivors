import { describe, expect, it } from 'vitest';
import { GemField } from '../../src/domain/progression/GemField';
import { GemRules } from '../../src/domain/progression/GemRules';
import { GameMap } from '../../src/domain/map/GameMap';
import { mapRules } from '../support/mapLayouts';

function field(maxGems = 300): GemField {
  const r = GemRules.create({ gemRadius: 5, magnetSpeed: 360, maxGems });
  if (!r.ok) throw new Error(r.error.message);
  return new GemField(r.value, GameMap.open(mapRules()));
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

const PR = 16;
const PICKUP = 64;
const pos = (f: GemField) => f.gems.map((g) => [g.x, g.y]);

describe('GemField.step · imán', () => {
  it('Scenario: Límite exacto del radio (distancia 64: atraída y 6 px)', () => {
    const f = field();
    f.drop(544, 270, 1);
    f.step(480, 270, PR, PICKUP);
    expect(pos(f)).toEqual([[538, 270]]);
    expect(f.gems[0]?.attracted).toBe(true);
  });

  it('Scenario: Recorrido hasta la recogida (ticks 1 a 7; en el 7, en (502, 270))', () => {
    const f = field();
    f.drop(544, 270, 1);
    const xs: number[] = [];
    for (let i = 0; i < 7; i++) {
      f.step(480, 270, PR, PICKUP);
      xs.push(f.gems[0]?.x ?? Number.NaN);
    }
    expect(xs.map((x) => Math.round(x * 1000) / 1000)).toEqual([538, 532, 526, 520, 514, 508, 502]);
  });

  it('Scenario: Una gema atraída no se suelta (el jugador se aleja a 3,333 px/tick)', () => {
    const f = field();
    let px = 400;
    f.drop(px - 62, 270, 1, true);
    const distances: number[] = [];
    for (let i = 0; i < 5; i++) {
      px += 200 / 60;
      f.step(px, 270, PR, PICKUP);
      distances.push(px - (f.gems[0]?.x ?? Number.NaN));
    }
    expect(distances[0]).toBeCloseTo(59.333, 3);
    for (let i = 1; i < distances.length; i++) {
      expect((distances[i - 1] ?? 0) - (distances[i] ?? 0)).toBeCloseTo(2.667, 3);
    }
  });

  it('Scenario: Gema fuera del radio (distancia 65 durante 36.000 ticks)', () => {
    const f = field();
    f.drop(545, 270, 1);
    let xp = 0;
    for (let i = 0; i < 36_000; i++) xp += f.step(480, 270, PR, PICKUP);
    expect(pos(f)).toEqual([[545, 270]]);
    expect(f.gems[0]?.attracted).toBe(false);
    expect(xp).toBe(0);
  });
});

describe('GemField.step · recogida', () => {
  it('Scenario: Recogida de una gema (valor 1 a 20 px)', () => {
    const f = field();
    f.drop(500, 270, 1);
    expect(f.step(480, 270, PR, PICKUP)).toBe(1);
    expect(f.gems).toHaveLength(0);
  });

  it('Scenario: Recorrido hasta la recogida (se recoge en el tick 8)', () => {
    const f = field();
    f.drop(544, 270, 1);
    const xp: number[] = [];
    for (let i = 0; i < 8; i++) xp.push(f.step(480, 270, PR, PICKUP));
    expect(xp).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(f.gems).toHaveLength(0);
  });

  it('Scenario: Tangencia tras el imán no es recogida (queda a 21 = 16 + 5)', () => {
    const f = field();
    f.drop(507, 270, 1, true);
    expect(f.step(480, 270, PR, PICKUP)).toBe(0);
    expect(pos(f)).toEqual([[501, 270]]);
    expect(f.step(480, 270, PR, PICKUP)).toBe(1);
  });

  it('Scenario: No sobrepasa al jugador (distancia 3: se recoge en ese tick)', () => {
    const f = field();
    f.drop(483, 270, 1);
    expect(f.step(480, 270, PR, PICKUP)).toBe(1);
  });

  it('Scenario: Varias gemas en el mismo tick (4 de valor 1 en el jugador)', () => {
    const f = field();
    for (let i = 0; i < 4; i++) f.drop(480, 270, 1);
    expect(f.step(480, 270, PR, PICKUP)).toBe(4);
    expect(f.gems).toHaveLength(0);
  });

  it('Scenario: Plaza liberada por una recogida (maxGems 1: nueva y distinta de g1)', () => {
    const f = field(1);
    f.drop(480, 270, 1);
    const g1 = f.gems[0];
    f.step(480, 270, PR, PICKUP);
    f.drop(10, 10, 1);
    expect(ids(f)).toEqual([1]);
    expect(f.gems[0]).toBe(g1);
  });

  it('Scenario: Gemas en el snapshot (g2 se recoge y se crea g4: g1, g3, g4)', () => {
    const f = field();
    f.drop(10, 10, 1);
    f.drop(480, 270, 1);
    f.drop(900, 500, 1);
    f.step(480, 270, PR, PICKUP);
    f.drop(10, 500, 1);
    expect(ids(f)).toEqual([0, 2, 3]);
  });
});
