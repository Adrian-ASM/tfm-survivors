import { resourceRandomFor, sheepRandomFor } from '../support/camps';
import { siteRandomFor } from '../support/sites';
import { describe, expect, it } from 'vitest';
import { StartRun } from '../../src/application/StartRun';
import type { CellType } from '../../src/domain/map/CellType';
import { reachableCells } from '../../src/domain/map/connectivity';
import {
  MAP_START_ILLEGAL,
  OPEN_TERRAIN,
  resolveTerrain,
  type TerrainSource,
} from '../../src/domain/map/TerrainSource';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import { SETUP_PLAYER_ON_BLOCKED_CELL } from '../../src/domain/run/RunSetup';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { MAP_STREAM, STRUCT_STREAM, deriveSeed } from '../../src/infrastructure/random/deriveSeed';
import { aDefaultConfig } from '../support/builders';
import { cellsWith, emptyWithExit, mapRules, type Layout } from '../support/mapLayouts';
import { mapForSeed, typesOf } from '../support/mapStats';
import { advance, play, startSeededRun, ticks } from '../support/runs';
import { CountingRandom } from '../support/random';

const CONFIG = aDefaultConfig();
const RULES = mapRules();

const generated = (seed: number): TerrainSource => ({
  kind: 'generated',
  random: new Mulberry32RandomGenerator(deriveSeed(seed, MAP_STREAM)),
  structureRandom: new Mulberry32RandomGenerator(deriveSeed(seed, STRUCT_STREAM)),
  resourceRandom: resourceRandomFor(seed),
  sheepRandom: sheepRandomFor(seed),
  siteRandom: siteRandomFor(seed),
});

function start(
  terrain: TerrainSource,
  random: RandomGenerator = new Mulberry32RandomGenerator(7),
  setup = {},
): Run {
  const r = Run.start(CONFIG, random, setup, terrain);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('Mapa de la partida (spec procedural-map)', () => {
  it('Scenario: Rejilla por defecto (partida: 64 × 36 celdas de 60 px)', () => {
    const map = start(OPEN_TERRAIN).map;
    expect([map.cols, map.rows, map.cellSize, map.cells.length]).toEqual([64, 36, 60, 2304]);
  });

  it('Scenario: Partida con mapa vacío (semilla 7: 2.304 celdas grass)', () => {
    const map = start(OPEN_TERRAIN).map;
    expect(map.counts).toEqual({ grass: 2304, trunk: 0, water: 0, bridge: 0, castle: 0 });
    expect(map.start).toEqual({ x: 1920, y: 1080, radius: 180 });
  });

  it('el mapa generado de la partida es el de generateMap con la semilla derivada', () => {
    const map = start(generated(42)).map;
    expect(map.cells).toEqual(typesOf(mapForSeed(CONFIG, 42)));
    const total = Object.values(map.counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(2304);
    expect(map.counts.trunk).toBe(map.cells.filter((t) => t === 'trunk').length);
  });

  it('Scenario: Mapa de dimensiones incorrectas (32 × 18, la rejilla anterior: la partida no se crea)', () => {
    const cells = cellsWith(mapRules(undefined, 1920, 1080), {});
    const r = Run.start(CONFIG, new Mulberry32RandomGenerator(7), {}, { kind: 'cells', cells });
    expect(!r.ok && r.error.message).toContain('dimensiones');
    const viaUseCase = new StartRun().execute(
      CONFIG,
      new Mulberry32RandomGenerator(7),
      {},
      {
        kind: 'cells',
        cells,
      },
    );
    expect(viaUseCase.ok).toBe(false);
  });

  it('Scenario: Mapa constante (tick 0, tick 3.600 y partida terminada, semilla 42)', () => {
    const run = start(generated(42), new Mulberry32RandomGenerator(42));
    const atStart = run.map;
    const cellsAtStart = [...atStart.cells];
    advance(run, 3600);
    expect(run.map.cells).toEqual(cellsAtStart);
    play(run, 36000);
    expect(run.status).toBe('over');
    expect(run.map.cells).toEqual(cellsAtStart);
    expect(run.map).toBe(atStart);
  });

  it('Scenario: Lectura no mutable (cambiar la celda (0, 0) leída no la bloquea)', () => {
    const run = start(OPEN_TERRAIN, undefined, { player: { x: 90, y: 30 } });
    ticks(run, 10);
    const cells = run.map.cells as CellType[];
    expect(() => {
      cells[0] = 'trunk';
    }).toThrow(TypeError);
    ticks(run, 30, PlayerInput.of(-1, 0));
    expect(run.snapshot().player.x).toBe(16);
    expect(run.map.cells[0]).toBe('grass');
  });

  it('el jugador inicial no puede solapar una celda no caminable', () => {
    const cells = cellsWith(RULES, { '10,4': 'trunk' });
    const r = Run.start(
      CONFIG,
      new Mulberry32RandomGenerator(7),
      { player: { x: 590, y: 270 } },
      { kind: 'cells', cells },
    );
    expect(!r.ok && r.error).toEqual({
      code: 'invalid-config',
      field: 'setup.player',
      message: SETUP_PLAYER_ON_BLOCKED_CELL,
    });
  });

  it('TickRun.map() devuelve el mapa de la partida', () => {
    const started = new StartRun().execute(CONFIG, new Mulberry32RandomGenerator(7), undefined, {
      kind: 'cells',
      cells: cellsWith(RULES, { '0,0': 'water' }),
    });
    expect(started.ok && started.value.tickRun.map().cells[0]).toBe('water');
  });
});

// Spec procedural-map (0016), "Mapa explícito y mapa vacío", y player-movement, "Posición inicial en
// el punto de salida del mapa".
describe('Salida por mapa (0016)', () => {
  const cellsOf = (layout: Layout) => cellsWith(RULES, layout);

  it('Scenario: Partida con mapa vacío (2.304 grass, ningún castle, salida (1.920, 1.080))', () => {
    const map = start(OPEN_TERRAIN).map;
    expect(map.counts.grass).toBe(2304);
    expect(map.counts.castle).toBe(0);
    expect(map.castle).toBeNull();
    expect([map.start.x, map.start.y]).toEqual([1920, 1080]);
  });

  it('Scenario: Mapa explícito con salida declarada (vacío con salida (1.950, 1.170))', () => {
    const run = start(emptyWithExit(CONFIG));
    expect(run.map.counts.grass).toBe(2304);
    expect(run.map.start).toEqual({ x: 1950, y: 1170, radius: 180 });
    expect(run.map.castle).toBeNull();
    expect([run.snapshot().player.x, run.snapshot().player.y]).toEqual([1950, 1170]);
  });

  it.each([
    [630, 270],
    [590, 270],
    [10, 540],
    [Number.NaN, 540],
  ])('Scenario: Salida declarada ilegal ((%d, %d) con el tronco (10, 4))', (x, y) => {
    const terrain: TerrainSource = {
      kind: 'cells',
      cells: cellsOf({ '10,4': 'trunk' }),
      start: { x, y },
    };
    const r = Run.start(CONFIG, new Mulberry32RandomGenerator(7), {}, terrain);
    expect(!r.ok && r.error).toEqual({
      code: 'invalid-config',
      field: 'map.start',
      message: MAP_START_ILLEGAL,
    });
    expect(MAP_START_ILLEGAL).toContain('punto de salida');
  });

  it('Scenario: Salida declarada ilegal (la tangente (584, 270) sí vale)', () => {
    const terrain: TerrainSource = {
      kind: 'cells',
      cells: cellsOf({ '10,4': 'trunk' }),
      start: { x: 584, y: 270 },
    };
    const run = start(terrain);
    expect([run.snapshot().player.x, run.snapshot().player.y]).toEqual([584, 270]);
  });

  it('una salida declarada ilegal en el mapa vacío también falla (fuera del mundo)', () => {
    const r = Run.start(
      CONFIG,
      new Mulberry32RandomGenerator(7),
      {},
      {
        kind: 'open',
        start: { x: 3830, y: 1080 },
      },
    );
    expect(!r.ok && r.error.field).toBe('map.start');
  });

  it('Scenario: Mapa explícito con celdas de castillo ((3, 3) castle, salida (1.920, 1.080))', () => {
    const map = start({ kind: 'cells', cells: cellsOf({ '3,3': 'castle' }) }).map;
    expect(map.counts.castle).toBe(1);
    expect(map.cells[3 * 64 + 3]).toBe('castle');
    expect(map.castle).toBeNull();
    expect([map.start.x, map.start.y]).toEqual([1920, 1080]);
  });

  it('Scenario: Partida nueva con el mapa vacío (semilla 42: jugador en (1.920, 1.080))', () => {
    const player = startSeededRun(CONFIG, 42, 'empty').snapshot().player;
    expect([player.x, player.y]).toEqual([1920, 1080]);
  });

  it('Scenario: Mapa explícito con y sin salida declarada (tronco (3, 3))', () => {
    const cells = cellsOf({ '3,3': 'trunk' });
    const without = start({ kind: 'cells', cells }).snapshot().player;
    const declared = start({ kind: 'cells', cells, start: { x: 300, y: 900 } }).snapshot().player;
    expect([without.x, without.y]).toEqual([1920, 1080]);
    expect([declared.x, declared.y]).toEqual([300, 900]);
  });

  it('la zona de inicio de un mapa dado se centra en su salida', () => {
    const map = start({ kind: 'cells', cells: cellsOf({}), start: { x: 300, y: 900 } }).map;
    expect(map.start).toEqual({ x: 300, y: 900, radius: 180 });
  });

  it('la conectividad parte de la salida del mapa (columna 5 de agua parte el mapa)', () => {
    const river: Record<string, CellType> = {};
    for (let r = 0; r < RULES.rows; r++) river[`5,${String(r)}`] = 'water';
    const left = resolveTerrain(
      { kind: 'cells', cells: cellsOf(river), start: { x: 90, y: 90 } },
      RULES,
    );
    const right = resolveTerrain({ kind: 'cells', cells: cellsOf(river) }, RULES);
    if (!left.ok || !right.ok) throw new Error('mapa inválido');
    expect([reachableCells(left.value)[0], reachableCells(left.value)[10]]).toEqual([1, 0]);
    expect([reachableCells(right.value)[0], reachableCells(right.value)[10]]).toEqual([0, 1]);
  });
});

describe('Determinismo con el mapa (spec simulation-loop)', () => {
  it('Scenario: La colisión no consume azar (tangente a un tronco frente a hierba libre)', () => {
    const blockedRandom = new CountingRandom(new Mulberry32RandomGenerator(7));
    const freeRandom = new CountingRandom(new Mulberry32RandomGenerator(7));
    const blocked = start(
      { kind: 'cells', cells: cellsWith(RULES, { '10,4': 'trunk' }) },
      blockedRandom,
      {
        player: { x: 584, y: 270 },
      },
    );
    const free = start(OPEN_TERRAIN, freeRandom, { player: { x: 584, y: 270 } });
    const before = [blockedRandom.calls, freeRandom.calls];
    blocked.tick(PlayerInput.of(1, 0));
    free.tick(PlayerInput.of(1, 0));
    expect(blocked.snapshot().player.x).toBe(584);
    expect(free.snapshot().player.x).toBeGreaterThan(584);
    expect(before[0]).toBe(before[1]);
    expect(blockedRandom.calls).toBe(freeRandom.calls);
  });

  it('generar el mapa no consume el azar de la partida', () => {
    const random = new CountingRandom(new Mulberry32RandomGenerator(7));
    start(generated(7), random);
    expect(random.calls).toBe(0);
  });
});
