import { describe, expect, it } from 'vitest';
import { PickupField, PickupGain } from '../../src/domain/pickup/PickupField';
import type { PickupKind } from '../../src/domain/pickup/PickupKind';
import { PickupRules } from '../../src/domain/pickup/PickupRules';
import { GameMap } from '../../src/domain/map/GameMap';
import { mapRules, mapWith } from '../support/mapLayouts';

interface Topes {
  maxGems?: number;
  maxGold?: number;
  maxWood?: number;
}

function field(topes: Topes = {}, map = GameMap.open(mapRules())): PickupField {
  const r = PickupRules.create({
    gemRadius: 5,
    magnetSpeed: 360,
    maxGems: topes.maxGems ?? 300,
    maxGold: topes.maxGold ?? 32,
    maxWood: topes.maxWood ?? 64,
  });
  if (!r.ok) throw new Error(r.error.message);
  return new PickupField(r.value, map);
}

const PR = 16;
const PICKUP = 64;
const gain = new PickupGain();
/** Un paso del campo con el jugador en (px, py); devuelve lo recogido por tipo. */
const step = (f: PickupField, px = 480, py = 270, reach = PICKUP) => {
  f.step(px, py, PR, reach, gain);
  return { xp: gain.xp, gold: gain.gold, wood: gain.wood };
};
const xpOf = (f: PickupField, px = 480, py = 270) => step(f, px, py).xp;

const of = (f: PickupField, kind: PickupKind) => f.pickups.filter((p) => p.kind === kind);
const ids = (f: PickupField, kind: PickupKind = 'xp') => of(f, kind).map((g) => g.id);
const values = (f: PickupField, kind: PickupKind = 'xp') => of(f, kind).map((g) => g.value);
const pos = (f: PickupField) => f.pickups.map((g) => [g.x, g.y]);

describe('PickupField.drop', () => {
  it('crea recogibles en orden con ids desde 0, en su posición, sin atraer y con su tipo', () => {
    const f = field();
    f.drop('xp', 780, 270, 1);
    f.drop('wood', 100, 50, 4);
    f.drop('gold', 200, 60, 9);
    expect(f.pickups.map((g) => [g.id, g.kind, g.x, g.y, g.value, g.attracted])).toEqual([
      [0, 'xp', 780, 270, 1, false],
      [1, 'wood', 100, 50, 4, false],
      [2, 'gold', 200, 60, 9, false],
    ]);
    expect(f.radius).toBe(5);
  });

  it('Scenario: Tope lleno (300 gemas: la XP se suma a la más antigua)', () => {
    const f = field();
    for (let i = 0; i < 300; i++) f.drop('xp', 10, 10, 1);
    const before = ids(f);
    f.drop('xp', 900, 500, 1);
    expect(ids(f)).toEqual(before);
    expect(f.pickups[0]?.value).toBe(2);
    expect(f.pickups[299]?.value).toBe(1);
  });

  it('Scenario: Varias bajas con el tope lleno (maxGems 1: 1 + 1 + 2 + 4)', () => {
    const f = field({ maxGems: 1 });
    f.drop('xp', 10, 10, 1);
    f.drop('xp', 800, 10, 1);
    f.drop('xp', 800, 20, 2);
    f.drop('xp', 800, 30, 4);
    expect(ids(f)).toEqual([0]);
    expect(values(f)).toEqual([8]);
  });

  it('Scenario: Tope de XP lleno con otros tipos en el suelo (la más antigua vale 2)', () => {
    const f = field();
    for (let i = 0; i < 5; i++) f.drop('wood', 3000, 100, 3);
    for (let i = 0; i < 300; i++) f.drop('xp', 10, 10, 1);
    for (let i = 0; i < 5; i++) f.drop('wood', 3000, 200, 3);
    for (let i = 0; i < 4; i++) f.drop('gold', 3000, 300, 7);
    const before = ids(f);
    f.drop('xp', 900, 500, 1);
    expect(ids(f)).toEqual(before);
    expect(values(f)[0]).toBe(2);
    expect(values(f, 'wood')).toEqual(Array.from({ length: 10 }, () => 3));
    expect(values(f, 'gold')).toEqual([7, 7, 7, 7]);
  });

  it('Scenario: Tope de madera lleno (tope 2: w1 vale 7 y w2 4; la gema se crea)', () => {
    const f = field({ maxWood: 2 });
    f.drop('wood', 3000, 100, 4);
    f.drop('wood', 3000, 200, 4);
    f.drop('xp', 800, 300, 2);
    f.drop('wood', 800, 300, 3);
    expect(values(f, 'wood')).toEqual([7, 4]);
    expect(ids(f, 'wood')).toEqual([0, 1]);
    expect(ids(f)).toEqual([2]);
  });

  it('el valor desbordado nunca va a otro tipo (oro lleno con gemas más antiguas)', () => {
    const f = field({ maxGold: 1 });
    f.drop('xp', 10, 10, 1);
    f.drop('gold', 3000, 100, 10);
    f.drop('gold', 800, 300, 25);
    expect(values(f, 'gold')).toEqual([35]);
    expect(values(f)).toEqual([1]);
  });

  it('Recolocación: cualquier tipo en celda no caminable va a la caminable más cercana', () => {
    const map = mapWith(mapRules(), { '10,4': 'trunk' });
    const f = field({}, map);
    f.drop('xp', 650, 270, 1);
    f.drop('wood', 650, 270, 2);
    f.drop('gold', 650, 270, 3);
    expect(pos(f)).toEqual([
      [690, 270],
      [690, 270],
      [690, 270],
    ]);
  });

  it('Recolocación: con el tope lleno no se crea ni se recoloca nada', () => {
    const map = mapWith(mapRules(), { '10,4': 'trunk' });
    const f = field({ maxWood: 1 }, map);
    f.drop('wood', 100, 100, 1);
    f.drop('wood', 650, 270, 2);
    expect(pos(f)).toEqual([[100, 100]]);
  });
});

describe('PickupField.step · imán', () => {
  it('Scenario: Límite exacto del radio (distancia 64: atraída y 6 px)', () => {
    const f = field();
    f.drop('xp', 544, 270, 1);
    step(f);
    expect(pos(f)).toEqual([[538, 270]]);
    expect(f.pickups[0]?.attracted).toBe(true);
  });

  it('Scenario: Recorrido hasta la recogida (ticks 1 a 7; en el 7, en (502, 270))', () => {
    const f = field();
    f.drop('xp', 544, 270, 1);
    const xs: number[] = [];
    for (let i = 0; i < 7; i++) {
      step(f);
      xs.push(f.pickups[0]?.x ?? Number.NaN);
    }
    expect(xs.map((x) => Math.round(x * 1000) / 1000)).toEqual([538, 532, 526, 520, 514, 508, 502]);
  });

  it.each(['xp', 'gold', 'wood'] as const)(
    'Scenario: Mismo imán para los tres tipos (%s: 538 tras el 1, 502 tras el 7, recogido en el 8)',
    (kind) => {
      const f = field();
      f.drop(kind, 544, 270, 1);
      const xs: number[] = [];
      const got: number[] = [];
      for (let i = 0; i < 8; i++) {
        got.push(step(f)[kind]);
        xs.push(Math.round((f.pickups[0]?.x ?? Number.NaN) * 1000) / 1000);
      }
      expect([xs[0], xs[6]]).toEqual([538, 502]);
      expect(got).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
      expect(f.pickups).toHaveLength(0);
    },
  );

  it('Scenario: Una gema atraída no se suelta (el jugador se aleja a 3,333 px/tick)', () => {
    const f = field();
    let px = 400;
    f.drop('xp', px - 62, 270, 1, true);
    const distances: number[] = [];
    for (let i = 0; i < 5; i++) {
      px += 200 / 60;
      step(f, px);
      distances.push(px - (f.pickups[0]?.x ?? Number.NaN));
    }
    expect(distances[0]).toBeCloseTo(59.333, 3);
    for (let i = 1; i < distances.length; i++) {
      expect((distances[i - 1] ?? 0) - (distances[i] ?? 0)).toBeCloseTo(2.667, 3);
    }
  });

  it('Scenario: Gema fuera del radio (distancia 65 durante 36.000 ticks)', () => {
    const f = field();
    f.drop('xp', 545, 270, 1);
    let xp = 0;
    for (let i = 0; i < 36_000; i++) xp += xpOf(f);
    expect(pos(f)).toEqual([[545, 270]]);
    expect(f.pickups[0]?.attracted).toBe(false);
    expect(xp).toBe(0);
  });

  it('Scenario: Montón fuera del radio (wood y gold a 65 durante 36.000 ticks)', () => {
    const f = field();
    f.drop('wood', 545, 270, 3);
    f.drop('gold', 480, 335, 5);
    const total = { gold: 0, wood: 0 };
    for (let i = 0; i < 36_000; i++) {
      const g = step(f);
      total.gold += g.gold;
      total.wood += g.wood;
    }
    expect(pos(f)).toEqual([
      [545, 270],
      [480, 335],
    ]);
    expect(total).toEqual({ gold: 0, wood: 0 });
  });
});

describe('PickupField.step · recogida', () => {
  it('Scenario: Recogida de una gema (valor 1 a 20 px)', () => {
    const f = field();
    f.drop('xp', 500, 270, 1);
    expect(xpOf(f)).toBe(1);
    expect(f.pickups).toHaveLength(0);
  });

  it('Scenario: Recorrido hasta la recogida (se recoge en el tick 8)', () => {
    const f = field();
    f.drop('xp', 544, 270, 1);
    const xp: number[] = [];
    for (let i = 0; i < 8; i++) xp.push(xpOf(f));
    expect(xp).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(f.pickups).toHaveLength(0);
  });

  it('Scenario: Tangencia tras el imán no es recogida (queda a 21 = 16 + 5)', () => {
    const f = field();
    f.drop('xp', 507, 270, 1, true);
    expect(xpOf(f)).toBe(0);
    expect(pos(f)).toEqual([[501, 270]]);
    expect(xpOf(f)).toBe(1);
  });

  it('Scenario: No sobrepasa al jugador (distancia 3: se recoge en ese tick)', () => {
    const f = field();
    f.drop('xp', 483, 270, 1);
    expect(xpOf(f)).toBe(1);
  });

  it('Scenario: Varias gemas en el mismo tick (4 de valor 1 en el jugador)', () => {
    const f = field();
    for (let i = 0; i < 4; i++) f.drop('xp', 480, 270, 1);
    expect(xpOf(f)).toBe(4);
    expect(f.pickups).toHaveLength(0);
  });

  it('suma por tipo lo recogido en el paso (gold 10, wood 3, xp 1) y reinicia la ganancia', () => {
    const f = field();
    f.drop('gold', 480, 270, 10);
    f.drop('wood', 480, 270, 3);
    f.drop('xp', 480, 270, 1);
    expect(step(f)).toEqual({ xp: 1, gold: 10, wood: 3 });
    expect(step(f)).toEqual({ xp: 0, gold: 0, wood: 0 });
  });

  it('Scenario: Plaza liberada por una recogida (maxGems 1: nueva y distinta de g1)', () => {
    const f = field({ maxGems: 1 });
    f.drop('xp', 480, 270, 1);
    step(f);
    f.drop('xp', 10, 10, 1);
    expect(ids(f)).toEqual([1]);
  });

  it('Scenario: Recoger otro tipo no libera plaza de XP (maxGems 1: g1 con su valor más 1)', () => {
    const f = field({ maxGems: 1 });
    f.drop('xp', 3000, 100, 1);
    f.drop('wood', 480, 270, 2);
    step(f);
    f.drop('xp', 800, 300, 1);
    expect(ids(f)).toEqual([0]);
    expect(values(f)).toEqual([2]);
  });

  it('Scenario: Gemas en el snapshot (g2 se recoge y se crea g4: g1, g3, g4)', () => {
    const f = field();
    f.drop('xp', 10, 10, 1);
    f.drop('xp', 480, 270, 1);
    f.drop('xp', 900, 500, 1);
    step(f);
    f.drop('xp', 10, 500, 1);
    expect(ids(f)).toEqual([0, 2, 3]);
  });

  it('Scenario: Recogibles de varios tipos (g1 se recoge y se crea o2: w1, o1, w2, o2)', () => {
    const f = field();
    f.drop('wood', 10, 10, 1);
    f.drop('xp', 480, 270, 1);
    f.drop('gold', 900, 500, 2);
    f.drop('wood', 1500, 500, 1);
    step(f);
    f.drop('gold', 10, 500, 3);
    expect(f.pickups.map((p) => [p.id, p.kind])).toEqual([
      [0, 'wood'],
      [2, 'gold'],
      [3, 'wood'],
      [4, 'gold'],
    ]);
  });

  it('el pool compartido es la suma de los topes: los tres llenos a la vez', () => {
    const f = field({ maxGems: 3, maxGold: 2, maxWood: 1 });
    for (let i = 0; i < 3; i++) f.drop('xp', 10, 10, 1);
    for (let i = 0; i < 2; i++) f.drop('gold', 10, 10, 1);
    f.drop('wood', 10, 10, 1);
    expect(f.pickups).toHaveLength(6);
    expect([f.count('xp'), f.count('gold'), f.count('wood')]).toEqual([3, 2, 1]);
  });
});
