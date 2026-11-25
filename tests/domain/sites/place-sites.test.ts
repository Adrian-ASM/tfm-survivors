import { describe, expect, it } from 'vitest';
import { seededRun } from '../../../src/composition/seedSource';
import { isFullyConnected } from '../../../src/domain/map/connectivity';
import type { MapSnapshot } from '../../../src/domain/map/MapSnapshot';
import { resolveTerrain } from '../../../src/domain/map/TerrainSource';
import { Run } from '../../../src/domain/run/Run';
import type { RunConfig } from '../../../src/domain/run/RunConfig';
import { Mulberry32RandomGenerator } from '../../../src/infrastructure/random/Mulberry32RandomGenerator';
import { BALANCE_SEEDS } from '../../support/balanceSeeds';
import { CONTENT_BUILDINGS, aDefaultConfig, withBuildings } from '../../support/builders';
import { mapRules } from '../../support/mapLayouts';
import { startSeededRun } from '../../support/runs';
import { declaredSites, siteSignatureOf } from '../../support/sites';

// Spec procedural-map 0026, "Solares en el mapa generado", "Mapa explícito y mapa vacío" y
// "Conectividad con los edificios construidos"; build-sites, "Jugador fuera de la huella al abrir".
const CONTENT = aDefaultConfig();
const RULES = mapRules(CONTENT.map, CONTENT.arena.width, CONTENT.arena.height);
const P = CONTENT_BUILDINGS.sites;
const withCount = (count: number): RunConfig =>
  withBuildings(CONTENT, { ...CONTENT_BUILDINGS, sites: { ...P, count } });

type Cell = readonly [number, number];
const cheb = (a: Cell, b: Cell) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
const minTo = (from: readonly Cell[], to: readonly Cell[]) =>
  Math.min(...from.flatMap((a) => to.map((b) => cheb(a, b))));

function footprintOf(s: {
  readonly col: number;
  readonly row: number;
  readonly cols: number;
  readonly rows: number;
}): Cell[] {
  const out: Cell[] = [];
  for (let r = s.row; r < s.row + s.rows; r++)
    for (let c = s.col; c < s.col + s.cols; c++) out.push([c, r]);
  return out;
}

/** Distancias BFS 4-vecinas sobre el terreno caminable desde la celda (c, r). */
function routeFrom(map: MapSnapshot, c0: number, r0: number): Int32Array {
  const dist = new Int32Array(map.cols * map.rows).fill(-1);
  const walk = (i: number) => map.cells[i] === 'grass' || map.cells[i] === 'bridge';
  const queue = [r0 * map.cols + c0];
  dist[r0 * map.cols + c0] = 0;
  for (let h = 0; h < queue.length; h++) {
    const i = queue[h] ?? 0;
    const c = i % map.cols;
    const near = [c > 0 ? i - 1 : -1, c < map.cols - 1 ? i + 1 : -1, i - map.cols, i + map.cols];
    for (const j of near) {
      if (j < 0 || j >= dist.length || dist[j] !== -1 || !walk(j)) continue;
      dist[j] = (dist[i] ?? 0) + 1;
      queue.push(j);
    }
  }
  return dist;
}

/** Comprueba todas las reglas de colocación de los solares de una partida del mapa generado. */
function expectPlacementRules(run: Run): void {
  const map = run.map;
  const at = (c: number, r: number) => map.cells[r * map.cols + c];
  const cellOf = (p: { x: number; y: number }): Cell => [
    Math.floor(p.x / map.cellSize),
    Math.floor(p.y / map.cellSize),
  ];
  const all = (pred: (c: number, r: number) => boolean): Cell[] => {
    const out: Cell[] = [];
    for (let r = 0; r < map.rows; r++)
      for (let c = 0; c < map.cols; c++) if (pred(c, r)) out.push([c, r]);
    return out;
  };
  const water = all((c, r) => at(c, r) === 'water' || at(c, r) === 'bridge');
  const castle = all((c, r) => at(c, r) === 'castle');
  const start = all((c, r) => RULES.inStartZone(c, r));
  const taken = new Set<string>();
  for (const s of map.structures) {
    for (const [c, r] of footprintOf(s)) taken.add(`${String(c)},${String(r)}`);
    if (s.door) taken.add(`${String(s.door.col)},${String(s.door.row)}`);
  }
  for (const v of map.veins) taken.add(`${String(v.col)},${String(v.row)}`);
  for (const p of map.woodPiles) taken.add(cellOf(p).join(','));
  for (const o of run.snapshot().sheep) taken.add(cellOf(o).join(','));
  const door = map.door;
  if (!door) throw new Error('el mapa generado tiene puerta');
  const route = routeFrom(map, ...cellOf(door));

  for (const s of map.sites) {
    const access = cellOf(s.access);
    const cells = [...footprintOf(s), access];
    expect(cells.every(([c, r]) => at(c, r) === 'grass')).toBe(true);
    expect(footprintOf(s).some(([c, r]) => c === access[0] && r === access[1])).toBe(false);
    expect(cells.some(([c, r]) => taken.has(`${String(c)},${String(r)}`))).toBe(false);
    expect(minTo(cells, water)).toBeGreaterThanOrEqual(P.minWaterCells);
    expect(minTo(cells, castle)).toBeGreaterThanOrEqual(P.minCastleCells);
    expect(minTo(cells, start)).toBeGreaterThanOrEqual(P.minStartCells);
    for (const st of map.structures) {
      expect(minTo(cells, footprintOf(st))).toBeGreaterThanOrEqual(P.minStructureCells);
    }
    for (const other of map.sites) {
      if (other.id === s.id) continue;
      expect(minTo(footprintOf(s), footprintOf(other))).toBeGreaterThanOrEqual(P.minGapCells);
    }
    const d = route[access[1] * map.cols + access[0]] ?? -1;
    expect(d).toBeGreaterThanOrEqual(P.route.min);
    expect(d).toBeLessThanOrEqual(P.route.max);
  }
}

/** ¿Solapa el círculo del jugador la huella desde algún punto a d < radio del acceso (1 px)? */
function playerTouchesFootprint(s: MapSnapshot['sites'][number], size: number): boolean {
  const { radius } = CONTENT_BUILDINGS.access;
  const pr = CONTENT.player.radius;
  const [left, top] = [s.col * size, s.row * size];
  const [right, bottom] = [left + s.cols * size, top + s.rows * size];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (!(Math.hypot(dx, dy) < radius)) continue;
      const x = s.access.x + dx;
      const y = s.access.y + dy;
      const ex = Math.max(left - x, 0, x - right);
      const ey = Math.max(top - y, 0, y - bottom);
      if (ex * ex + ey * ey < pr * pr) return true;
    }
  }
  return false;
}

describe('Solares en el mapa generado (spec procedural-map 0026)', () => {
  it('Scenario: Reglas de colocación con las semillas del conjunto', () => {
    for (const seed of BALANCE_SEEDS) {
      const run = startSeededRun(CONTENT, seed);
      expect(run.map.sites, `semilla ${String(seed)}`).toHaveLength(6);
      expectPlacementRules(run);
    }
  });

  it('Scenario: Jugador fuera de la huella al abrir (semillas 1 a 50)', () => {
    const touching = BALANCE_SEEDS.flatMap((seed) =>
      startSeededRun(CONTENT, seed)
        .map.sites.filter((s) => playerTouchesFootprint(s, RULES.cellSize))
        .map((s) => `${String(seed)}#${String(s.id)}`),
    );
    expect(touching).toEqual([]);
  });

  it('Scenario: Contenido sin hueco suficiente (500 solares, semilla 7)', () => {
    const run = startSeededRun(withCount(500), 7);
    expect(run.map.sites.length).toBeLessThan(500);
    expect(run.map.sites.length).toBeGreaterThanOrEqual(6);
    expectPlacementRules(run);
  });

  it('Scenario: Sin solares (0 por mapa, semilla 42)', () => {
    expect(startSeededRun(withCount(0), 42).map.sites).toEqual([]);
  });

  it('Scenario: Celdas intactas con solares (semilla 42)', () => {
    const run = startSeededRun(CONTENT, 42);
    const bare = startSeededRun(withCount(0), 42);
    expect(run.map.cells).toEqual(bare.map.cells);
    const map = run.map;
    for (const s of map.sites) {
      for (const [c, r] of footprintOf(s)) expect(map.cells[r * map.cols + c]).toBe('grass');
    }
  });

  it('ids 0..n−1 en el orden de colocación; acceso en el centro de la fila r + 3', () => {
    const { sites, cellSize } = startSeededRun(CONTENT, 42).map;
    expect(sites.map((s) => s.id)).toEqual([0, 1, 2, 3, 4, 5]);
    for (const s of sites) {
      expect([s.cols, s.rows]).toEqual([2, 2]);
      expect(s.x).toBe((s.col + 1) * cellSize);
      expect(s.y).toBe((s.row + 1) * cellSize);
      expect(s.access).toEqual({ x: s.x, y: (s.row + 3.5) * cellSize });
    }
  });
});

describe('Mapa explícito con solares (spec procedural-map 0026)', () => {
  const start = (terrain: ReturnType<typeof declaredSites>) =>
    Run.start(CONTENT, new Mulberry32RandomGenerator(42), {}, terrain);

  it('Scenario: Mapa explícito con solares declarados', () => {
    const r = start(
      declaredSites([
        { col: 10, row: 5 },
        { col: 40, row: 20 },
      ]),
    );
    if (!r.ok) throw new Error(r.error.message);
    const map = r.value.map;
    expect(siteSignatureOf(map)).toEqual(['site@10,5', 'site@40,20']);
    expect(map.cells).toHaveLength(2304);
    expect(map.cells.every((t) => t === 'grass')).toBe(true);
  });

  it('el mapa vacío no tiene solares', () => {
    const r = Run.start(CONTENT, new Mulberry32RandomGenerator(42));
    expect(r.ok && r.value.map.sites).toEqual([]);
  });

  it.each([
    ['huella por la columna 64', { col: 63, row: 5 }],
    ['acceso fuera del mundo', { col: 10, row: 34 }],
    ['ancla negativa', { col: -1, row: 5 }],
  ])('Scenario: Solar declarado fuera de la rejilla (%s)', (_name, site) => {
    const r = start(declaredSites([{ col: 10, row: 5 }, site]));
    expect(r.ok).toBe(false);
    expect(r.ok ? '' : r.error.field).toBe('map.sites.1');
    expect(r.ok ? '' : r.error.message).toMatch(/solar/i);
  });
});

describe('Conectividad con los edificios construidos (spec procedural-map 0026)', () => {
  it.each(['house', 'tower'] as const)(
    'Scenario: Todo construido sin zonas aisladas (6 × %s, semillas 1 a 50)',
    () => {
      const isolated = BALANCE_SEEDS.filter((seed) => {
        const sites = startSeededRun(CONTENT, seed).map.sites;
        const map = resolveTerrain(seededRun(seed).terrain, RULES);
        if (!map.ok) throw new Error(map.error.message);
        // Huella de la casa = huella de la torre = huella del solar (design §1).
        const { cols, rows } = P.footprint;
        for (const s of sites) map.value.build(s.col, s.row, cols, rows);
        const exit = map.value.start;
        expect([exit.x, exit.y]).toEqual([1950, 1170]);
        return !isFullyConnected(map.value);
      });
      expect(isolated).toEqual([]);
    },
  );
});
