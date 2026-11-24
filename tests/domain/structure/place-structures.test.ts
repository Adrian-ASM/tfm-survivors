import { describe, expect, it } from 'vitest';
import type { GameMap } from '../../../src/domain/map/GameMap';
import { CountingRandom } from '../../support/random';
import { placeStructures } from '../../../src/domain/structure/placeStructures';
import type { StructureSite } from '../../../src/domain/structure/StructureSite';
import type { StructurePlacementConfig } from '../../../src/domain/structure/StructureType';
import {
  aCampsConfig,
  aStructuresConfig,
  campRules,
  structureRandomFor,
} from '../../support/camps';
import { mapForSeed } from '../../support/mapStats';

const RULES = campRules();
const SEEDS = [...Array.from({ length: 1000 }, (_, i) => i + 1), 0, 4294967295];

interface Cell {
  readonly c: number;
  readonly r: number;
}

const cheb = (a: Cell, b: Cell): number => Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
const minDist = (from: readonly Cell[], to: readonly Cell[]): number =>
  Math.min(...from.flatMap((a) => to.map((b) => cheb(a, b))), Infinity);

function footprint(s: StructureSite): Cell[] {
  const out: Cell[] = [];
  for (let r = s.row; r < s.row + s.rows; r++)
    for (let c = s.col; c < s.col + s.cols; c++) {
      out.push({ c, r });
    }
  return out;
}

function cellsWhere(map: GameMap, pick: (c: number, r: number) => boolean): Cell[] {
  const out: Cell[] = [];
  for (let r = 0; r < map.rows; r++)
    for (let c = 0; c < map.cols; c++) if (pick(c, r)) out.push({ c, r });
  return out;
}

/** Fallos de las reglas de colocación de la spec, comprobadas por fuerza bruta. */
function ruleFailures(map: GameMap, sites: readonly StructureSite[], p: StructurePlacementConfig) {
  const failures: string[] = [];
  const zone = cellsWhere(map, (c, r) => map.rules.inStartZone(c, r));
  const castle = cellsWhere(map, (c, r) => map.typeAt(c, r) === 'castle');
  const water = cellsWhere(map, (c, r) => ['water', 'bridge'].includes(map.typeAt(c, r)));
  const doors = sites.flatMap((s) => (s.door ? [{ c: s.door.col, r: s.door.row }] : []));
  for (const s of sites) {
    const own = footprint(s);
    const checked = s.door ? [...own, { c: s.door.col, r: s.door.row }] : own;
    const tag = `${s.type.id}#${String(s.id)}`;
    if (
      checked.some(({ c, r }) => c >= map.cols || r >= map.rows || map.typeAt(c, r) !== 'grass')
    ) {
      failures.push(`${tag}: celda que no es hierba`);
    }
    if (minDist(checked, zone) < p.minStartCells) failures.push(`${tag}: zona de inicio`);
    if (minDist(checked, castle) < p.minCastleCells) failures.push(`${tag}: castillo`);
    if (minDist(checked, water) < p.minWaterCells) failures.push(`${tag}: río`);
    if (own.some((a) => doors.some((d) => cheb(a, d) === 0))) failures.push(`${tag}: puerta`);
    for (const o of sites) {
      if (o.id <= s.id) continue;
      if (minDist(own, footprint(o)) < Math.max(p.minGapCells, 1)) {
        failures.push(`${tag}: separación con ${String(o.id)}`);
      }
    }
  }
  return failures;
}

const countsOf = (sites: readonly StructureSite[]) =>
  ['goblin-house', 'goblin-tower'].map((id) => sites.filter((s) => s.type.id === id).length);

describe('placeStructures (goblin-structures, colocación)', () => {
  it('Scenario: Reglas de colocación con las semillas del conjunto', () => {
    const config = aCampsConfig();
    const failures: string[] = [];
    for (const seed of SEEDS) {
      const map = mapForSeed(config, seed);
      const sites = placeStructures(map, RULES.structures, structureRandomFor(seed));
      if (countsOf(sites).join() !== '4,3')
        failures.push(`${String(seed)}: ${countsOf(sites).join()}`);
      for (const f of ruleFailures(map, sites, RULES.structures.placement)) {
        failures.push(`${String(seed)}: ${f}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('ids en orden de colocación: primero las casas, luego las torres', () => {
    const sites = placeStructures(
      mapForSeed(aCampsConfig(), 42),
      RULES.structures,
      structureRandomFor(42),
    );
    expect(sites.map((s) => s.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(sites.map((s) => s.type.kind)).toEqual([
      ...Array<string>(4).fill('house'),
      ...Array<string>(3).fill('tower'),
    ]);
    expect(sites.every((s) => Object.isFrozen(s))).toBe(true);
  });

  it('Scenario: Contenido sin hueco suficiente (500 casas, semilla 7)', () => {
    const structures = aStructuresConfig({ house: { count: 500 } });
    const rules = campRules(structures);
    const map = mapForSeed(aCampsConfig(structures), 7);
    const sites = placeStructures(map, rules.structures, structureRandomFor(7));
    const [houses] = countsOf(sites);
    expect(houses).toBeLessThan(500);
    expect(houses).toBeGreaterThan(0);
    expect(ruleFailures(map, sites, rules.structures.placement)).toEqual([]);
  });

  it('2 valores por intento y un tipo deja de colocarse al agotar los intentos de una estructura', () => {
    const structures = aStructuresConfig({
      house: { count: 3 },
      tower: { count: 0 },
      placement: { minStartCells: 1000, maxAttempts: 5 },
    });
    const rules = campRules(structures);
    const random = new CountingRandom(structureRandomFor(7));
    const sites = placeStructures(
      mapForSeed(aCampsConfig(structures), 7),
      rules.structures,
      random,
    );
    expect(sites).toEqual([]);
    expect(random.calls).toBe(10);
  });

  it('tras agotar un tipo, se coloca el siguiente', () => {
    const structures = aStructuresConfig({
      house: { count: 2, footprint: { cols: 64, rows: 30 } },
      tower: { count: 1 },
    });
    const rules = campRules(structures);
    const sites = placeStructures(
      mapForSeed(aCampsConfig(structures), 7),
      rules.structures,
      structureRandomFor(7),
    );
    expect(countsOf(sites)).toEqual([0, 1]);
    expect(sites[0]?.id).toBe(0);
  });
});
