import { describe, expect, it } from 'vitest';
import type { GameMap } from '../../src/domain/map/GameMap';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import { buildRunRules, type RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { placeSheep, sheepCells } from '../../src/domain/sheep/placeSheep';
import type { SheepRules } from '../../src/domain/sheep/SheepRules';
import { placeStructures } from '../../src/domain/structure/placeStructures';
import type { StructureSite } from '../../src/domain/structure/StructureSite';
import { seededRun } from '../../src/composition/seedSource';
import { CONTENT_SHEEP, LONG_RUN_HEALTH, aDefaultConfig, withPlayer, withoutSheep } from '../support/builders';
import { structureRandomFor } from '../support/camps';
import { randomInputs } from '../support/inputs';
import { mapForSeed } from '../support/mapStats';
import { CountingRandom } from '../support/random';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';
import { sheepRandom } from '../support/sheep';

const SEEDS = [...Array.from({ length: 1000 }, (_, i) => i + 1), 0, 4294967295];
const CONFIG = aDefaultConfig();
const rulesOf = (config: RunConfig) => {
  const r = buildRunRules(config);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};
const DEFAULT = rulesOf(CONFIG);
const { flee, graze, wander, placement } = CONTENT_SHEEP;
/** Distancia a la salida de la spec: huida + pasto + un paseo (200 + 240 + 40 = 480 con el contenido). */
const EXIT_CLEARANCE = flee.radius + graze.radius + (wander.speed * wander.ticks) / 60;

interface Placed {
  readonly map: GameMap;
  readonly sites: readonly StructureSite[];
  readonly at: readonly { x: number; y: number }[];
}

function place(seed: number, rules: SheepRules = DEFAULT.sheep): Placed {
  const map = mapForSeed(CONFIG, seed);
  const sites = placeStructures(map, DEFAULT.structures, structureRandomFor(seed));
  const at = placeSheep(sheepCells(map, sites, rules), map, rules, sheepRandom(seed));
  return { map, sites, at };
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

/** Fallos de las reglas de colocación de la spec, por fuerza bruta. */
function ruleFailures(p: Placed, radius = CONTENT_SHEEP.radius): string[] {
  const { map, sites } = p;
  const zone = cellsWhere(map, (c, r) => map.rules.inStartZone(c, r));
  const castle = cellsWhere(map, (c, r) => map.typeAt(c, r) === 'castle');
  const taken = new Set<string>();
  for (const s of sites) {
    for (let r = s.row; r < s.row + s.rows; r++)
      for (let c = s.col; c < s.col + s.cols; c++) taken.add(`${String(c)},${String(r)}`);
    if (s.door) taken.add(`${String(s.door.col)},${String(s.door.row)}`);
  }
  const failures: string[] = [];
  const placed: Cell[] = [];
  for (const [i, pt] of p.at.entries()) {
    const cell = { c: map.colAt(pt.x), r: map.rowAt(pt.y) };
    const rect = map.cellRect(cell.c, cell.r);
    const tag = `#${String(i)}`;
    if (pt.x !== (rect.left + rect.right) / 2 || pt.y !== (rect.top + rect.bottom) / 2)
      failures.push(`${tag}: fuera del centro`);
    if (map.typeAt(cell.c, cell.r) !== 'grass') failures.push(`${tag}: no es hierba`);
    if (taken.has(`${String(cell.c)},${String(cell.r)}`)) failures.push(`${tag}: huella o puerta`);
    if (minDist(cell, zone) < placement.minStartCells) failures.push(`${tag}: zona de inicio`);
    if (minDist(cell, castle) < placement.minCastleCells) failures.push(`${tag}: castillo`);
    if (placed.some((q) => cheb(q, cell) < Math.max(1, placement.minGapCells)))
      failures.push(`${tag}: separación`);
    if (map.overlapsBlocked(pt.x, pt.y, radius)) failures.push(`${tag}: solapa el mapa`);
    const exit = map.start;
    if (!(Math.hypot(pt.x - exit.x, pt.y - exit.y) > EXIT_CLEARANCE)) failures.push(`${tag}: salida`);
    placed.push(cell);
  }
  return failures;
}

const sheepSig = (s: RunSnapshot) => s.sheep.map((o) => `${String(o.x)},${String(o.y)}`).join('|');

// Spec procedural-map (0023), "Ovejas en el mapa generado".
describe('Ovejas en el mapa generado (spec procedural-map)', () => {
  it('Scenario: Reglas de colocación con las semillas del conjunto (1..1.000, 0 y 2³² − 1)', () => {
    const bad: string[] = [];
    for (const seed of SEEDS) {
      const p = place(seed);
      if (p.at.length !== CONTENT_SHEEP.maxAlive) bad.push(`${String(seed)}: número`);
      bad.push(...ruleFailures(p).map((f) => `${String(seed)} ${f}`));
    }
    expect(bad).toEqual([]);
    expect(EXIT_CLEARANCE).toBe(480);
  }, 60_000);

  it('Scenario: Contenido sin hueco suficiente (tope 2.000: la partida se crea con menos, legales)', () => {
    const config = { ...CONFIG, sheep: { ...CONTENT_SHEEP, maxAlive: 2000 } };
    const run = startSeededRun(config, 7);
    const s = run.snapshot();
    expect(s.sheep.length).toBeGreaterThan(0);
    expect(s.sheep.length).toBeLessThan(2000);
    const map = mapForSeed(CONFIG, 7);
    const sites = placeStructures(map, DEFAULT.structures, structureRandomFor(7));
    expect(ruleFailures({ map, sites, at: s.sheep })).toEqual([]);
  });

  it('Scenario: Sin ovejas (tope 0, semilla 42: 3.600 ticks sin ovejas ni carne)', () => {
    const run = startSeededRun(withoutSheep(CONFIG), 42);
    let seen = 0;
    for (let t = 0; t < 3600 && run.status !== 'over'; t++) {
      chooseFirstWhileOpen(run);
      run.tick(PlayerInput.NONE);
      const s = run.snapshot();
      seen += s.sheep.length + s.pickups.filter((p) => p.kind === 'meat').length;
    }
    expect(seen).toBe(0);
  });

  it('Scenario: Celdas intactas con ovejas (semilla 42: hierba e igual al mapa sin ovejas)', () => {
    const run = startSeededRun(CONFIG, 42);
    const { map } = run;
    for (const o of run.snapshot().sheep) {
      const c = Math.floor(o.x / 60);
      const r = Math.floor(o.y / 60);
      expect(map.cells[r * 64 + c]).toBe('grass');
    }
    expect(run.snapshot().sheep).toHaveLength(CONTENT_SHEEP.maxAlive);
    expect(map.cells).toEqual(startSeededRun(withoutSheep(CONFIG), 42).map.cells);
  });
});

// Spec procedural-map (0023), "Colocación de ovejas determinista con azar propio".
describe('Colocación determinista de las ovejas (spec procedural-map)', () => {
  it('Scenario: Misma semilla, mismas ovejas (aunque una partida juegue 3.600 ticks)', () => {
    const a = startSeededRun(CONFIG, 42);
    const first = sheepSig(a.snapshot());
    const b = startSeededRun(withPlayer(CONFIG, { maxHealth: LONG_RUN_HEALTH }), 42);
    for (const input of randomInputs(3600, 7)) {
      chooseFirstWhileOpen(b);
      b.tick(input);
    }
    expect(sheepSig(startSeededRun(CONFIG, 42).snapshot())).toBe(first);
    expect(first.split('|')).toHaveLength(CONTENT_SHEEP.maxAlive);
  });

  it('Scenario: Semillas distintas, ovejas distintas (1..50)', () => {
    const sigs = Array.from({ length: 50 }, (_, i) => place(i + 1).at.map((p) => `${String(p.x)},${String(p.y)}`).join('|'));
    expect(new Set(sigs).size).toBe(50);
  });

  it('Scenario: Las ovejas no cambian celdas, estructuras ni recursos (1..50, con tope y con tope 0)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const a = startSeededRun(CONFIG, seed).map;
      const b = startSeededRun(withoutSheep(CONFIG), seed).map;
      expect(a, `semilla ${String(seed)}`).toEqual(b);
    }
  });

  it('Scenario: Colocar ovejas no consume el azar de la partida (semilla 7)', () => {
    const count = (config: RunConfig) => {
      const { random, terrain } = seededRun(7);
      const counted = new CountingRandom(random);
      const r = Run.start(config, counted, {}, terrain);
      if (!r.ok) throw new Error(r.error.message);
      return [counted.calls, counted.next()];
    };
    expect(count(CONFIG)).toEqual(count(withoutSheep(CONFIG)));
  });
});
