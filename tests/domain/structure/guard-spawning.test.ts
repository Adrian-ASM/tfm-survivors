import { describe, expect, it } from 'vitest';
import { Horde } from '../../../src/domain/enemy/Horde';
import { GameMap } from '../../../src/domain/map/GameMap';
import type { RunSnapshot } from '../../../src/domain/run/RunSnapshot';
import { buildRunRules } from '../../../src/domain/run/RunConfig';
import { initialStructures } from '../../../src/domain/run/RunSetup';
import { StructureField } from '../../../src/domain/structure/StructureField';
import { structureSite } from '../../../src/domain/structure/StructureSite';
import { aDynamite, aStillType, withWeapons } from '../../support/builders';
import { HOUSE_AT_20_10, aCampScenario, aGuardAt, startDeclared } from '../../support/camps';
import { ticks } from '../../support/runs';
import { aLinter, weaponsOf } from '../../support/weapons';

const DOOR = { x: 1290, y: 810 };
const FAR = { x: 3000, y: 2000 };
const houseOf = (max: number, everyTicks: number, health = 30) => ({
  health,
  guards: { type: 'guard', max, everyTicks },
});

/** Ticks (1..) en que aparece algún id nuevo de tipo `guard` (respecto a `start`), con sus ids. */
function births(snaps: readonly RunSnapshot[], start?: RunSnapshot): [number, number[]][] {
  const seen = new Set<number>(start?.enemies.map((e) => e.id));
  const out: [number, number[]][] = [];
  snaps.forEach((s, i) => {
    const fresh = s.enemies.filter((e) => e.type === 'guard' && !seen.has(e.id));
    for (const e of s.enemies) seen.add(e.id);
    if (fresh.length > 0) out.push([i + 1, fresh.map((e) => e.id)]);
  });
  return out;
}

/** Casa de `StructureField` sobre el mapa vacío, sin `Run` (para fijar bajas y destrucción). */
function aHouseField(max: number, everyTicks: number) {
  const rules = buildRunRules(aCampScenario({ house: houseOf(max, everyTicks) }));
  if (!rules.ok) throw new Error(rules.error.message);
  const { arena, map: grid, structures } = rules.value;
  const type = structures.byId('goblin-house');
  if (!type) throw new Error('sin casa');
  const site = structureSite(0, type, 20, 10, 2, 3, grid);
  const built = initialStructures({}, [site], GameMap.open(grid), arena);
  if (!built.ok) throw new Error(built.error.message);
  const field = new StructureField(built.value);
  const horde = new Horde([], arena);
  return { field, horde, house: built.value[0] };
}

describe('Nacimiento de guardias en casas (enemy-spawning)', () => {
  it('Scenario: Nacimientos hasta el tope', () => {
    const run = startDeclared(aCampScenario({ house: houseOf(2, 120) }), [HOUSE_AT_20_10], {
      player: FAR,
    });
    const snaps = ticks(run, 600);
    expect(births(snaps)).toEqual([
      [120, [0]],
      [240, [1]],
    ]);
    expect(snaps[119]?.enemies.at(-1)).toMatchObject(DOOR);
    expect(snaps[239]?.enemies.map((e) => e.id)).toEqual([0, 1]);
    expect(snaps[239]?.enemies.at(-1)).toMatchObject(DOOR);
  });

  it('Scenario: Reposición tras una baja', () => {
    const { field, horde } = aHouseField(2, 120);
    const born: number[] = [];
    for (let n = 1; n <= 600; n++) {
      if (n === 300) {
        horde.alive[0]?.takeDamage(1e9, n);
        horde.removeDead((dead) => dead.post?.release());
      }
      const before = horde.alive.length;
      field.spawnGuards(n, horde, 300);
      if (horde.alive.length > before) born.push(n);
    }
    expect(born).toEqual([120, 240, 360]);
  });

  it('Scenario: Intervalo mínimo', () => {
    const run = startDeclared(aCampScenario({ house: houseOf(3, 1) }), [HOUSE_AT_20_10], {
      player: FAR,
    });
    expect(births(ticks(run, 5)).map(([t]) => t)).toEqual([1, 2, 3]);
  });

  it('Scenario: El tope de vivos frena el nacimiento', () => {
    const config = aCampScenario({
      types: [aStillType({ health: 50 })],
      house: houseOf(2, 60),
      maxAlive: 1,
    });
    const run = startDeclared(config, [HOUSE_AT_20_10], {
      player: FAR,
      enemies: [{ type: 'still', x: 2000, y: 1500 }],
      dynamites: [aDynamite({ x: 2000, y: 1500 }, 150, { damage: 50 })],
    });
    const snaps = ticks(run, 200);
    expect(births(snaps).map(([t]) => t)).toEqual([150]);
    expect(snaps.every((s) => s.enemies.length <= 1)).toBe(true);
  });

  it('Scenario: Casa destruida', () => {
    const { field, horde, house } = aHouseField(2, 120);
    const born: number[] = [];
    for (let n = 1; n <= 1200; n++) {
      if (n === 200) {
        house?.takeDamage(1e9);
        field.settle();
      }
      const before = horde.alive.length;
      field.spawnGuards(n, horde, 300);
      if (horde.alive.length > before) born.push(n);
    }
    expect(born).toEqual([120]);
    expect(horde.alive).toHaveLength(1);
    expect(horde.alive[0]?.post).toBe(house?.post);
  });

  it('una baja de guardia en la partida libera su hueco en la casa', () => {
    const config = aCampScenario({ house: houseOf(1, 120) });
    const run = startDeclared(config, [HOUSE_AT_20_10], {
      player: FAR,
      enemies: [aGuardAt(2000, 1500, { house: 0, health: 5 })],
      dynamites: [aDynamite({ x: 2000, y: 1500 }, 2)],
    });
    const start = run.snapshot();
    const snaps = ticks(run, 400);
    expect(snaps[1]?.enemies).toEqual([]);
    expect(births(snaps, start).map(([t]) => t)).toEqual([120]);
  });

  it('Scenario: Baja de un guardia', () => {
    const config = withWeapons(aCampScenario(), weaponsOf([aLinter()]));
    const run = startDeclared(config, [], {
      player: { x: 1000, y: 700 },
      kills: 4,
      enemies: [aGuardAt(1000, 1000, { health: 6 })],
    });
    const snaps = ticks(run, 60);
    const n = snaps.findIndex((s) => s.enemies.length === 0) + 1;
    const before = snaps[n - 2]?.enemies[0];
    const s = snaps[n - 1];
    expect(n).toBeGreaterThan(1);
    expect(s?.kills).toBe(5);
    expect(s?.gems).toHaveLength(1);
    const gem = s?.gems[0];
    expect(
      Math.hypot((gem?.x ?? 0) - (before?.x ?? 0), (gem?.y ?? 0) - (before?.y ?? 0)),
    ).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('Scenario: Guardia que nace en la puerta', () => {
    const run = startDeclared(aCampScenario({ house: houseOf(1, 10) }), [HOUSE_AT_20_10], {
      player: FAR,
    });
    const snaps = ticks(run, 11);
    expect(snaps[9]?.enemies[0]).toMatchObject({ ...DOOR, stateKind: 'patrol' });
    const next = snaps[10]?.enemies[0];
    expect(next?.x).toBeCloseTo(1290 - Math.SQRT1_2, 3);
    expect(next?.y).toBeCloseTo(810 - Math.SQRT1_2, 3);
  });
});
