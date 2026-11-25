import { describe, expect, it } from 'vitest';
import type { CellType } from '../../src/domain/map/CellType';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { PickupSnapshot, RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';
import {
  aBarrelType,
  aStillType,
  withDrops,
  withGoldPerKill,
  withStoneChance,
  withWeapons,
} from '../support/builders';
import { HOUSE_AT_20_10, aCampScenario, startOn } from '../support/camps';
import { cellsWith, mapRules } from '../support/mapLayouts';
import { CountingRandom, ScriptedRandom, StubRandom } from '../support/random';
import { aBehaviorConfig, startRun, ticks } from '../support/runs';
import { aLinter, aPulse, weaponsOf } from '../support/weapons';

// Spec resources (0025), "Piedra por enemigo abatido"; xp-gems, "Tope de gemas en el suelo"; y
// simulation-loop, paso 3.3. Mapa vacío, sin oleadas; jugador de radio 16 con radio de recogida 1 en
// (1.000, 1.000), lejos de las bajas.

const P = { x: 1000, y: 1000 };
const TORCH = aStillType({ id: 'goblin-torch', health: 10, xp: 1 });
const TNT = aStillType({ id: 'goblin-tnt', health: 4, xp: 2 });
const GUARD = aStillType({ id: 'goblin-tnt-guard', health: 4, xp: 3 });
const LINTER = weaponsOf([aLinter()]);
const PULSE = weaponsOf([aPulse()]);

const config = (
  stone: Record<string, number>,
  o: { weapons?: typeof LINTER; gold?: Record<string, number>; wood?: number } = {},
): RunConfig => {
  const base = withWeapons(
    aBehaviorConfig([TORCH, TNT, GUARD, aBarrelType()]),
    o.weapons ?? LINTER,
  );
  const drops = withGoldPerKill(withDrops(base, { wood: o.wood ?? 2 }), o.gold ?? {});
  return withStoneChance(drops, stone);
};
const withMaxStone = (c: RunConfig, maxStone: number): RunConfig => ({
  ...c,
  progression: { ...c.progression, maxStone },
});
const run = (c: RunConfig, setup: RunSetup, stones: RandomGenerator) =>
  startRun(c, { player: P, ...setup }, undefined, stones);

const at = (snaps: readonly RunSnapshot[], k: number): RunSnapshot => {
  const s = snaps[k - 1];
  if (!s) throw new Error(`sin snapshot del tick ${String(k)}`);
  return s;
};
/** Primer tick (desde 1) sin enemigos vivos. */
const lastKill = (snaps: readonly RunSnapshot[]) => snaps.findIndex((s) => !s.enemies.length) + 1;
const drops = (s: RunSnapshot | undefined) =>
  (s?.pickups ?? []).map((p): [PickupSnapshot['kind'], number] => [p.kind, p.value]);
const stonesOf = (s: RunSnapshot | undefined) =>
  (s?.pickups ?? []).filter((p) => p.kind === 'stone');
/** Recogibles de `after` creados después de los de `before` (por id). */
const fresh = (before: RunSnapshot | undefined, after: RunSnapshot | undefined) => {
  const last = Math.max(-1, ...(before?.pickups ?? []).map((p) => p.id));
  return (after?.pickups ?? []).filter((p) => p.id > last);
};

describe('Piedra por enemigo abatido (resources 0025)', () => {
  it('Scenario: Tipo con 100 suelta siempre (gema y piedra de valor 1 en su punto, la gema antes)', () => {
    const stones = new CountingRandom(new StubRandom(0.5));
    const r = run(
      config({ 'goblin-torch': 100 }),
      { enemies: [{ type: 'goblin-torch', x: 1200, y: 1000, health: 4 }] },
      stones,
    );
    const snaps = ticks(r, 120);
    const n = lastKill(snaps);
    const s = at(snaps, n);
    const [gem, stone] = s.pickups;

    expect(at(snaps, n - 1).pickups).toEqual([]);
    expect(drops(s)).toEqual([
      ['xp', 1],
      ['stone', 1],
    ]);
    expect(stone?.source).toBe('goblin-torch');
    expect([stone?.x, stone?.y]).toEqual([gem?.x, gem?.y]);
    expect((gem?.id ?? 0) < (stone?.id ?? 0)).toBe(true);
    expect(stones.calls).toBe(1);
  });

  it('Scenario: Tipo con 0 consume y no suelta (20 goblin-tnt por armas: 20 valores)', () => {
    const stones = new CountingRandom(new StubRandom(0));
    const enemies = Array.from({ length: 20 }, (_, i) => ({
      type: 'goblin-tnt',
      x: 1100 + 10 * i,
      y: 1000,
    }));
    const snaps = ticks(run(config({ 'goblin-tnt': 0 }), { enemies }, stones), 900);
    const kills = snaps.map((s) => s.kills);

    expect(kills.at(-1)).toBe(20);
    expect(new Set(kills).size).toBe(21);
    expect(snaps.some((s) => stonesOf(s).length > 0)).toBe(false);
    expect(stones.calls).toBe(20);
  });

  it('Scenario: Orden con el barril abatido (gema, wood 2, gold 3 y stone de goblin-barrel)', () => {
    const still = aBarrelType({ speed: 1e-6 });
    const base = withWeapons(aBehaviorConfig([TORCH, still]), LINTER);
    const c = withStoneChance(
      withGoldPerKill(withDrops(base, { wood: 2 }), { 'goblin-barrel': 3 }),
      { 'goblin-barrel': 100 },
    );
    const snaps = ticks(
      run(
        c,
        { enemies: [{ type: 'goblin-barrel', x: 1200, y: 1000, health: 4 }] },
        new StubRandom(0),
      ),
      120,
    );
    const s = at(snaps, lastKill(snaps));

    expect(drops(s)).toEqual([
      ['xp', 2],
      ['wood', 2],
      ['gold', 3],
      ['stone', 1],
    ]);
    expect(stonesOf(s)[0]?.source).toBe('goblin-barrel');
    expect(new Set(s.pickups.map((p) => `${String(p.x)},${String(p.y)}`)).size).toBe(1);
  });

  it('Scenario: Piedra por baja intercalada (xp T, stone T, xp N, stone N en el mismo pulso)', () => {
    const c = config({ 'goblin-torch': 100, 'goblin-tnt': 100 }, { weapons: PULSE });
    const [s] = ticks(
      run(
        c,
        {
          enemies: [
            { type: 'goblin-torch', x: 1040, y: 1000, health: 4 },
            { type: 'goblin-tnt', x: 960, y: 1000 },
          ],
        },
        new StubRandom(0),
      ),
      1,
    );

    expect(s?.kills).toBe(2);
    expect(s?.pickups.map((p) => [p.kind, p.source ?? null])).toEqual([
      ['xp', null],
      ['stone', 'goblin-torch'],
      ['xp', null],
      ['stone', 'goblin-tnt'],
    ]);
  });

  it('Scenario: Piedra sobre un tronco (gema y piedra en (690, 270), la gema antes)', () => {
    const c = config({ 'goblin-torch': 100 }, { weapons: PULSE });
    const cells: CellType[] = cellsWith(mapRules(), { '10,4': 'trunk' });
    const r = startOn(
      c,
      { kind: 'cells', cells },
      {
        player: { x: 650, y: 330 },
        enemies: [{ type: 'goblin-torch', x: 650, y: 270, health: 4 }],
      },
      undefined,
      new StubRandom(0),
    );
    const s = at(ticks(r, 600), 600);

    expect(s.kills).toBe(1);
    expect(s.pickups.map((p) => [p.kind, p.x, p.y])).toEqual([
      ['xp', 690, 270],
      ['stone', 690, 270],
    ]);
  });

  it('Scenario: Tirada con el tope de piedra lleno (maxStone 1: s1 vale 2; 1 valor)', () => {
    const stones = new CountingRandom(new StubRandom(0));
    const r = run(
      withMaxStone(config({ 'goblin-torch': 100 }), 1),
      {
        enemies: [{ type: 'goblin-torch', x: 1200, y: 1000, health: 4 }],
        gems: [{ kind: 'stone', x: 3000, y: 200, value: 1 }],
      },
      stones,
    );
    const snaps = ticks(r, 120);
    const s = at(snaps, lastKill(snaps));

    expect(stonesOf(s).map((p) => [p.id, p.value])).toEqual([[0, 2]]);
    expect(stones.calls).toBe(1);
  });

  it.each([
    [0, [false, true, true]],
    [60, [true, true, true]],
  ])(
    'Scenario: La probabilidad de un tipo no desplaza las tiradas de los demás (tnt %i)',
    (tnt, expected) => {
      const stones = new ScriptedRandom([0.5, 0.05, 0.05]);
      const r = run(
        config({ 'goblin-tnt': tnt, 'goblin-torch': 10 }),
        {
          enemies: [
            { type: 'goblin-tnt', x: 1100, y: 1000 },
            { type: 'goblin-torch', x: 1200, y: 1000, health: 4 },
            { type: 'goblin-torch', x: 1300, y: 1000, health: 4 },
          ],
        },
        stones,
      );
      const snaps = ticks(r, 600);
      const dropped = [1, 2, 3].map((k) => {
        const n = snaps.findIndex((s) => s.kills === k);
        return fresh(snaps[n - 1], snaps[n]).some((p) => p.kind === 'stone');
      });

      expect(dropped).toEqual(expected);
      expect(stones.calls).toBe(3);
    },
  );
});

// Spec xp-gems (0025), "Tope de gemas en el suelo" y "Recogibles con tipo".
describe('Piedra en el tope y en la secuencia de recogibles (xp-gems)', () => {
  it('Scenario: Tope de piedra lleno (maxStone 2: s1 de goblin-tnt-guard vale 3, s2 1)', () => {
    const c = withMaxStone(config({ 'goblin-torch': 100 }, { weapons: PULSE }), 2);
    const r = run(
      c,
      {
        enemies: [
          { type: 'goblin-torch', x: 1040, y: 1000, health: 4 },
          { type: 'goblin-torch', x: 960, y: 1000, health: 4 },
        ],
        gems: [
          { kind: 'stone', x: 3000, y: 200, value: 1, source: 'goblin-tnt-guard' },
          { kind: 'stone', x: 3000, y: 300, value: 1, source: 'goblin-torch' },
        ],
      },
      new StubRandom(0),
    );
    const [s] = ticks(r, 1);

    expect(s?.kills).toBe(2);
    expect(stonesOf(s).map((p) => [p.id, p.value, p.source])).toEqual([
      [0, 3, 'goblin-tnt-guard'],
      [1, 1, 'goblin-torch'],
    ]);
    expect(s?.gems).toHaveLength(2);
  });

  it('Scenario: Una secuencia de identificadores (xp torch, xp barril, wood, stone, gold torre)', () => {
    const barrel = aBarrelType({ health: 4 });
    const types = [aStillType({ id: 'goblin-torch', health: 4 }), barrel];
    const camp = withDrops(withWeapons(aCampScenario({ types, tower: { health: 4 } }), PULSE), {
      tower: 8,
      wood: 2,
    });
    const tower = { ...HOUSE_AT_20_10, type: 'goblin-tower' };
    const r = startOn(
      withStoneChance(camp, { 'goblin-barrel': 100 }),
      { kind: 'open', structures: [tower] },
      {
        player: { x: 1260, y: 760 },
        enemies: [
          { type: 'goblin-torch', x: 1260, y: 810 },
          { type: 'goblin-barrel', x: 1300, y: 810 },
        ],
      },
      undefined,
      new StubRandom(0),
    );
    const [s] = ticks(r, 1);

    expect(s?.pickups.map((p) => p.kind)).toEqual(['xp', 'xp', 'wood', 'stone', 'gold']);
    expect(new Set(s?.pickups.map((p) => p.id)).size).toBe(5);
  });
});

// Spec simulation-loop (0025), paso 3.3: la piedra de la baja tras su oro y antes que la estructura.
describe('Piedra de la baja en el paso de armas (simulation-loop)', () => {
  it('Scenario: Piedra de la baja tras su oro y antes de la estructura', () => {
    const camp = withDrops(
      withWeapons(aCampScenario({ types: [TORCH], tower: { health: 4 } }), PULSE),
      { tower: 8 },
    );
    const c = withStoneChance(withGoldPerKill(camp, { 'goblin-torch': 2 }), {
      'goblin-torch': 100,
    });
    const tower = { ...HOUSE_AT_20_10, type: 'goblin-tower' };
    const r = startOn(
      c,
      { kind: 'open', structures: [tower] },
      {
        player: { x: 1260, y: 760 },
        enemies: [{ type: 'goblin-torch', x: 1300, y: 760, health: 4 }],
      },
      undefined,
      new StubRandom(0),
    );
    const [s] = ticks(r, 1);

    expect(s?.structures[0]).toMatchObject({ destroyed: true });
    expect(drops(s)).toEqual([
      ['xp', 1],
      ['gold', 2],
      ['stone', 1],
      ['gold', 8],
    ]);
  });
});
