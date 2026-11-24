import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import { SETUP_STRUCTURE_HEALTH_OUT_OF_RANGE } from '../../src/domain/run/RunSetup';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  HOUSE_AT_20_10,
  aCampScenario,
  aCampsConfig,
  startCampRun,
  startDeclared,
} from '../support/camps';
import { ticks } from '../support/runs';

const TOWER = { type: 'goblin-tower', col: 40, row: 5, cols: 2, rows: 2 } as const;
const PLAYER = { x: 3000, y: 2000 };

describe('Run · estructuras en el snapshot (goblin-structures, simulation-loop)', () => {
  it('Scenario: Lista inicial', () => {
    const run = startCampRun(aCampsConfig(), 42);
    const list = run.snapshot().structures;
    expect(list).toHaveLength(7);
    expect(new Set(list.map((s) => s.id)).size).toBe(7);
    const health = { 'goblin-house': 60, 'goblin-tower': 90 } as Record<string, number>;
    expect(list.every((s) => s.health === health[s.type] && !s.destroyed)).toBe(true);
  });

  it('Scenario: Estructuras en el snapshot del motor', () => {
    const run = startDeclared(aCampScenario(), [HOUSE_AT_20_10]);
    expect(run.snapshot().structures).toEqual([
      {
        id: 0,
        type: 'goblin-house',
        x: 1260,
        y: 690,
        radius: 40,
        col: 20,
        row: 10,
        cols: 2,
        rows: 3,
        health: 30,
        destroyed: false,
      },
    ]);
  });

  it('Scenario: Orden estable tras destruir', () => {
    const declared = [HOUSE_AT_20_10, TOWER, { ...TOWER, col: 50 }];
    const run = startDeclared(aCampScenario(), declared, {
      player: PLAYER,
      structures: [{}, { health: 0 }, {}],
    });
    const [s] = ticks(run, 1);
    expect(s?.structures.map((x) => [x.id, x.destroyed, x.health])).toEqual([
      [0, false, 30],
      [1, true, 0],
      [2, false, 90],
    ]);
  });

  it('Scenario: Lista no mutable', () => {
    const run = startDeclared(aCampScenario(), [HOUSE_AT_20_10, TOWER], { player: PLAYER });
    ticks(run, 10);
    const snap = run.snapshot();
    const before = structuredClone(snap.structures);
    const mutations = [
      () => ((snap.structures[0] as { health: number }).health = 0),
      () => ((snap.structures[0] as { destroyed: boolean }).destroyed = true),
      () => ((snap.structures as unknown[]).length = 0),
    ];
    for (const m of mutations) expect(m).toThrow(TypeError);
    run.tick(PlayerInput.NONE);
    expect(run.snapshot().structures).toEqual(before);
    expect(run.snapshot().tick).toBe(11);
  });

  it('Scenario: Partida recién creada (lista de estructuras)', () => {
    expect(startDeclared(aCampScenario(), []).snapshot().structures).toEqual([]);
    const generated = startCampRun(aCampsConfig(), 7).snapshot().structures;
    expect(generated).toHaveLength(7);
    expect(generated.some((s) => s.destroyed)).toBe(false);
  });

  it('la vida inicial de una estructura de RunSetup va de 0 (ruina) a la de su tipo', () => {
    const config = aCampScenario();
    const random = new Mulberry32RandomGenerator(1);
    const terrain = { kind: 'open', structures: [HOUSE_AT_20_10] } as const;
    for (const health of [-1, 31, Number.NaN]) {
      const r = Run.start(config, random, { structures: [{ health }] }, terrain);
      if (r.ok) throw new Error('se esperaba un error');
      expect(r.error.field).toBe('setup.structures.0.health');
      expect(r.error.message).toContain(SETUP_STRUCTURE_HEALTH_OUT_OF_RANGE);
    }
    const extra = Run.start(config, random, { structures: [{}, {}] }, terrain);
    expect(extra.ok).toBe(false);
  });
});
