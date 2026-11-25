import { describe, expect, it } from 'vitest';
import type { CellType } from '../../src/domain/map/CellType';
import type { MapSnapshot } from '../../src/domain/map/MapSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { DECOR_STREAM, deriveSeed } from '../../src/infrastructure/random/deriveSeed';
import {
  resolveMapLooks,
  resolveSiteLooks,
  resolveStructureLooks,
  resolveVeinLooks,
} from '../../src/infrastructure/phaser/map/mapLooks';
import { inStartZone, validDecorCells } from '../../src/infrastructure/phaser/map/decorChoices';
import { shoreCells } from '../../src/infrastructure/phaser/map/shoreTiles';
import {
  planMapArt,
  type MapArtPlan,
  type SpriteDraw,
} from '../../src/infrastructure/phaser/map/planMapArt';
import { BALANCE_SEEDS } from '../support/balanceSeeds';
import { aDefaultConfig } from '../support/builders';
import { startOn } from '../support/camps';
import {
  WORLD,
  bridgeFrames,
  loadedExcept,
  planFor,
  repoAppearance,
  spritesOf,
} from '../support/mapArt';
import { mapForSeed } from '../support/mapStats';
import { randomInputs } from '../support/inputs';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';

// Spec sprite-rendering (0029), "Decoración del mapa generado" y "Pintado de la decoración"; spec
// build-sites (0029), "Solares sin decoración". Plan puro, sin motor.
const CONFIG = aDefaultConfig();
const APPEARANCE = repoAppearance();
const DECOR = APPEARANCE.map.decor;
const ADMITTED = DECOR.items.map((i) => i.sheet.file);
const ROCKS = Object.values(APPEARANCE.pickups.stone.rocks).map((r) => r.sheet.file);
const NO_DECOR = { maxDecor: 0 } as const;
const INPUTS = randomInputs(1200, 29);

const seedMap = (seed: number): MapSnapshot => startSeededRun(CONFIG, seed).map;
/** Objetos de escena de la decoración nominal del plan (baja 1, alta 2). */
const nominal = (plan: MapArtPlan): number => plan.decor.reduce((n, d) => n + d.pieces, 0);
const keyOf = (d: { col: number; row: number; file: string; x: number; y: number }) =>
  `${String(d.col)},${String(d.row)}:${d.file}@${String(d.x)},${String(d.y)}`;
const decorSprites = (plan: MapArtPlan): SpriteDraw[] => [
  ...spritesOf(plan, 'decor'),
  ...spritesOf(plan, 'decor-top'),
];

/**
 * Celdas excluidas calculadas aparte, con las reglas de la spec (no con `validDecorCells`): zona de
 * inicio del dominio, castillo ampliado 1, solares, estructuras, orilla, recursos y no-hierba.
 */
function excludedBySpec(seed: number, map: MapSnapshot): Uint8Array {
  const rules = mapForSeed(CONFIG, seed).rules;
  const out = new Uint8Array(map.cols * map.rows);
  const mark = (c: number, r: number) => {
    if (c >= 0 && r >= 0 && c < map.cols && r < map.rows) out[r * map.cols + c] = 1;
  };
  map.cells.forEach((t: CellType, i) => {
    const c = i % map.cols;
    const r = (i - c) / map.cols;
    if (t !== 'grass' || rules.inStartZone(c, r)) out[i] = 1;
  });
  const castle = map.castle;
  if (castle) {
    for (let r = castle.firstRow - 1; r <= castle.lastRow + 1; r++)
      for (let c = castle.firstCol - 1; c <= castle.lastCol + 1; c++) mark(c, r);
  }
  for (const f of [...map.sites, ...map.structures])
    for (let r = f.row; r < f.row + f.rows; r++)
      for (let c = f.col; c < f.col + f.cols; c++) mark(c, r);
  for (const s of shoreCells(map)) mark(s.col, s.row);
  for (const p of map.woodPiles)
    mark(Math.floor(p.x / map.cellSize), Math.floor(p.y / map.cellSize));
  for (const v of map.veins) mark(v.col, v.row);
  return out;
}

describe('Decoración del mapa generado (plan)', () => {
  it('Scenario: Decoración de los mapas generados (1..50: 1–120 objetos, hojas admitidas, anclaje válido)', () => {
    const bad: string[] = [];
    for (const seed of BALANCE_SEEDS) {
      const map = seedMap(seed);
      const plan = planFor(map, seed);
      const objects = nominal(plan);
      if (objects < 1 || objects > 120) bad.push(`${String(seed)}: ${String(objects)} objetos`);
      const valid = validDecorCells(map, DECOR.castleMargin);
      const anchors = new Set<number>();
      for (const d of plan.decor) {
        const i = d.row * map.cols + d.col;
        if (!ADMITTED.includes(d.file)) bad.push(`${String(seed)}: hoja ${d.file}`);
        if (valid[i] !== 1)
          bad.push(`${String(seed)}: anclaje (${String(d.col)}, ${String(d.row)})`);
        const s = map.cellSize;
        const inside =
          d.x >= d.col * s - 1 &&
          d.x <= (d.col + 1) * s + 1 &&
          d.y >= d.row * s - 1 &&
          d.y <= (d.row + 1) * s + 1;
        if (!inside) bad.push(`${String(seed)}: origen fuera de su celda`);
        if (anchors.has(i)) bad.push(`${String(seed)}: anclaje repetido`);
        anchors.add(i);
      }
    }
    expect(bad).toEqual([]);
  });

  it('Scenario: Zonas excluidas (1..50: ninguna base en zona excluida; bases sin solape; 3 × 1 en Deco/18)', () => {
    const bad: string[] = [];
    for (const seed of BALANCE_SEEDS) {
      const map = seedMap(seed);
      const excluded = excludedBySpec(seed, map);
      const used = new Set<number>();
      for (const d of planFor(map, seed).decor) {
        const anchor = d.row * map.cols + d.col;
        const expected = d.file === 'Deco/18.png' ? [anchor - 1, anchor, anchor + 1] : [anchor];
        if (JSON.stringify([...d.base].sort((a, b) => a - b)) !== JSON.stringify(expected))
          bad.push(`${String(seed)}: huella de ${d.file}`);
        for (const c of d.base) {
          if (excluded[c] === 1) bad.push(`${String(seed)}: celda excluida ${String(c)}`);
          if (used.has(c)) bad.push(`${String(seed)}: solape en ${String(c)}`);
          used.add(c);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('zona de inicio igual a MapRules.inStartZone (1..50, todas las celdas)', () => {
    const diff: string[] = [];
    for (const seed of BALANCE_SEEDS) {
      const map = seedMap(seed);
      const rules = mapForSeed(CONFIG, seed).rules;
      for (let r = 0; r < map.rows; r++)
        for (let c = 0; c < map.cols; c++)
          if (inStartZone(map, c, r) !== rules.inStartZone(c, r))
            diff.push(`${String(seed)}:${String(c)},${String(r)}`);
    }
    expect(diff).toEqual([]);
  });

  it('Scenario: Junto a los troncos (≥ 1 anclaje con una vecina 4-conexa trunk en 1..50)', () => {
    let next = 0;
    for (const seed of BALANCE_SEEDS) {
      const map = seedMap(seed);
      const type = (c: number, r: number) =>
        c < 0 || r < 0 || c >= map.cols || r >= map.rows ? undefined : map.cells[r * map.cols + c];
      for (const d of planFor(map, seed).decor) {
        const around = [
          type(d.col - 1, d.row),
          type(d.col + 1, d.row),
          type(d.col, d.row - 1),
          type(d.col, d.row + 1),
        ];
        if (around.includes('trunk')) next++;
      }
    }
    expect(next).toBeGreaterThanOrEqual(1);
  });

  it('Scenario: Misma semilla, misma decoración (semilla 42, dos cálculos)', () => {
    const map = seedMap(42);
    const a = planFor(map, 42).decor.map(keyOf);
    const b = planFor(seedMap(42), 42).decor.map(keyOf);
    expect(a.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
  });

  it('Scenario: Otra semilla, otra decoración (42 frente a 43)', () => {
    const a = planFor(seedMap(42), 42).decor.map(keyOf);
    const b = planFor(seedMap(43), 43).decor.map(keyOf);
    expect(a).not.toEqual(b);
  });

  it('Scenario: Sin decoración en los mapas explícitos ni en el vacío (vacío, open y cells de hierba)', () => {
    const grass = Array.from({ length: 64 * 36 }, (): CellType => 'grass');
    const maps = [
      startSeededRun(CONFIG, 42, 'empty').map,
      startOn(CONFIG, { kind: 'open' }).map,
      startOn(CONFIG, { kind: 'cells', cells: grass }, {}, new Mulberry32RandomGenerator(42)).map,
    ];
    for (const map of maps) {
      const plan = planFor(map, 42);
      expect(plan.decor).toEqual([]);
      expect(decorSprites(plan)).toEqual([]);
      expect(plan.counts.decor).toEqual({ planned: 0, painted: 0, unpainted: 0 });
    }
  });

  it('Scenario: Tope de decoración (42: tope 0 = plan de 120 sin sus objetos; tope 1 sin altas; tope 3 ≤ 3)', () => {
    const map = seedMap(42);
    const full = planFor(map, 42);
    const zero = planFor(map, 42, [], NO_DECOR);
    expect(zero.decor).toEqual([]);
    const strip = (p: MapArtPlan) => ({
      low: p.low.filter(
        (d) => d.kind !== 'sprite' || (d.role !== 'decor' && d.role !== 'decor-top'),
      ),
      high: p.high.filter((d) => d.role !== 'decor-top'),
    });
    expect(strip(full)).toEqual({ low: zero.low, high: zero.high });
    const one = planFor(map, 42, [], { maxDecor: 1 });
    expect(one.decor.length).toBeLessThanOrEqual(1);
    expect(one.decor.some((d) => d.tall)).toBe(false);
    expect(nominal(planFor(map, 42, [], { maxDecor: 3 }))).toBeLessThanOrEqual(3);
  });

  it('Scenario: Elegir la decoración no consume azar (42: 1.200 ticks iguales con tope 120 y 0)', () => {
    // La decoración vive en el plan del adaptador: con tope 120 y 0 la partida es la misma.
    const play = (maxDecor: number) => {
      const run = startSeededRun(CONFIG, 42);
      planFor(run.map, 42, [], { maxDecor });
      const out: string[] = [];
      for (const input of INPUTS) {
        chooseFirstWhileOpen(run);
        run.tick(input);
        out.push(JSON.stringify(run.snapshot()));
        planFor(run.map, 42, [], { maxDecor });
      }
      return { out, map: JSON.stringify(run.map) };
    };
    expect(play(120)).toEqual(play(0));
  });
});

describe('Pintado de la decoración (plan)', () => {
  it('Scenario: Decoración en su sitio (42: hoja y frame del aspecto, origen del plan, corte en el borde superior)', () => {
    const plan = planFor(seedMap(42), 42);
    const low = spritesOf(plan, 'decor');
    const top = spritesOf(plan, 'decor-top');
    expect(low).toHaveLength(plan.decor.length);
    expect(top).toHaveLength(plan.decor.filter((d) => d.tall).length);
    expect(top.length).toBeGreaterThan(0);
    plan.decor.forEach((d, k) => {
      const item = DECOR.items[d.item];
      const base = low[k];
      expect(base).toMatchObject({ texture: d.file, frame: item?.frame, x: d.x, y: d.y });
      expect(plan.low).toContain(base);
      const cellTop = d.row * plan.cellSize;
      if (d.tall) {
        expect(Math.abs((base?.bounds.y ?? 0) - cellTop)).toBeLessThanOrEqual(1);
      } else {
        expect(base?.crop).toBeNull();
      }
    });
    for (const t of top) {
      expect(plan.high).toContain(t);
      const cellTop = t.y - plan.cellSize;
      expect(Math.abs(t.bounds.y + t.bounds.height - cellTop)).toBeLessThanOrEqual(1);
    }
  });

  it('Scenario: Hoja de una decoración que no carga (Deco/18.png sin cargar)', () => {
    const map = seedMap(42);
    const full = planFor(map, 42);
    const plan = planFor(map, 42, ['Deco/18.png']);
    const scarecrows = full.decor.filter((d) => d.file === 'Deco/18.png').length;
    expect(scarecrows).toBeGreaterThan(0);
    expect(decorSprites(plan).some((s) => s.texture === 'Deco/18.png')).toBe(false);
    expect(plan.low.filter((d) => d.kind === 'rect')).toEqual(
      full.low.filter((d) => d.kind === 'rect'),
    );
    expect(plan.objects).toBe(full.objects - 2 * scarecrows);
    expect(decorSprites(plan)).toHaveLength(decorSprites(full).length - 2 * scarecrows);
  });

  it('Scenario: Hoja de una decoración que no carga (Deco/08.png con un frame que la hoja no contiene)', () => {
    const a = repoAppearance();
    const items = a.map.decor.items.map((i) =>
      i.sheet.file === 'Deco/08.png' ? { ...i, frame: 3 } : i,
    );
    const map = { ...a.map, decor: { ...a.map.decor, items } };
    const frames = loadedExcept();
    const looks = resolveMapLooks(
      map,
      a.terrain,
      frames,
      bridgeFrames(),
      resolveStructureLooks(a, frames),
      resolveVeinLooks(a, frames),
      resolveSiteLooks(a, frames),
    );
    const snapshot = seedMap(42);
    const plan = planMapArt(snapshot, looks, {
      decorSeed: deriveSeed(42, DECOR_STREAM),
      world: WORLD,
    });
    const full = planFor(snapshot, 42);
    const bushes = full.decor.filter((d) => d.file === 'Deco/08.png').length;
    expect(bushes).toBeGreaterThan(0);
    expect(decorSprites(plan).some((s) => s.texture === 'Deco/08.png')).toBe(false);
    expect(plan.counts.decor).toEqual({
      planned: full.decor.length,
      painted: full.decor.length - bushes,
      unpainted: bushes,
    });
    expect(plan.objects).toBe(full.objects - bushes);
  });

  it('Scenario: Recuento de la decoración sin una hoja (Deco/18.png: misma decoración, sin pintar las de 18)', () => {
    const map = seedMap(42);
    const full = planFor(map, 42);
    const plan = planFor(map, 42, ['Deco/18.png']);
    expect(plan.decor.map(keyOf)).toEqual(full.decor.map(keyOf));
    const scarecrows = full.decor.filter((d) => d.file === 'Deco/18.png');
    expect(plan.decor.filter((d) => !d.painted).map(keyOf)).toEqual(scarecrows.map(keyOf));
    const { planned, painted, unpainted } = plan.counts.decor;
    expect(painted + unpainted).toBe(planned);
    expect(planned).toBe(full.decor.length);
    expect(plan.objects).toBe(full.objects - 2 * scarecrows.length);
  });

  it('Scenario: Pintar la decoración no cambia la simulación (42, con y sin las 11 hojas)', () => {
    const play = (missing: readonly string[]) => {
      const run = startSeededRun(CONFIG, 42);
      const out: string[] = [];
      for (const input of INPUTS) {
        chooseFirstWhileOpen(run);
        planFor(run.map, 42, missing);
        run.tick(input);
        out.push(JSON.stringify(run.snapshot()));
      }
      return out;
    };
    expect(play([])).toEqual(play(ADMITTED));
  });

  it('la semilla 42 tiene 3 espantapájaros en su plan (cifra del E2E "Hojas del mapa bloqueadas")', () => {
    expect(planFor(seedMap(42), 42).decor.filter((d) => d.file === 'Deco/18.png')).toHaveLength(3);
  });

  it('ninguna decoración usa la hoja de una roca de la piedra', () => {
    for (const seed of [42, 123]) {
      expect(planFor(seedMap(seed), seed).decor.some((d) => ROCKS.includes(d.file))).toBe(false);
    }
  });
});

describe('Capas de la decoración (plan)', () => {
  it('Scenario: Decoración baja y alta (base antes de los troncos en la baja; parte alta antes de las copas)', () => {
    const plan = planFor(seedMap(42), 42);
    const low = plan.low;
    const firstTrunk = low.findIndex((d) => d.kind === 'sprite' && d.role === 'trunk');
    const decorLow = low.flatMap((d, i) => (d.kind === 'sprite' && d.role === 'decor' ? [i] : []));
    const lastBridge = low.reduce(
      (n, d, i) => (d.kind === 'sprite' && d.role === 'bridge' ? i : n),
      -1,
    );
    expect(decorLow.length).toBeGreaterThan(0);
    expect(Math.max(...decorLow)).toBeLessThan(firstTrunk);
    expect(Math.min(...decorLow)).toBeGreaterThan(lastBridge);
    const high = plan.high;
    const firstCanopy = high.findIndex((d) => d.role === 'canopy');
    const tops = high.flatMap((d, i) => (d.role === 'decor-top' ? [i] : []));
    expect(Math.max(...tops)).toBeLessThan(firstCanopy);
    // E (Deco/18): base con y ≥ Y en la capa baja y parte alta con y < Y en la alta.
    const e = plan.decor.find((d) => d.file === 'Deco/18.png');
    if (!e) throw new Error('sin espantapájaros en la 42');
    const Y = e.row * plan.cellSize;
    const base = spritesOf(plan, 'decor').find((s) => s.x === e.x && s.y === e.y);
    const top = spritesOf(plan, 'decor-top').find((s) => s.x === e.x && s.y === e.y);
    expect(base?.bounds.y).toBeCloseTo(Y, 3);
    expect((top?.bounds.y ?? 0) + (top?.bounds.height ?? 0)).toBeCloseTo(Y, 3);
    // D (Deco/08, baja): entera en la capa baja, bajo las entidades.
    const d = plan.decor.find((x) => x.file === 'Deco/08.png');
    expect(spritesOf(plan, 'decor').some((s) => s.x === d?.x && s.y === d.y)).toBe(true);
    expect(spritesOf(plan, 'decor-top').some((s) => s.x === d?.x && s.y === d.y)).toBe(false);
  });
});

describe('Solares sin decoración (build-sites 0029)', () => {
  it('Scenario: Solares sin decoración (1..50: ningún anclaje en un solar; igual con casa y torre construidas)', () => {
    const bad: string[] = [];
    for (const seed of BALANCE_SEEDS) {
      const map = seedMap(seed);
      const plan = planFor(map, seed);
      const inSite = (c: number, r: number) =>
        map.sites.some((s) => c >= s.col && c < s.col + s.cols && r >= s.row && r < s.row + s.rows);
      for (const d of plan.decor)
        if (inSite(d.col, d.row)) bad.push(`${String(seed)}: ${keyOf(d)}`);
    }
    expect(bad).toEqual([]);
    const built = startSeededRun(CONFIG, 42, 'generated', {
      sites: [{ state: 'house' }, { state: 'tower' }],
    });
    expect(
      built
        .snapshot()
        .sites.slice(0, 2)
        .map((s) => s.state),
    ).toEqual(['house', 'tower']);
    expect(planFor(built.map, 42).decor.map(keyOf)).toEqual(
      planFor(seedMap(42), 42).decor.map(keyOf),
    );
  });
});
