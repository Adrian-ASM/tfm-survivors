import { describe, expect, it } from 'vitest';
import { StartRun } from '../../src/application/StartRun';
import type { CellType } from '../../src/domain/map/CellType';
import { OPEN_TERRAIN, type TerrainSource } from '../../src/domain/map/TerrainSource';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import { SETUP_PLAYER_ON_BLOCKED_CELL } from '../../src/domain/run/RunSetup';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { MAP_STREAM, deriveSeed } from '../../src/infrastructure/random/deriveSeed';
import { aDefaultConfig } from '../support/builders';
import { cellsWith, mapRules } from '../support/mapLayouts';
import { mapForSeed, typesOf } from '../support/mapStats';
import { advance, play, ticks } from '../support/runs';
import { CountingRandom } from '../support/random';

const CONFIG = aDefaultConfig();
const RULES = mapRules();

const generated = (seed: number): TerrainSource => ({
  kind: 'generated',
  random: new Mulberry32RandomGenerator(deriveSeed(seed, MAP_STREAM)),
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
  it('Scenario: Rejilla por defecto (partida: 32 × 18 celdas de 60 px)', () => {
    const map = start(OPEN_TERRAIN).map;
    expect([map.cols, map.rows, map.cellSize, map.cells.length]).toEqual([32, 18, 60, 576]);
  });

  it('Scenario: Partida con mapa vacío (semilla 7: 576 celdas grass)', () => {
    const map = start(OPEN_TERRAIN).map;
    expect(map.counts).toEqual({ grass: 576, trunk: 0, water: 0, bridge: 0, castle: 0 });
    expect(map.start).toEqual({ x: 960, y: 540, radius: 180 });
  });

  it('el mapa generado de la partida es el de generateMap con la semilla derivada', () => {
    const map = start(generated(42)).map;
    expect(map.cells).toEqual(typesOf(mapForSeed(CONFIG, 42)));
    const total = map.counts.grass + map.counts.trunk + map.counts.water + map.counts.bridge;
    expect(total).toBe(576);
    expect(map.counts.trunk).toBe(map.cells.filter((t) => t === 'trunk').length);
  });

  it('Scenario: Mapa de dimensiones incorrectas (30 × 17: la partida no se crea)', () => {
    const cells = cellsWith(mapRules(undefined, 1800, 1020), {});
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
