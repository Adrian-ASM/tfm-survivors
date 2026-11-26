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
import { LINTER, withWeapons } from '../support/builders';
import { untilHit } from '../support/combat';
import { ticks } from '../support/runs';
import { weaponsOf } from '../support/weapons';

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
    // 0031: vida máxima 60 en las casas y 90 en las torres, igual a la actual.
    expect(list.every((s) => s.maxHealth === health[s.type] && s.maxHealth === s.health)).toBe(
      true,
    );
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
        maxHealth: 30,
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
    expect(s?.structures.map((x) => [x.id, x.destroyed, x.health, x.maxHealth])).toEqual([
      [0, false, 30, 30],
      [1, true, 0, 90],
      [2, false, 90, 90],
    ]);
  });

  it('Scenario: Lista no mutable', () => {
    const run = startDeclared(aCampScenario(), [HOUSE_AT_20_10, TOWER], { player: PLAYER });
    ticks(run, 10);
    const snap = run.snapshot();
    const before = structuredClone(snap.structures);
    const mutations = [
      () => ((snap.structures[0] as { health: number }).health = 0),
      () => ((snap.structures[0] as { maxHealth: number }).maxHealth = 1),
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

  it('Scenario: Vida máxima tras el daño y en ruina', () => {
    const linter = withWeapons(aCampScenario({ house: { health: 60 } }), weaponsOf([LINTER]));
    const house = startDeclared(linter, [HOUSE_AT_20_10], { player: { x: 1260, y: 990 } });
    let hits = 0;
    let s = house.snapshot();
    while (hits < 5) {
      s = untilHit(house);
      hits += 1;
    }
    expect([s.structures[0]?.health, s.structures[0]?.maxHealth]).toEqual([30, 60]);
    const towerConfig = withWeapons(aCampScenario(), weaponsOf([LINTER]));
    const tower = startDeclared(towerConfig, [{ ...HOUSE_AT_20_10, type: 'goblin-tower' }], {
      player: { x: 1260, y: 990 },
      structures: [{ health: 1 }],
    });
    const ruin = untilHit(tower);
    const later = [ruin, ...ticks(tower, 600)].map((x) => x.structures[0]);
    expect(later.every((t) => t?.destroyed && t.health === 0 && t.maxHealth === 90)).toBe(true);
  });

  it('Scenario: Vida máxima de una estructura declarada', () => {
    const [house] = startDeclared(aCampScenario(), [HOUSE_AT_20_10]).snapshot().structures;
    expect([house?.health, house?.maxHealth]).toEqual([30, 30]);
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
