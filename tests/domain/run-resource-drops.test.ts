import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { PickupSnapshot, RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  aBarrelType,
  aDynamite,
  aSegment,
  aStillType,
  inState,
  withDrops,
  withWeapons,
} from '../support/builders';
import { HOUSE_AT_20_10, aCampScenario, startDeclared, startOn } from '../support/camps';
import { cellsWith, mapRules } from '../support/mapLayouts';
import { CountingRandom } from '../support/random';
import { aBehaviorConfig, startRun, ticks } from '../support/runs';
import { aLinter, aPulse, weaponsOf } from '../support/weapons';

// Fuentes de oro y madera de 0022 (spec enemy-hazards "Madera del barril abatido",
// goblin-structures "Vida, destrucción y ruina", xp-gems y simulation-loop). Mapa vacío.

const P = { x: 1000, y: 1000 };
const TORCH = aStillType({ id: 'goblin-torch', health: 10, xp: 1 });
const LINTER = weaponsOf([aLinter()]);
const PULSE = weaponsOf([aPulse()]);

const at = (snaps: readonly RunSnapshot[], k: number): RunSnapshot => {
  const s = snaps[k - 1];
  if (!s) throw new Error(`sin snapshot del tick ${String(k)}`);
  return s;
};
const kinds = (s: RunSnapshot | undefined) => (s?.pickups ?? []).map((p) => p.kind);
const ofKind = (s: RunSnapshot | undefined, kind: PickupSnapshot['kind']) =>
  (s?.pickups ?? []).filter((p) => p.kind === kind);

const config = (
  o: Parameters<typeof aBehaviorConfig>[1] = {},
  extra: RunConfig['enemies']['types'] = [],
) => withDrops(aBehaviorConfig([TORCH, aBarrelType(), ...extra], o), { wood: 2 });
const run = (setup: RunSetup, c: RunConfig = config()) => startRun(c, { player: P, ...setup });

/** Primer tick en que la vida del enemigo 0 baja con el Linter (sondeo, como run-hazard-order). */
function firstHit(c: RunConfig, setup: RunSetup): number {
  const snaps = ticks(run(setup, c), 120);
  const k = snaps.findIndex(
    (s) => (s.enemies[0]?.health ?? 0) < (snaps[0]?.enemies[0]?.health ?? 0),
  );
  if (k < 0) throw new Error('el Linter no impacta');
  return k + 1;
}

describe('Madera del barril abatido (enemy-hazards)', () => {
  it('Scenario: Barril abatido por armas (gema 2 y madera 2 en su punto, gema antes; bajas 6)', () => {
    const still = aBarrelType({ speed: 1e-6 });
    const c = withDrops(withWeapons(aBehaviorConfig([TORCH, still]), LINTER), { wood: 2 });
    const snaps = ticks(
      startRun(c, {
        player: P,
        kills: 5,
        enemies: [{ type: 'goblin-barrel', x: 1200, y: 1000, health: 4 }],
      }),
      120,
    );
    const n = snaps.findIndex((s) => s.enemies.length === 0) + 1;
    expect(n).toBeGreaterThan(1);
    const s = at(snaps, n);
    expect(at(snaps, n - 1).pickups).toEqual([]);
    expect(s.pickups.map((p) => [p.kind, p.value])).toEqual([
      ['xp', 2],
      ['wood', 2],
    ]);
    const [gem, wood] = s.pickups;
    expect(gem?.x).toBeCloseTo(1200, 3);
    expect([wood?.x, wood?.y]).toEqual([gem?.x, gem?.y]);
    expect((gem?.id ?? 0) < (wood?.id ?? 0)).toBe(true);
    expect(s.kills).toBe(6);
  });

  it('Scenario: Barril que detona su mecha (1 gema y ninguna madera en el tick 82)', () => {
    const s = at(ticks(run({ enemies: [{ type: 'goblin-barrel', x: 1100, y: 1000 }] }), 82), 82);
    expect(s.blasts).toHaveLength(1);
    expect(kinds(s)).toEqual(['xp']);
  });

  it('Scenario: Barril en mecha abatido por armas en el tick de su explosión', () => {
    const X = { x: 1039.333, y: 1000 };
    const c = withWeapons(config(), LINTER);
    const h = firstHit(c, { enemies: [{ type: 'goblin-barrel', ...X, ...inState('fuse') }] });
    const r = run(
      { enemies: [{ type: 'goblin-barrel', ...X, health: 4, ...inState('fuse', 30 - h) }] },
      c,
    );
    const s = at(ticks(r, h), h);
    expect([s.blasts.length, s.player.health, s.kills]).toEqual([0, 100, 1]);
    expect(kinds(s)).toEqual(['xp', 'wood']);
  });

  it('Scenario: Barril en mecha abatido por una explosión ajena (gema y madera)', () => {
    const B = { x: 1500, y: 1000 };
    const s = at(
      ticks(
        run({
          enemies: [{ type: 'goblin-barrel', ...B, ...inState('fuse', 15) }],
          dynamites: [aDynamite(B, 5, { damage: 25 })],
        }),
        5,
      ),
      5,
    );
    expect(s.enemies).toEqual([]);
    expect(s.blasts).toHaveLength(1);
    expect(kinds(s)).toEqual(['xp', 'wood']);
  });

  it('Scenario: Barril que explota y recibe daño mortal en el mismo tick (2 gemas, 0 madera)', () => {
    const s = at(
      ticks(
        run({
          enemies: [
            { type: 'goblin-barrel', x: 1500, y: 1000, ...inState('fuse', 29) },
            { type: 'goblin-barrel', x: 1530, y: 1000, ...inState('fuse', 29) },
          ],
        }),
        1,
      ),
      1,
    );
    expect(s.blasts).toHaveLength(2);
    expect(kinds(s)).toEqual(['xp', 'xp']);
  });

  it('Scenario: Otros tipos no sueltan madera (4 gemas y ninguna madera)', () => {
    const tnt = aStillType({ id: 'goblin-tnt', health: 4, xp: 4 });
    const guard = aStillType({ id: 'goblin-tnt-guard', health: 4, xp: 4 });
    const c = withWeapons(config({}, [tnt, guard]), PULSE);
    const s = at(
      ticks(
        run(
          {
            enemies: [
              { type: 'goblin-torch', x: 1040, y: 1000, health: 4 },
              { type: 'goblin-tnt', x: 960, y: 1000 },
              { type: 'goblin-tnt-guard', x: 1000, y: 1040 },
              { type: 'goblin-torch', x: 1800, y: 1000 },
            ],
            dynamites: [aDynamite({ x: 1800, y: 1000 }, 1, { damage: 25 })],
          },
          c,
        ),
        1,
      ),
      1,
    );
    expect(s.enemies).toEqual([]);
    expect(kinds(s)).toEqual(['xp', 'xp', 'xp', 'xp']);
  });

  it('Scenario: La madera no consume azar (abatido por armas o detonado: mismo azar)', () => {
    const X = { x: 1039.333, y: 1000 };
    const c = {
      ...withWeapons(config(), LINTER),
      waves: aBehaviorConfig([TORCH], { segments: [aSegment(['goblin-torch'], 30)] }).waves,
    };
    const h = firstHit(c, { enemies: [{ type: 'goblin-barrel', ...X, ...inState('fuse') }] });
    const byWeapon = new CountingRandom(new Mulberry32RandomGenerator(7));
    const byFuse = new CountingRandom(new Mulberry32RandomGenerator(7));
    const barrel = { type: 'goblin-barrel', ...X, ...inState('fuse', 30 - h) };
    const a = startRun(c, { player: P, enemies: [{ ...barrel, health: 4 }] }, byWeapon);
    const b = startRun(c, { player: P, enemies: [barrel] }, byFuse);
    const sa = at(ticks(a, h), h);
    const sb = at(ticks(b, h), h);
    expect([ofKind(sa, 'wood').length, sb.blasts.length]).toEqual([1, 1]);
    expect(byWeapon.calls).toBe(byFuse.calls);
    expect(byWeapon.next()).toBe(byFuse.next());
  });
});

describe('Gema y madera por baja (xp-gems)', () => {
  it('Scenario: Gema y madera intercaladas por baja (B1, T, B2 en un pulso)', () => {
    const still = aBarrelType({ speed: 1e-6 });
    const c = withDrops(withWeapons(aBehaviorConfig([TORCH, still]), PULSE), { wood: 2 });
    const [s] = ticks(
      run(
        {
          enemies: [
            { type: 'goblin-barrel', x: 1060, y: 1000, health: 4 },
            { type: 'goblin-torch', x: 940, y: 1000, health: 4 },
            { type: 'goblin-barrel', x: 1000, y: 1060, health: 4 },
          ],
        },
        c,
      ),
      1,
    );
    expect(s?.pickups.map((p) => [p.kind, Math.round(p.x), Math.round(p.y)])).toEqual([
      ['xp', 1060, 1000],
      ['wood', 1060, 1000],
      ['xp', 940, 1000],
      ['xp', 1000, 1060],
      ['wood', 1000, 1060],
    ]);
    const ids = s?.pickups.map((p) => p.id) ?? [];
    expect(ids).toEqual([...ids].sort((x, y) => x - y));
  });

  it('Scenario: Madera del barril recogida en su tick (XP incluye 2 y madera 2)', () => {
    const c = withWeapons(config(), PULSE);
    const [s] = ticks(
      run({ enemies: [{ type: 'goblin-barrel', x: 1010, y: 1000, health: 4 }] }, c),
      1,
    );
    expect(s?.enemies).toEqual([]);
    expect(s?.pickups).toEqual([]);
    expect(s?.progression.xp).toBe(2);
    expect(s?.resources.wood).toBe(2);
  });

  it('Scenario: Barril abatido sobre un tronco (gema y madera en (690, 270), gema antes)', () => {
    const still = aBarrelType({ speed: 1e-6 });
    const wide = weaponsOf([aPulse({ targeting: { mode: 'any-in-radius', radius: 2000 } })]);
    const c = withDrops(withWeapons(aBehaviorConfig([TORCH, still]), wide), { wood: 1 });
    const cells = cellsWith(mapRules(), { '10,4': 'trunk' });
    const r = startOn(
      c,
      { kind: 'cells', cells },
      {
        player: { x: 1500, y: 1000 },
        enemies: [{ type: 'goblin-barrel', x: 650, y: 270, health: 4 }],
      },
    );
    const [s] = ticks(r, 1);
    expect(s?.pickups.map((p) => [p.kind, p.x, p.y])).toEqual([
      ['xp', 690, 270],
      ['wood', 690, 270],
    ]);
  });
});

const TOWER_AT_22_10 = { ...HOUSE_AT_20_10, type: 'goblin-tower', col: 22 };
const UNDER_HOUSE = { x: 1260, y: 1000 };

/** Primer tick (índice + 1) en que la estructura `i` figura destruida. */
const destroyedAt = (snaps: readonly RunSnapshot[], i = 0) =>
  snaps.findIndex((s) => s.structures[i]?.destroyed) + 1;

describe('Oro de las estructuras (goblin-structures, simulation-loop)', () => {
  const camp = (o: Parameters<typeof aCampScenario>[0], gold: { house?: number; tower?: number }) =>
    withDrops(withWeapons(aCampScenario(o), LINTER), gold);

  it('Scenario: Daño que no destruye (vida 24 y ningún oro)', () => {
    const run30 = startDeclared(camp({}, { house: 25 }), [HOUSE_AT_20_10], { player: UNDER_HOUSE });
    const snaps = ticks(run30, 60);
    const k = snaps.findIndex((s) => (s.structures[0]?.health ?? 30) < 30);
    expect(snaps[k]?.structures[0]).toMatchObject({ health: 24, destroyed: false });
    expect(snaps.every((s) => ofKind(s, 'gold').length === 0)).toBe(true);
  });

  it('Scenario: Oro de una casa destruida (1 gold de 25 en (1.260, 690); oro a 0)', () => {
    const r = startDeclared(camp({ house: { health: 6 } }, { house: 25 }), [HOUSE_AT_20_10], {
      player: UNDER_HOUSE,
    });
    const snaps = ticks(r, 40);
    const n = destroyedAt(snaps);
    expect(ofKind(at(snaps, n - 1), 'gold')).toEqual([]);
    expect(ofKind(at(snaps, n), 'gold')).toMatchObject([{ value: 25, x: 1260, y: 690 }]);
    expect(at(snaps, n).resources.gold).toBe(0);
  });

  it('Scenario: Oro de una torre recogido (al solaparlo, el oro vale 15)', () => {
    const tower = { ...HOUSE_AT_20_10, type: 'goblin-tower' };
    const r = startDeclared(camp({ tower: { health: 4 } }, { tower: 15 }), [tower], {
      player: UNDER_HOUSE,
    });
    const snaps = ticks(r, 40);
    const n = destroyedAt(snaps);
    expect(ofKind(at(snaps, n), 'gold')).toHaveLength(1);
    const after = ticks(r, 120, PlayerInput.of(0, -1));
    const m = after.findIndex((s) => s.pickups.length === 0);
    expect(m).toBeGreaterThanOrEqual(0);
    expect(after[m - 1]?.resources.gold ?? 0).toBe(0);
    expect(after[m]?.resources.gold).toBe(15);
  });

  it('Scenario: Dos estructuras destruidas en el mismo tick (gema, gold casa, gold torre)', () => {
    const c = withDrops(
      withWeapons(
        aCampScenario({ types: [TORCH], house: { health: 4 }, tower: { health: 4 } }),
        PULSE,
      ),
      { house: 5, tower: 8 },
    );
    const r = startDeclared(c, [HOUSE_AT_20_10, TOWER_AT_22_10], {
      player: { x: 1320, y: 740 },
      kills: 2,
      enemies: [{ type: 'goblin-torch', x: 1320, y: 780, health: 4 }],
    });
    const [s] = ticks(r, 1);
    expect(s?.structures.map((x) => x.destroyed)).toEqual([true, true]);
    expect(s?.pickups.map((p) => [p.kind, p.value])).toEqual([
      ['xp', 1],
      ['gold', 5],
      ['gold', 8],
    ]);
    expect(s?.kills).toBe(3);
  });

  it('Scenario: Las estructuras se destruyen tras las bajas (gold creado tras la gema)', () => {
    const c = withDrops(
      withWeapons(aCampScenario({ types: [TORCH], tower: { health: 4 } }), PULSE),
      { tower: 8 },
    );
    const tower = { ...HOUSE_AT_20_10, type: 'goblin-tower' };
    const r = startDeclared(c, [tower], {
      player: { x: 1260, y: 760 },
      kills: 2,
      enemies: [{ type: 'goblin-torch', x: 1300, y: 760, health: 4 }],
    });
    const [s] = ticks(r, 1);
    expect(s?.kills).toBe(3);
    expect(s?.structures[0]).toMatchObject({ destroyed: true });
    expect(kinds(s)).toEqual(['xp', 'gold']);
  });

  it('Scenario: Oro de una estructura recogido en su tick (oro 15 en el snapshot n)', () => {
    const c = withDrops(withWeapons(aCampScenario({ tower: { health: 4 } }), PULSE), {
      tower: 15,
    });
    const tower = { ...HOUSE_AT_20_10, type: 'goblin-tower' };
    const [s] = ticks(startDeclared(c, [tower], { player: { x: 1270, y: 690 } }), 1);
    expect(s?.structures[0]?.destroyed).toBe(true);
    expect(s?.pickups).toEqual([]);
    expect(s?.resources.gold).toBe(15);
  });

  it('Scenario: Una ruina no suelta más oro (600 ticks de proyectiles sobre ella)', () => {
    const r = startDeclared(camp({ house: { health: 6 } }, { house: 25 }), [HOUSE_AT_20_10], {
      player: UNDER_HOUSE,
    });
    const snaps = ticks(r, 40 + 600);
    const n = destroyedAt(snaps);
    const golds = new Set(snaps.flatMap((s) => ofKind(s, 'gold').map((p) => p.id)));
    expect(golds.size).toBe(1);
    expect(snaps.slice(n - 1).every((s) => s.structures[0]?.destroyed)).toBe(true);
  });

  it('Scenario: Daño mayor que la vida (torre de vida 4: destruida y 1 gold)', () => {
    const tower = { ...HOUSE_AT_20_10, type: 'goblin-tower' };
    const r = startDeclared(camp({ tower: { health: 4 } }, { tower: 15 }), [tower], {
      player: UNDER_HOUSE,
    });
    const snaps = ticks(r, 40);
    const n = destroyedAt(snaps);
    expect(at(snaps, n).structures[0]).toMatchObject({ health: 0, destroyed: true });
    expect(ofKind(at(snaps, n), 'gold')).toHaveLength(1);
  });

  it('Scenario: Las explosiones no dañan estructuras (ni sueltan oro)', () => {
    const c = withDrops(aCampScenario({ types: [aBarrelType({ blastRadius: 80 })] }), {
      house: 25,
    });
    const center = { x: 1260, y: 690 };
    const byDynamite = startDeclared(c, [HOUSE_AT_20_10], {
      player: { x: 3000, y: 2000 },
      dynamites: [aDynamite(center, 1)],
    });
    const byBarrel = startDeclared(c, [HOUSE_AT_20_10], {
      player: { x: 3000, y: 2000 },
      enemies: [{ type: 'goblin-barrel', ...center, ...inState('fuse', 29) }],
    });
    const [a] = ticks(byDynamite, 1);
    const [b] = ticks(byBarrel, 1);
    expect([a?.structures[0]?.health, b?.structures[0]?.health]).toEqual([30, 30]);
    expect([ofKind(a, 'gold').length, ofKind(b, 'gold').length]).toEqual([0, 0]);
  });

  it('Scenario: El oro de las estructuras no consume azar (casa destruida o en pie)', () => {
    const c = camp({ house: { health: 6 } }, { house: 25 });
    const destroyed = new CountingRandom(new Mulberry32RandomGenerator(7));
    const standing = new CountingRandom(new Mulberry32RandomGenerator(7));
    const a = startDeclared(c, [HOUSE_AT_20_10], { player: UNDER_HOUSE }, destroyed);
    const tough = camp({ house: { health: 60 } }, { house: 25 });
    const b = startDeclared(tough, [HOUSE_AT_20_10], { player: UNDER_HOUSE }, standing);
    const sa = ticks(a, 40);
    const sb = ticks(b, 40);
    expect(ofKind(sa.at(-1), 'gold')).toHaveLength(1);
    expect(sb.at(-1)?.structures[0]?.destroyed).toBe(false);
    expect(destroyed.calls).toBe(standing.calls);
    expect(destroyed.next()).toBe(standing.next());
  });

  it('Scenario: Tope de oro lleno (tope 1: un solo gold de 35)', () => {
    const base = camp({ house: { health: 6 } }, { house: 25 });
    const c = { ...base, progression: { ...base.progression, maxGold: 1 } };
    const r = startDeclared(c, [HOUSE_AT_20_10], {
      player: UNDER_HOUSE,
      gems: [{ kind: 'gold', x: 3000, y: 2000, value: 10 }],
    });
    const snaps = ticks(r, 40);
    const n = destroyedAt(snaps);
    expect(ofKind(at(snaps, n), 'gold').map((p) => p.value)).toEqual([35]);
  });
});

describe('Una secuencia de identificadores (xp-gems)', () => {
  it('Scenario: Una secuencia de identificadores (xp torch, xp barril, wood barril, gold torre)', () => {
    const c = withDrops(
      withWeapons(aCampScenario({ types: [TORCH, aBarrelType()], tower: { health: 4 } }), PULSE),
      { wood: 1, tower: 8 },
    );
    const tower = { ...HOUSE_AT_20_10, type: 'goblin-tower' };
    const r = startDeclared(c, [tower], {
      player: { x: 1260, y: 760 },
      enemies: [
        { type: 'goblin-torch', x: 1300, y: 760, health: 4 },
        { type: 'goblin-barrel', x: 1220, y: 760, health: 4 },
      ],
    });
    const [s] = ticks(r, 1);
    expect(s?.pickups.map((p) => [p.id, p.kind])).toEqual([
      [0, 'xp'],
      [1, 'xp'],
      [2, 'wood'],
      [3, 'gold'],
    ]);
  });
});
