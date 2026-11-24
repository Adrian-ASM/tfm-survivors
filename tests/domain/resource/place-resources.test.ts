import { describe, expect, it } from 'vitest';
import type { GameMap } from '../../../src/domain/map/GameMap';
import { placeResources } from '../../../src/domain/resource/placeResources';
import type { ResourceRules, ResourcesConfig } from '../../../src/domain/resource/ResourceRules';
import type { ResourcePoint } from '../../../src/domain/resource/resolveResources';
import { buildRunRules, type RunConfig } from '../../../src/domain/run/RunConfig';
import { placeStructures } from '../../../src/domain/structure/placeStructures';
import type { StructureSite } from '../../../src/domain/structure/StructureSite';
import { Mulberry32RandomGenerator } from '../../../src/infrastructure/random/Mulberry32RandomGenerator';
import { RESOURCE_STREAM, deriveSeed } from '../../../src/infrastructure/random/deriveSeed';
import { CONTENT_RESOURCES, aDefaultConfig, withResources } from '../../support/builders';
import { structureRandomFor } from '../../support/camps';
import { mapForSeed } from '../../support/mapStats';
import { CountingRandom } from '../../support/random';

const SEEDS = [...Array.from({ length: 1000 }, (_, i) => i + 1), 0, 4294967295];

const rulesOf = (config: RunConfig) => {
  const r = buildRunRules(config);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};
const CONFIG = aDefaultConfig();
const DEFAULT = rulesOf(CONFIG);
const withCounts = (veins: number, piles: number): ResourcesConfig => ({
  ...CONTENT_RESOURCES,
  goldVeins: { ...CONTENT_RESOURCES.goldVeins, count: veins },
  woodPiles: { ...CONTENT_RESOURCES.woodPiles, count: piles },
});

const resourceRandom = (seed: number) =>
  new Mulberry32RandomGenerator(deriveSeed(seed, RESOURCE_STREAM));

interface Placed {
  readonly map: GameMap;
  readonly sites: readonly StructureSite[];
  readonly veins: readonly ResourcePoint[];
  readonly woodPiles: readonly ResourcePoint[];
}

function place(seed: number, rules: ResourceRules = DEFAULT.resources): Placed {
  const map = mapForSeed(CONFIG, seed);
  const sites = placeStructures(map, DEFAULT.structures, structureRandomFor(seed));
  return { map, sites, ...placeResources(map, sites, rules, resourceRandom(seed)) };
}

interface Cell {
  readonly c: number;
  readonly r: number;
}
const cheb = (a: Cell, b: Cell): number => Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
const minDist = (a: Cell, to: readonly Cell[]): number =>
  Math.min(...to.map((b) => cheb(a, b)), Infinity);

function cellsWhere(map: GameMap, pick: (c: number, r: number) => boolean): Cell[] {
  const out: Cell[] = [];
  for (let r = 0; r < map.rows; r++)
    for (let c = 0; c < map.cols; c++) if (pick(c, r)) out.push({ c, r });
  return out;
}

/** Fallos de las reglas de colocación de la spec, comprobadas por fuerza bruta. */
function ruleFailures(p: Placed, rules: ResourceRules = DEFAULT.resources): string[] {
  const { map, sites } = p;
  const { minStartCells, minCastleCells, minGapCells } = rules.placement;
  const zone = cellsWhere(map, (c, r) => map.rules.inStartZone(c, r));
  const castle = cellsWhere(map, (c, r) => map.typeAt(c, r) === 'castle');
  const taken = new Set<string>();
  for (const s of sites) {
    for (let r = s.row; r < s.row + s.rows; r++)
      for (let c = s.col; c < s.col + s.cols; c++) taken.add(`${String(c)},${String(r)}`);
    if (s.door) taken.add(`${String(s.door.col)},${String(s.door.row)}`);
  }
  const failures: string[] = [];
  const all = [...p.veins, ...p.woodPiles];
  const placed: Cell[] = [];
  for (const [i, pt] of all.entries()) {
    const cell = { c: map.colAt(pt.x), r: map.rowAt(pt.y) };
    const rect = map.cellRect(cell.c, cell.r);
    const tag = `#${String(i)}`;
    if (pt.x !== (rect.left + rect.right) / 2 || pt.y !== (rect.top + rect.bottom) / 2)
      failures.push(`${tag}: fuera del centro`);
    if (map.typeAt(cell.c, cell.r) !== 'grass') failures.push(`${tag}: no es hierba`);
    if (taken.has(`${String(cell.c)},${String(cell.r)}`)) failures.push(`${tag}: huella o puerta`);
    if (minDist(cell, zone) < minStartCells) failures.push(`${tag}: zona de inicio`);
    if (minDist(cell, castle) < minCastleCells) failures.push(`${tag}: castillo`);
    if (placed.some((q) => cheb(q, cell) < Math.max(1, minGapCells))) {
      failures.push(`${tag}: separación`);
    }
    placed.push(cell);
  }
  return failures;
}

describe('Recursos en el mapa generado (procedural-map)', () => {
  it('Scenario: Reglas de colocación con las semillas del conjunto (1..1.000, 0 y 2³² − 1)', () => {
    const { goldVeins, woodPiles } = DEFAULT.resources;
    const bad: string[] = [];
    for (const seed of SEEDS) {
      const p = place(seed);
      if (p.veins.length !== goldVeins.count || p.woodPiles.length !== woodPiles.count) {
        bad.push(`${String(seed)}: número`);
      }
      bad.push(...ruleFailures(p).map((f) => `${String(seed)} ${f}`));
      const exit = p.map.start;
      for (const pt of [...p.veins, ...p.woodPiles]) {
        if (!(Math.hypot(pt.x - exit.x, pt.y - exit.y) > 308)) bad.push(`${String(seed)}: 308`);
      }
    }
    expect(bad).toEqual([]);
    expect(mapForSeed(CONFIG, 42).start).toMatchObject({ x: 1950, y: 1170 });
  }, 60_000);

  it('Scenario: Contenido sin hueco suficiente (2.000 vetas: menos y todas legales)', () => {
    const rules = rulesOf({
      ...withResources(aDefaultConfig(), withCounts(2000, 0)),
    }).resources;
    const p = place(7, rules);
    expect(p.veins.length).toBeGreaterThan(0);
    expect(p.veins.length).toBeLessThan(2000);
    expect(ruleFailures(p, rules)).toEqual([]);
  });

  it('las vetas van antes que los montones y cada recurso consume 1 valor', () => {
    const map = mapForSeed(CONFIG, 42);
    const sites = placeStructures(map, DEFAULT.structures, structureRandomFor(42));
    const random = new CountingRandom(resourceRandom(42));
    const out = placeResources(map, sites, DEFAULT.resources, random);
    expect(random.calls).toBe(out.veins.length + out.woodPiles.length);
    const veinsOnly = placeResources(
      map,
      sites,
      rulesOf(withResources(aDefaultConfig(), withCounts(3, 0))).resources,
      resourceRandom(42),
    );
    expect(veinsOnly.veins).toEqual(out.veins);
  });

  it('Scenario: Misma semilla, mismos recursos (dos colocaciones de la 42)', () => {
    const a = place(42);
    const b = place(42);
    expect([a.veins, a.woodPiles]).toEqual([b.veins, b.woodPiles]);
  });

  it('Scenario: Semillas distintas, recursos distintos (1..50)', () => {
    const keys = Array.from({ length: 50 }, (_, i) => {
      const p = place(i + 1);
      return JSON.stringify([p.veins, p.woodPiles]);
    });
    expect(new Set(keys).size).toBe(50);
  });
});
