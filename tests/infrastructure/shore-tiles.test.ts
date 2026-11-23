import { describe, expect, it } from 'vitest';
import type { CellType } from '../../src/domain/map/CellType';
import { toMapSnapshot, type MapSnapshot } from '../../src/domain/map/MapSnapshot';
import {
  bridgeOrientation,
  isShore,
  riverSides,
  shoreCase,
  shoreCells,
} from '../../src/infrastructure/phaser/map/shoreTiles';
import { BALANCE_SEEDS } from '../support/balanceSeeds';
import { aDefaultConfig } from '../support/builders';
import { mapRules, mapWith, type Layout } from '../support/mapLayouts';
import { mapForSeed } from '../support/mapStats';

// Spec sprite-rendering (0016), "Orillas por autotile de 4 vecinos" y "Orientación de los puentes".
// Rejilla explícita de 32 × 18 (mundo de 1.920 × 1.080): la geometría con la que están escritos los
// escenarios de mapa explícito (columna 31 en el borde, 64 orillas en el río recto).
const RULES = mapRules(undefined, 1920, 1080);
const snap = (layout: Layout): MapSnapshot => toMapSnapshot(mapWith(RULES, layout));
const caseAt = (s: MapSnapshot, c: number, r: number) => shoreCase(riverSides(s, c, r));
const key = (c: number, r: number) => `${String(c)},${String(r)}`;

function row(r: number, type: CellType, except: Layout = {}): Layout {
  const out: Record<string, CellType> = {};
  for (let c = 0; c < RULES.cols; c++) out[key(c, r)] = type;
  return { ...out, ...except };
}

function column(c: number, type: CellType, except: Layout = {}): Layout {
  const out: Record<string, CellType> = {};
  for (let r = 0; r < RULES.rows; r++) out[key(c, r)] = type;
  return { ...out, ...except };
}

describe('Orillas por autotile de 4 vecinos', () => {
  it('Scenario: Río recto horizontal (fila 9 de agua: 64 orillas)', () => {
    const s = snap(row(9, 'water'));
    expect([caseAt(s, 0, 8), caseAt(s, 5, 8), caseAt(s, 31, 8), caseAt(s, 5, 10)]).toEqual([
      'S',
      'S',
      'S',
      'N',
    ]);
    expect(isShore(s, 5, 9)).toBe(false);
    expect(caseAt(s, 5, 9)).toBe('EW');
    expect(shoreCells(s)).toHaveLength(64);
  });

  it('Scenario: Tierra junto a un puente', () => {
    const s = snap(row(9, 'water', { '16,9': 'bridge' }));
    expect([caseAt(s, 16, 8), caseAt(s, 16, 10)]).toEqual(['S', 'N']);
    expect(isShore(s, 16, 9)).toBe(false);
  });

  it('Scenario: Meandro (7 orillas)', () => {
    const s = snap({ '5,9': 'water', '6,9': 'water', '6,10': 'water' });
    expect([caseAt(s, 5, 10), caseAt(s, 7, 10)]).toEqual(['NE', 'W']);
    expect(isShore(s, 5, 11)).toBe(false);
    expect(
      shoreCells(s)
        .map(({ col, row: r }) => key(col, r))
        .sort(),
    ).toEqual(['5,8', '4,9', '5,10', '6,8', '7,9', '7,10', '6,11'].sort());
  });

  it('Scenario: Tronco y castillo cuentan como tierra', () => {
    const s = snap({ '4,3': 'water', '5,3': 'trunk', '4,2': 'castle' });
    expect([caseAt(s, 5, 3), caseAt(s, 4, 2)]).toEqual(['W', 'S']);
    expect([isShore(s, 5, 3), isShore(s, 4, 2), isShore(s, 4, 3)]).toEqual([true, true, false]);
  });

  it('Scenario: Bloque de agua y borde del mundo (12 orillas; ninguna en un mapa de hierba)', () => {
    const block: Record<string, CellType> = {};
    for (let r = 4; r <= 6; r++) for (let c = 4; c <= 6; c++) block[key(c, r)] = 'water';
    const s = snap(block);
    const found = shoreCells(s).map(({ col, row: r, kind }) => `${key(col, r)}:${kind}`);
    const expected = [
      ...[4, 5, 6].map((c) => `${key(c, 3)}:S`),
      ...[4, 5, 6].map((c) => `${key(c, 7)}:N`),
      ...[4, 5, 6].map((r) => `${key(3, r)}:E`),
      ...[4, 5, 6].map((r) => `${key(7, r)}:W`),
    ];
    expect(found.sort()).toEqual(expected.sort());
    expect(shoreCells(snap({}))).toEqual([]);
  });

  it('el borde del mundo no es río: la esquina (0, 0) junto a agua solo tiene su lado de río', () => {
    const s = snap({ '1,0': 'water' });
    expect(riverSides(s, 0, 0)).toEqual({ N: false, E: true, S: false, W: false });
  });

  it('shoreCase devuelve null sin lados de río', () => {
    expect(shoreCase({ N: false, E: false, S: false, W: false })).toBeNull();
    expect(shoreCase({ N: true, E: true, S: true, W: true })).toBe('NESW');
    expect(shoreCase({ N: true, E: false, S: true, W: true })).toBe('NSW');
  });
});

describe('Orientación de los puentes', () => {
  it('Scenario: Puente en un río horizontal (norte-sur)', () => {
    const s = snap(row(9, 'water', { '16,9': 'bridge' }));
    expect(bridgeOrientation(s, 16, 9)).toBe('northSouth');
  });

  it('Scenario: Puente en un río vertical (este-oeste)', () => {
    const s = snap(column(16, 'water', { '16,9': 'bridge' }));
    expect(bridgeOrientation(s, 16, 9)).toBe('eastWest');
  });

  it('Scenario: Puente en un recodo (norte-sur)', () => {
    const s = snap({ '16,9': 'bridge', '15,9': 'water', '16,10': 'water' });
    expect(bridgeOrientation(s, 16, 9)).toBe('northSouth');
  });

  it('fuera de la rejilla cuenta como río para la orientación', () => {
    const s = snap(column(0, 'water', { '0,0': 'bridge', '0,1': 'water' }));
    expect(bridgeOrientation(s, 0, 0)).toBe('northSouth');
  });

  it('Scenario: Puentes del mapa generado (1..50: tierra a los dos lados de su orientación)', () => {
    const config = aDefaultConfig();
    const bad: string[] = [];
    for (const seed of BALANCE_SEEDS) {
      const s = toMapSnapshot(mapForSeed(config, seed));
      s.cells.forEach((t, i) => {
        if (t !== 'bridge') return;
        const c = i % s.cols;
        const r = (i - c) / s.cols;
        const sides = riverSides(s, c, r);
        const o = bridgeOrientation(s, c, r);
        const ok = o === 'northSouth' ? !sides.N && !sides.S : !sides.E && !sides.W;
        if (!ok) bad.push(`${String(seed)}:${key(c, r)}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
