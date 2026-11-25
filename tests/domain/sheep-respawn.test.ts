import { describe, expect, it } from 'vitest';
import type { DeclaredSite, TerrainSource } from '../../src/domain/map/TerrainSource';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { LINTER, TESTS, aDynamite, withDuration, withWeapons } from '../support/builders';
import { ticks } from '../support/runs';
import { cellsWith, mapRules } from '../support/mapLayouts';
import { EXIT, SHEEP_AT, aSheepConfig, sheepRandom, startWithSheep } from '../support/sheep';
import { TEST_SITE } from '../support/sites';
import { weaponsOf } from '../support/weapons';

const CELL = 60;
const center = (c: number) => c * CELL + CELL / 2;
/** ¿Está (x, y) en el centro de una celda de la rejilla? Devuelve la celda o null. */
const cellOf = (x: number, y: number): [number, number] | null => {
  const c = (x - CELL / 2) / CELL;
  const r = (y - CELL / 2) / CELL;
  return Number.isInteger(c) && Number.isInteger(r) ? [c, r] : null;
};

/** Ejecuta ticks hasta `to` (incluido) y devuelve los snapshots por número de tick. */
function until(run: Run, to: number): Map<number, RunSnapshot> {
  const out = new Map<number, RunSnapshot>();
  for (let t = run.snapshot().tick + 1; t <= to; t++) {
    run.tick(PlayerInput.NONE);
    out.set(t, run.snapshot());
  }
  return out;
}

// Spec sheep (0023), "Reaparición de ovejas".
describe('Reaparición de ovejas (spec sheep)', () => {
  it('Scenario: Reaparición tras el intervalo (ninguna de n a n + 599; en n + 600, otra celda a ≥ 500)', () => {
    const n = 5;
    const run = startWithSheep(aSheepConfig(), [SHEEP_AT], {
      dynamites: [aDynamite(SHEEP_AT, n)],
    });
    const snaps = until(run, n + 600);
    for (let t = n; t < n + 600; t++) expect(snaps.get(t)?.sheep, `tick ${String(t)}`).toEqual([]);
    const s = snaps.get(n + 600);
    expect(s?.sheep).toHaveLength(1);
    const o = s?.sheep[0];
    expect(o).toMatchObject({ id: 1, health: 12, state: 'graze', damaged: false });
    expect(o?.origin).toEqual({ x: o?.x, y: o?.y });
    const cell = cellOf(o?.x ?? 0, o?.y ?? 0);
    expect(cell).not.toBeNull();
    expect(cell).not.toEqual([16, 16]);
    expect(Math.hypot((o?.x ?? 0) - EXIT.x, (o?.y ?? 0) - EXIT.y)).toBeGreaterThanOrEqual(500);
  });

  it('Scenario: Dos muertes en el mismo tick (o1 y o2 en el mismo pulso: o3, o4, o5)', () => {
    const config = withWeapons(aSheepConfig(), weaponsOf([TESTS]));
    const run = startWithSheep(
      config,
      [
        { x: 1050, y: 1000 },
        { x: 950, y: 1000 },
        { x: 2500, y: 1500 },
      ],
      { player: SHEEP_AT, sheep: [{ health: 4 }, { health: 4 }] },
    );
    const snaps = until(run, 601);
    expect(snaps.get(1)?.sheep.map((o) => o.id)).toEqual([2]);
    expect(snaps.get(600)?.sheep.map((o) => o.id)).toEqual([2]);
    expect(snaps.get(601)?.sheep.map((o) => o.id)).toEqual([2, 3, 4]);
  });

  it('Scenario: Sin celda candidata (distancia mínima 4.500: ninguna en 3.600 ticks, sin errores)', () => {
    const config = aSheepConfig({ respawn: { everyTicks: 600, minPlayerDistance: 4500 } });
    const run = startWithSheep(config, [SHEEP_AT], { dynamites: [aDynamite(SHEEP_AT, 5)] });
    const snaps = until(run, 5 + 3600);
    const after = [...snaps.entries()].filter(([t]) => t >= 5).map(([, s]) => s.sheep.length);
    expect(after.every((k) => k === 0)).toBe(true);
    expect(run.status).toBe('running');
  });

  describe('Scenario: Muerte en el tick de la victoria (intervalo 1, muerte por armas en el 119)', () => {
    // Oveja de vida 24 a 242 px: el Linter la impacta en los ticks 29, 59, 89 y 119.
    const config = (seconds?: number) => {
      const base = withWeapons(
        aSheepConfig({ health: 24, respawn: { everyTicks: 1, minPlayerDistance: 500 } }),
        weaponsOf([LINTER]),
      );
      return seconds === undefined ? base : withDuration(base, seconds);
    };
    const start = (seconds?: number) =>
      startWithSheep(config(seconds), [SHEEP_AT], { player: { x: 1242, y: 1000 } });

    it('control: sin victoria, la oveja nueva aparece en el tick 120', () => {
      const snaps = ticks(start(), 120);
      expect(snaps[117]?.sheep[0]?.health).toBe(6);
      expect(snaps[118]?.sheep).toEqual([]);
      expect(snaps[119]?.sheep.map((o) => o.id)).toEqual([1]);
    });

    it('con duración 120 ticks, la partida gana sin la oveja nueva', () => {
      const s = ticks(start(2), 120)[119];
      expect(s).toMatchObject({ status: 'over', outcome: 'won' });
      expect(s?.sheep).toEqual([]);
    });
  });

  it('Scenario: Muerte sin reordenar (o2 reaparece como o4, al final: o1, o3, o4)', () => {
    const run = startWithSheep(
      aSheepConfig(),
      [SHEEP_AT, { x: 1500, y: 600 }, { x: 600, y: 600 }],
      {
        dynamites: [aDynamite({ x: 1500, y: 600 }, 3)],
      },
    );
    const snaps = until(run, 603);
    expect(snaps.get(602)?.sheep.map((o) => o.id)).toEqual([0, 2]);
    expect(snaps.get(603)?.sheep.map((o) => o.id)).toEqual([0, 2, 3]);
  });
});

// Spec simulation-loop (0023), "Orden de los pasos del tick".
describe('Reaparición en el orden del tick (spec simulation-loop)', () => {
  it('Scenario: La oveja reaparecida no se mueve ni es objetivo en su tick', () => {
    const config = withWeapons(aSheepConfig(), weaponsOf([LINTER, TESTS]));
    // La oveja original, a 920 px del jugador (fuera de alcance), muere por una dinamita en el 5.
    const run = startWithSheep(config, [SHEEP_AT], { dynamites: [aDynamite(SHEEP_AT, 5)] });
    const snaps = until(run, 606);
    const s = snaps.get(605);
    expect(s?.weapons.map((w) => w.ready)).toEqual([true, true]);
    const o = s?.sheep[0];
    expect(o).toMatchObject({ id: 1, state: 'graze', health: 12 });
    expect(cellOf(o?.x ?? 0, o?.y ?? 0)).not.toBeNull();
    expect([s?.projectiles, s?.pulses]).toEqual([[], []]);
    const next = snaps.get(606)?.sheep[0];
    expect([next?.x, next?.y]).toEqual([o?.x, o?.y]);
    expect(center(0)).toBe(30);
  });
});

// Spec sheep 0027, "Reaparición de ovejas": las celdas de obra (solares libres desde el tick 0 y
// edificios) no son candidatas.
describe('Reaparición de ovejas con solares (spec sheep 0027)', () => {
  /** 4 solares declarados (16 celdas), lejos de la salida (1.920, 1.080) y de la oveja. */
  const SITES: readonly DeclaredSite[] = [
    { col: 10, row: 5 },
    { col: 40, row: 5 },
    { col: 10, row: 28 },
    { col: 50, row: 28 },
  ];
  const inSite = (c: number, r: number) =>
    SITES.some((x) => c >= x.col && c < x.col + 2 && r >= x.row && r < x.row + 2);
  const respawnCell = (seed: number, setup: RunSetup) => {
    const config = aSheepConfig({ respawn: { everyTicks: 600, minPlayerDistance: 0 } });
    const terrain: TerrainSource = {
      kind: 'open',
      sites: SITES,
      sheep: { at: [SHEEP_AT], random: sheepRandom(seed) },
    };
    const r = Run.start(
      config,
      new Mulberry32RandomGenerator(seed),
      {
        dynamites: [aDynamite(SHEEP_AT, 5)],
        ...setup,
      },
      terrain,
    );
    if (!r.ok) throw new Error(r.error.message);
    const o = until(r.value, 605).get(605)?.sheep[0];
    return cellOf(o?.x ?? 0, o?.y ?? 0);
  };

  it.each([
    ['libres', {}],
    ['construidos', { sites: SITES.map(() => ({ state: 'house' as const })) }],
  ])('Scenario: Sin reaparición en un solar (4 solares %s, semillas 1 a 50)', (_name, setup) => {
    const bad: string[] = [];
    for (let seed = 1; seed <= 50; seed++) {
      const cell = respawnCell(seed, setup);
      if (!cell || inSite(cell[0], cell[1])) bad.push(`${String(seed)}: ${String(cell)}`);
    }
    expect(bad).toEqual([]);
  });

  it('Scenario: Solo celdas de obra disponibles (troncos salvo la huella y la celda (5, 5))', () => {
    const rules = mapRules();
    const layout: Record<string, 'grass' | 'trunk'> = {};
    for (let r = 0; r < rules.rows; r++)
      for (let c = 0; c < rules.cols; c++) layout[`${String(c)},${String(r)}`] = 'trunk';
    for (const key of ['20,10', '21,10', '20,11', '21,11', '5,5']) layout[key] = 'grass';
    const config = withWeapons(
      aSheepConfig({ respawn: { everyTicks: 600, minPlayerDistance: 0 } }),
      weaponsOf([TESTS]),
    );
    const at = { x: center(5), y: center(5) };
    const r = Run.start(
      config,
      new Mulberry32RandomGenerator(42),
      { sheep: [{ health: 4 }] },
      {
        kind: 'cells',
        cells: cellsWith(rules, layout),
        start: at,
        sites: [TEST_SITE],
        sheep: { at: [at], random: sheepRandom(42) },
      },
    );
    if (!r.ok) throw new Error(r.error.message);
    const run = r.value;
    const snaps = until(run, 3601);
    expect(snaps.get(1)?.sheep).toEqual([]);
    expect([...snaps.values()].every((x) => x.sheep.length === 0)).toBe(true);
    expect(run.status).toBe('running');
  });
});
