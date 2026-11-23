import { describe, expect, it } from 'vitest';
import type { CellType } from '../../src/domain/map/CellType';
import { toMapSnapshot, type MapSnapshot } from '../../src/domain/map/MapSnapshot';
import { isShore } from '../../src/infrastructure/phaser/map/shoreTiles';
import {
  bestRuns,
  mergeTileRuns,
  shoreTileCells,
  waterTileCells,
  type KeyedCell,
  type TileRun,
} from '../../src/infrastructure/phaser/map/tileRuns';
import { mapRules, mapWith, type Layout } from '../support/mapLayouts';

// Design 0016 §12.3 (agrupado por filas o por columnas) y §12.2 B6 (agua bajo las orillas).
const RULES = mapRules();
const snap = (layout: Layout): MapSnapshot => toMapSnapshot(mapWith(RULES, layout));
const key = (c: number, r: number) => `${String(c)},${String(r)}`;

function column(c: number, type: CellType, except: Layout = {}): Layout {
  const out: Record<string, CellType> = {};
  for (let r = 0; r < RULES.rows; r++) out[key(c, r)] = type;
  return { ...out, ...except };
}

/** Celdas que cubre cada tramo, como `'c,r'` (con repeticiones si se solapan). */
const covered = (runs: readonly TileRun[]): string[] =>
  runs.flatMap((t) => {
    const out: string[] = [];
    for (let r = t.row; r < t.row + t.rows; r++)
      for (let c = t.col; c < t.col + t.cols; c++) out.push(key(c, r));
    return out;
  });

describe('mergeTileRuns y bestRuns', () => {
  const cells: KeyedCell[] = [
    { col: 2, row: 1, key: 'a' },
    { col: 3, row: 1, key: 'a' },
    { col: 4, row: 1, key: 'b' },
    { col: 2, row: 2, key: 'a' },
  ];

  it('por filas une celdas contiguas de la misma clave en una fila', () => {
    expect(mergeTileRuns(cells, 'rows')).toEqual([
      { col: 2, row: 1, cols: 2, rows: 1, key: 'a' },
      { col: 4, row: 1, cols: 1, rows: 1, key: 'b' },
      { col: 2, row: 2, cols: 1, rows: 1, key: 'a' },
    ]);
  });

  it('por columnas une celdas contiguas de la misma clave en una columna', () => {
    expect(mergeTileRuns(cells, 'cols')).toEqual([
      { col: 2, row: 1, cols: 1, rows: 2, key: 'a' },
      { col: 3, row: 1, cols: 1, rows: 1, key: 'a' },
      { col: 4, row: 1, cols: 1, rows: 1, key: 'b' },
    ]);
  });

  it('río vertical: por columnas (el de menos tramos) y cobertura exacta sin solapes', () => {
    const s = snap(column(16, 'water', { '16,9': 'bridge' }));
    const water = waterTileCells(s, true);
    const runs = bestRuns(water);
    expect(runs.length).toBeLessThan(mergeTileRuns(water, 'rows').length);
    expect(runs).toHaveLength(3);
    const seen = covered(runs);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.sort()).toEqual(water.map((w) => key(w.col, w.row)).sort());
  });

  it('el agua con orillas cubre agua, puentes y orillas, nunca tierra que no sea orilla', () => {
    const s = snap({ '4,3': 'water', '15,9': 'water', '16,9': 'bridge', '17,9': 'water' });
    const runs = bestRuns(waterTileCells(s, true));
    for (const cell of covered(runs)) {
      const [c, r] = cell.split(',').map(Number) as [number, number];
      const t = s.cells[r * s.cols + c];
      expect(t === 'water' || t === 'bridge' || isShore(s, c, r), cell).toBe(true);
    }
    expect(covered(runs)).toEqual(expect.arrayContaining(['4,3', '15,9', '16,9', '17,9']));
  });

  it('sin orillas (orilla en reserva) el agua cubre solo water y bridge', () => {
    const s = snap({ '4,3': 'water', '16,9': 'bridge' });
    expect(covered(bestRuns(waterTileCells(s, false))).sort()).toEqual(['16,9', '4,3']);
  });

  it('orillas agrupadas por su caso: la fila 8 sobre un río horizontal es 1 tramo S', () => {
    const river: Record<string, CellType> = {};
    for (let c = 0; c < RULES.cols; c++) river[key(c, 9)] = 'water';
    const runs = bestRuns(shoreTileCells(snap(river)));
    expect(runs).toEqual([
      { col: 0, row: 8, cols: RULES.cols, rows: 1, key: 'S' },
      { col: 0, row: 10, cols: RULES.cols, rows: 1, key: 'N' },
    ]);
  });
});
