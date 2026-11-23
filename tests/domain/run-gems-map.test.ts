import { describe, expect, it } from 'vitest';
import type { CellType } from '../../src/domain/map/CellType';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { DEFAULT_PROGRESSION, TESTS, aDefaultConfig, withWeapons } from '../support/builders';
import { castleBlock, cellsWith, mapRules, type Layout } from '../support/mapLayouts';
import { CountingRandom } from '../support/random';
import { aContactConfig, aProbeType, ticks } from '../support/runs';
import { weaponsOf } from '../support/weapons';

// Spec xp-gems (0015), "Recolocación de gemas en celdas no caminables". Rejilla por defecto sobre
// el mundo de 1.920 × 1.080: el centro de la celda (c, r) es (60c + 30, 60r + 30).
const WORLD = aDefaultConfig().arena;
const RULES = mapRules();
const TRUNK_10_4: Layout = { '10,4': 'trunk' };

/** `goblin-torch` quieto: a 1e-300 px/s el paso del tick se redondea a 0 y muere donde está. */
const STILL_TORCH = aProbeType({ id: 'goblin-torch', speed: 1e-300, health: 10, xp: 1 });

/** Pulso de Tests que alcanza todo el mundo: las bajas mueren en el tick 1, donde están. */
const WIDE_PULSE = { ...TESTS, targeting: { mode: 'any-in-radius', radius: 4000 } } as const;

function config(maxGems = 300): RunConfig {
  const base = aContactConfig({ types: [STILL_TORCH] });
  return {
    ...withWeapons({ ...base, arena: WORLD }, weaponsOf([WIDE_PULSE])),
    progression: { ...DEFAULT_PROGRESSION, maxGems },
  };
}

function start(
  layout: Layout,
  setup: RunSetup,
  random: RandomGenerator = new Mulberry32RandomGenerator(7),
  maxGems?: number,
): Run {
  const cells: CellType[] = cellsWith(RULES, layout);
  const r = Run.start(config(maxGems), random, setup, { kind: 'cells', cells });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const torch = (x: number, y: number) => ({ type: 'goblin-torch', x, y, health: 4 });
const firstTick = (run: Run): RunSnapshot => {
  const [snap] = ticks(run, 1);
  if (!snap) throw new Error('sin snapshot');
  return snap;
};
const at = (snap: RunSnapshot) => snap.gems.map((g) => [g.x, g.y]);

describe('Recolocación de gemas en celdas no caminables (spec xp-gems)', () => {
  it('Scenario: Baja sobre un tronco (gema en (690, 270), centro de la celda (11, 4))', () => {
    const snap = firstTick(
      start(TRUNK_10_4, { player: { x: 960, y: 540 }, enemies: [torch(650, 270)] }),
    );
    expect(snap.enemies).toEqual([]);
    expect(at(snap)).toEqual([[690, 270]]);
  });

  it('Scenario: Empate entre celdas (gana la (10, 3), de fila menor, en (630, 210))', () => {
    const snap = firstTick(
      start(TRUNK_10_4, { player: { x: 960, y: 540 }, enemies: [torch(610, 250)] }),
    );
    expect(at(snap)).toEqual([[630, 210]]);
  });

  it('Scenario: Baja en un río ancho (filas 8–10 de agua: gema en (270, 450))', () => {
    const river: Record<string, CellType> = {};
    for (let c = 0; c < RULES.cols; c++) {
      for (const r of [8, 9, 10]) river[`${String(c)},${String(r)}`] = 'water';
    }
    const snap = firstTick(
      start(river, { player: { x: 960, y: 300 }, enemies: [torch(300, 560)] }),
    );
    expect(at(snap)).toEqual([[270, 450]]);
  });

  it('Scenario: Baja dentro del castillo (gema en (990, 330), gana a la (16, 10) por fila)', () => {
    const snap = firstTick(
      start(castleBlock(), { player: { x: 300, y: 900 }, enemies: [torch(990, 480)] }),
    );
    expect(snap.enemies).toEqual([]);
    expect(at(snap)).toEqual([[990, 330]]);
  });

  it('Scenario: Baja en hierba junto a un tronco (la gema conserva su punto)', () => {
    const snap = firstTick(
      start(TRUNK_10_4, { player: { x: 960, y: 540 }, enemies: [torch(590, 270)] }),
    );
    const [gem] = snap.gems;
    expect([gem?.x, gem?.y]).toEqual([590, 270]);
  });

  it('Scenario: Recolocar no consume azar (baja sobre un tronco frente a sobre hierba)', () => {
    const onTrunk = new CountingRandom(new Mulberry32RandomGenerator(7));
    const onGrass = new CountingRandom(new Mulberry32RandomGenerator(7));
    const setup = { player: { x: 960, y: 540 }, enemies: [torch(650, 270)] };
    firstTick(start(TRUNK_10_4, setup, onTrunk));
    firstTick(start({}, setup, onGrass));
    expect(onTrunk.calls).toBe(onGrass.calls);
  });

  it('Scenario: Gema recolocada recogida en el mismo tick (XP 1 ya en el tick)', () => {
    const snap = firstTick(
      start(TRUNK_10_4, { player: { x: 690, y: 285 }, enemies: [torch(650, 270)] }),
    );
    expect(snap.gems).toEqual([]);
    expect(snap.progression.xp).toBe(1);
  });

  it('Scenario: Varias bajas en el mismo tick, una sobre agua (a2 en (330, 270))', () => {
    const enemies = [torch(150, 330), torch(330, 330), torch(450, 450)];
    const snap = firstTick(start({ '5,5': 'water' }, { player: { x: 960, y: 540 }, enemies }));
    expect(snap.gems.map((g) => g.id)).toEqual([0, 1, 2]);
    const a2 = snap.gems[1];
    expect([a2?.x, a2?.y]).toEqual([330, 270]);
  });

  it('con el tope lleno no se recoloca nada: la XP va a la gema más antigua', () => {
    const gems = [{ x: 20, y: 1060, value: 1 }];
    const snap = firstTick(
      start(
        TRUNK_10_4,
        { player: { x: 960, y: 540 }, gems, enemies: [torch(650, 270)] },
        undefined,
        1,
      ),
    );
    expect(snap.gems.map((g) => [g.id, g.x, g.y])).toEqual([[0, 20, 1060]]);
  });

  it('una gema inicial del RunSetup sobre un tronco también se recoloca', () => {
    const run = start(TRUNK_10_4, {
      player: { x: 960, y: 540 },
      gems: [{ x: 650, y: 270, value: 1 }],
    });
    expect(at(run.snapshot())).toEqual([[690, 270]]);
  });
});
