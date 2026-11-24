import { describe, expect, it } from 'vitest';
import type { CellType } from '../../src/domain/map/CellType';
import { FlowField } from '../../src/domain/map/FlowField';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { DEFAULT_ENEMY_TYPES, LONG_RUN_HEALTH, aDefaultConfig } from '../support/builders';
import { castleBlock, cellsWith, mapRules, mapWith, type Layout } from '../support/mapLayouts';
import { aContactConfig, aProbeType, ticks } from '../support/runs';

// Spec enemy-behavior, "Navegación por el campo de flujo", "Línea libre hasta el jugador" y
// "Persecución en línea recta" (change 0019). Mapa de hierba de 64 × 36 (mundo por defecto).
const RULES = mapRules();
const WORLD = aDefaultConfig().arena;

/** Probe (velocidad 60) y goblin-torch (velocidad 90), sin oleadas y con vida inagotable. */
const CONFIG: RunConfig = {
  ...aContactConfig({
    types: [aProbeType(), DEFAULT_ENEMY_TYPES[0]],
    player: { maxHealth: LONG_RUN_HEALTH },
  }),
  arena: WORLD,
};

/** Partida con el mapa de hierba con `layout` y el `setup` dado (azar con semilla 7). */
function navRun(layout: Layout, setup: RunSetup, random = new Mulberry32RandomGenerator(7)): Run {
  const r = Run.start(CONFIG, random, setup, { kind: 'cells', cells: cellsWith(RULES, layout) });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const probeAt = (x: number, y: number) => ({ type: 'probe', x, y });

/** Celda del centro de un enemigo del snapshot. */
const typeUnder = (layout: Layout, x: number, y: number): CellType =>
  mapWith(RULES, layout).typeAt(Math.floor(x / 60), Math.floor(y / 60));

/** Primer tick (1-based) en que el enemigo 0 está en (x, y) con error ≤ 0,001; 0 si nunca. */
function arrival(path: readonly RunSnapshot[], x: number, y: number): number {
  const i = path.findIndex((s) => {
    const e = s.enemies[0];
    return e !== undefined && Math.abs(e.x - x) <= 1e-3 && Math.abs(e.y - y) <= 1e-3;
  });
  return i + 1;
}

const RIVER: Layout = Object.fromEntries(
  Array.from({ length: 36 }, (_, r) => [`10,${String(r)}`, r === 20 ? 'bridge' : 'water']),
);
const WALL: Layout = Object.fromEntries(
  [2, 3, 4, 5, 6].map((r) => [`10,${String(r)}`, 'trunk'] as const),
);
const CASTLE = castleBlock();
const CLOSED: Layout = { '10,4': 'trunk', '9,5': 'trunk', '11,5': 'trunk', '10,6': 'trunk' };

describe('Navegación por el campo de flujo (spec enemy-behavior)', () => {
  it('Scenario: Cruce del río por el único puente', () => {
    const path = ticks(
      navRun(RIVER, { player: { x: 930, y: 270 }, enemies: [probeAt(330, 270)] }),
      3600,
    );
    const centers = path.map((s) => s.enemies[0] ?? { x: -1, y: -1 });
    expect(centers.some((e) => typeUnder(RIVER, e.x, e.y) === 'water')).toBe(false);
    expect(centers.some((e) => Math.floor(e.x / 60) === 10 && Math.floor(e.y / 60) === 20)).toBe(
      true,
    );
    const tick = arrival(path, 930, 270);
    expect(tick).toBeGreaterThan(0);
    expect(tick).toBeLessThanOrEqual(2520);
  });

  it('Scenario: Rodeo de un muro de troncos (llega entre los ticks 601 y 960)', () => {
    const path = ticks(
      navRun(WALL, { player: { x: 930, y: 270 }, enemies: [probeAt(330, 270)] }),
      1200,
    );
    expect(
      path.some((s) => typeUnder(WALL, s.enemies[0]?.x ?? 0, s.enemies[0]?.y ?? 0) === 'trunk'),
    ).toBe(false);
    const tick = arrival(path, 930, 270);
    expect(tick).toBeGreaterThanOrEqual(601);
    expect(tick).toBeLessThanOrEqual(960);
  });

  it('Scenario: Rodeo del castillo (llega en un tick > 300 y ≤ 660)', () => {
    const setup = { player: { x: 1950, y: 1170 }, enemies: [probeAt(1950, 870)] };
    const path = ticks(navRun(CASTLE, setup), 1200);
    expect(
      path.some((s) => typeUnder(CASTLE, s.enemies[0]?.x ?? 0, s.enemies[0]?.y ?? 0) === 'castle'),
    ).toBe(false);
    const tick = arrival(path, 1950, 1170);
    expect(tick).toBeGreaterThan(300);
    expect(tick).toBeLessThanOrEqual(660);
  });

  it('Scenario: Paso por tick con el campo (goblin-torch a 1,5 unidades, en celda caminable)', () => {
    const setup = {
      player: { x: 930, y: 270 },
      enemies: [{ type: 'goblin-torch', x: 330, y: 270 }],
    };
    const [s] = ticks(navRun(WALL, setup), 1);
    const e = s?.enemies[0];
    expect(Math.hypot((e?.x ?? 0) - 330, (e?.y ?? 0) - 270)).toBeCloseTo(1.5, 3);
    expect(typeUnder(WALL, e?.x ?? 0, e?.y ?? 0)).toBe('grass');
  });

  it('Scenario: Celda sin distancia en el campo (persecución en línea recta)', () => {
    const inside = ticks(
      navRun(CLOSED, { player: { x: 1230, y: 330 }, enemies: [probeAt(630, 330)] }),
      60,
    );
    expect(inside[59]?.enemies[0]?.x).toBeCloseTo(690, 3);
    expect(inside[59]?.enemies[0]?.y).toBeCloseTo(330, 3);
    const onTrunk = ticks(
      navRun(CLOSED, { player: { x: 1230, y: 270 }, enemies: [probeAt(630, 270)] }),
      60,
    );
    expect(onTrunk[59]?.enemies[0]?.x).toBeCloseTo(690, 3);
    expect(onTrunk[59]?.enemies[0]?.y).toBeCloseTo(270, 3);
  });
});

describe('Línea libre en la partida (spec enemy-behavior)', () => {
  it('Scenario: Obstáculo fuera del segmento (tronco en (3, 6): (160, 270) tras 60 ticks)', () => {
    const path = ticks(
      navRun({ '3,6': 'trunk' }, { player: { x: 480, y: 270 }, enemies: [probeAt(100, 270)] }),
      60,
    );
    const open = ticks(
      navRun({}, { player: { x: 480, y: 270 }, enemies: [probeAt(100, 270)] }),
      60,
    );
    expect(path[59]?.enemies[0]?.x).toBeCloseTo(160, 3);
    expect(path[59]?.enemies[0]?.y).toBeCloseTo(270, 3);
    expect(path.map((s) => s.enemies[0])).toEqual(open.map((s) => s.enemies[0]));
  });

  it('Scenario: Segmento sobre el borde de una celda bloqueada (tronco en (3, 5), y = 300)', () => {
    const layout: Layout = { '3,5': 'trunk' };
    expect(new FlowField(mapWith(RULES, layout)).hasClearLine(100, 300, 480, 300)).toBe(false);
    const path = ticks(
      navRun(layout, { player: { x: 480, y: 300 }, enemies: [probeAt(100, 300)] }),
      600,
    );
    const inTrunk = path.some((s) => {
      const e = s.enemies[0];
      return e !== undefined && Math.floor(e.x / 60) === 3 && Math.floor(e.y / 60) === 5;
    });
    expect(inTrunk).toBe(false);
    expect(arrival(path, 480, 300)).toBeGreaterThan(0);
  });

  it('Scenario: Ataque directo en la celda del jugador (1 unidad hacia (510, 330))', () => {
    const [s] = ticks(
      navRun({ '8,4': 'trunk' }, { player: { x: 510, y: 330 }, enemies: [probeAt(530, 350)] }),
      1,
    );
    const e = s?.enemies[0];
    const k = 1 / Math.SQRT2;
    expect(e?.x).toBeCloseTo(530 - k, 3);
    expect(e?.y).toBeCloseTo(350 - k, 3);
  });

  it('con un mapa todo hierba la persecución es la recta exacta (input (1, 0) incluido)', () => {
    const setup = { player: { x: 480, y: 270 }, enemies: [probeAt(180, 70), probeAt(900, 600)] };
    const cells = ticks(navRun({}, setup), 120, PlayerInput.of(1, 0));
    const open = Run.start(CONFIG, new Mulberry32RandomGenerator(7), setup);
    if (!open.ok) throw new Error(open.error.message);
    expect(cells.map((s) => s.enemies)).toEqual(
      ticks(open.value, 120, PlayerInput.of(1, 0)).map((s) => s.enemies),
    );
  });
});

describe('Determinismo de la navegación (spec enemy-behavior y simulation-loop)', () => {
  it('Scenario: Empate resuelto igual siempre (tres partidas, mismo lado en el tick 120)', () => {
    const one = { player: { x: 1950, y: 1170 }, enemies: [probeAt(1950, 870)] };
    const two = { player: { x: 1950, y: 1170 }, enemies: [probeAt(1950, 870), probeAt(1950, 870)] };
    const a = ticks(navRun(CASTLE, one), 660);
    const b = ticks(navRun(CASTLE, one), 660);
    const c = ticks(navRun(CASTLE, two), 660);
    expect(a.map((s) => s.enemies)).toEqual(b.map((s) => s.enemies));
    for (const s of c)
      expect([s.enemies[0]?.x, s.enemies[0]?.y]).toEqual([s.enemies[1]?.x, s.enemies[1]?.y]);
    const side = (s: RunSnapshot | undefined) => Math.sign((s?.enemies[0]?.x ?? 1950) - 1950);
    expect(side(a[119])).not.toBe(0);
    expect([side(b[119]), side(c[119])]).toEqual([side(a[119]), side(a[119])]);
  });

  it('Scenario: El campo solo depende de la celda del jugador ((910, 250) y (950, 290))', () => {
    const map = mapWith(RULES, WALL);
    expect(new FlowField(map).hasClearLine(330, 270, 910, 250)).toBe(false);
    expect(new FlowField(map).hasClearLine(330, 270, 950, 290)).toBe(false);
    const [a] = ticks(
      navRun(WALL, { player: { x: 910, y: 250 }, enemies: [probeAt(330, 270)] }),
      1,
    );
    const [b] = ticks(
      navRun(WALL, { player: { x: 950, y: 290 }, enemies: [probeAt(330, 270)] }),
      1,
    );
    expect(a?.enemies[0]).toEqual(b?.enemies[0]);
  });

  it('Scenario: La navegación no consume azar (sin línea libre frente a con línea libre)', () => {
    const blocked = new Mulberry32RandomGenerator(7);
    const free = new Mulberry32RandomGenerator(7);
    const setup = { player: { x: 930, y: 270 }, enemies: [probeAt(330, 270)] };
    navRun(WALL, setup, blocked).tick(PlayerInput.NONE);
    navRun({}, setup, free).tick(PlayerInput.NONE);
    expect(blocked.next()).toBe(free.next());
  });

  it('Scenario: La persecución usa la celda del jugador ya movido', () => {
    const moved = 958 + 200 / 60;
    expect(Math.floor(moved / 60)).toBe(16);
    const [a] = ticks(
      navRun(WALL, { player: { x: 958, y: 270 }, enemies: [probeAt(330, 270)] }),
      1,
      PlayerInput.of(1, 0),
    );
    const [b] = ticks(
      navRun(WALL, { player: { x: moved, y: 270 }, enemies: [probeAt(330, 270)] }),
      1,
    );
    expect(a?.player.x).toBe(moved);
    expect(a?.enemies[0]).toEqual(b?.enemies[0]);
  });

  it('Scenario: La persecución por el mapa no consume azar (300 enemigos, río y troncos)', () => {
    const layout: Layout = { ...RIVER, ...WALL, '20,10': 'trunk', '25,30': 'trunk' };
    const enemies = Array.from({ length: 300 }, (_, i) =>
      probeAt(30 + (i % 20) * 30, 30 + Math.floor(i / 20) * 120),
    );
    const setup = { player: { x: 930, y: 270 }, enemies };
    const mapped = new Mulberry32RandomGenerator(7);
    const open = new Mulberry32RandomGenerator(7);
    navRun(layout, setup, mapped).tick(PlayerInput.NONE);
    navRun({}, setup, open).tick(PlayerInput.NONE);
    expect(mapped.next()).toBe(open.next());
  });
});
