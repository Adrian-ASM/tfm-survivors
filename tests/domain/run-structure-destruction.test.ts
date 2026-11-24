import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aBarrelType, aDynamite, inState, withPlayer, withWeapons } from '../support/builders';
import { HOUSE_AT_20_10, aCampScenario, startDeclared } from '../support/camps';
import { CountingRandom } from '../support/random';
import { aProbeType, ticks } from '../support/runs';
import { aLinter, aPulse, weaponsOf } from '../support/weapons';

const UNDER_HOUSE = { x: 1260, y: 1000 };
const TOWER_AT_20_10 = { ...HOUSE_AT_20_10, type: 'goblin-tower' };
const linter = weaponsOf([aLinter()]);
const TORCH = aProbeType({ id: 'goblin-torch', speed: 90, radius: 10, health: 10, damage: 5 });

/** Primer tick (índice + 1) en que la estructura 0 figura destruida. */
const destroyedAt = (snaps: ReturnType<typeof ticks>) =>
  snaps.findIndex((s) => s.structures[0]?.destroyed) + 1;

describe('Run · destrucción y ruina (goblin-structures, simulation-loop)', () => {
  it('Scenario: Destrucción sin recompensa', () => {
    const config = withWeapons(aCampScenario({ house: { health: 6 } }), linter);
    const run = startDeclared(config, [HOUSE_AT_20_10, { ...TOWER_AT_20_10, col: 50 }], {
      player: UNDER_HOUSE,
      kills: 5,
      experience: { level: 1, xp: 3 },
      gems: [
        { x: 3000, y: 2000, value: 1 },
        { x: 3100, y: 2000, value: 1 },
      ],
    });
    const snaps = ticks(run, 40);
    const n = destroyedAt(snaps);
    const s = snaps[n - 1];
    expect(n).toBe(35);
    expect(snaps[n - 2]?.structures[0]?.destroyed).toBe(false);
    expect(s?.structures.map((x) => [x.id, x.health, x.destroyed])).toEqual([
      [0, 0, true],
      [1, 90, false],
    ]);
    expect([s?.kills, s?.progression.xp, s?.gems.length]).toEqual([5, 3, 2]);
  });

  it('Scenario: Daño mayor que la vida (la torre figura destruida)', () => {
    const config = withWeapons(aCampScenario({ tower: { health: 4 } }), linter);
    const run = startDeclared(config, [TOWER_AT_20_10], { player: UNDER_HOUSE });
    const snaps = ticks(run, 35);
    expect(snaps[34]?.structures[0]).toMatchObject({ health: 0, destroyed: true });
  });

  it('Scenario: Ruina hasta el final', () => {
    const config = withPlayer(withWeapons(aCampScenario({ house: { health: 6 } }), linter), {
      maxHealth: 1e9,
    });
    const run = startDeclared(config, [HOUSE_AT_20_10], { player: UNDER_HOUSE });
    const snaps = ticks(run, 35 + 3600);
    const after = snaps.slice(34);
    expect(after).toHaveLength(3601);
    expect(after.every((s) => s.structures[0]?.destroyed && s.structures[0].health === 0)).toBe(
      true,
    );
  });

  it('Scenario: Las explosiones no dañan estructuras', () => {
    const config = aCampScenario({ types: [aBarrelType({ blastRadius: 80 })] });
    const center = { x: 1260, y: 690 };
    const byDynamite = startDeclared(config, [HOUSE_AT_20_10], {
      player: { x: 3000, y: 2000 },
      dynamites: [aDynamite(center, 1)],
    });
    const byBarrel = startDeclared(config, [HOUSE_AT_20_10], {
      player: { x: 3000, y: 2000 },
      enemies: [{ type: 'goblin-barrel', ...center, ...inState('fuse', 29) }],
    });
    const [a] = ticks(byDynamite, 1);
    const [b] = ticks(byBarrel, 1);
    expect([a?.blasts.length, b?.blasts.length]).toEqual([1, 1]);
    expect([a?.structures[0]?.health, b?.structures[0]?.health]).toEqual([30, 30]);
  });

  it('Scenario: Explosión sobre una casa y una torre', () => {
    const config = aCampScenario({
      types: [aBarrelType({ blastRadius: 80, blastDamage: 25 })],
      tower: { health: 10 },
    });
    const run = startDeclared(config, [HOUSE_AT_20_10, TOWER_AT_20_10], {
      player: { x: 3000, y: 2000 },
      enemies: [{ type: 'goblin-barrel', x: 1270, y: 690, ...inState('fuse', 29) }],
      dynamites: [aDynamite({ x: 1260, y: 690 }, 1)],
    });
    const [s] = ticks(run, 1);
    expect(s?.blasts).toHaveLength(2);
    expect(s?.structures.map((x) => [x.health, x.destroyed])).toEqual([
      [30, false],
      [10, false],
    ]);
  });

  it('Scenario: El jugador atraviesa una casa', () => {
    const config = aCampScenario({ player: { speed: 215 } });
    const input = PlayerInput.of(0, 1);
    const withHouse = startDeclared(config, [HOUSE_AT_20_10], { player: { x: 1260, y: 560 } });
    const without = startDeclared(config, [], { player: { x: 1260, y: 560 } });
    const a = ticks(withHouse, 60, input).at(-1)?.player;
    const b = ticks(without, 60, input).at(-1)?.player;
    expect(a?.x).toBeCloseTo(1260, 3);
    expect(a?.y).toBeCloseTo(775, 3);
    expect([a?.x, a?.y]).toEqual([b?.x, b?.y]);
  });

  it('Scenario: Un enemigo cruza una torre', () => {
    const config = aCampScenario({ types: [TORCH] });
    const tower = { type: 'goblin-tower', col: 10, row: 4, cols: 2, rows: 2 };
    const setup = {
      player: { x: 900, y: 300 },
      enemies: [{ type: 'goblin-torch', x: 600, y: 300 }],
    };
    const a = ticks(startDeclared(config, [tower], setup), 60).at(-1)?.enemies[0];
    const b = ticks(startDeclared(config, [], setup), 60).at(-1)?.enemies[0];
    expect(a?.x).toBeCloseTo(690, 3);
    expect(a?.y).toBeCloseTo(300, 3);
    expect([a?.x, a?.y]).toEqual([b?.x, b?.y]);
  });

  it('Scenario: Las estructuras se destruyen tras las bajas', () => {
    const config = withWeapons(
      aCampScenario({ types: [TORCH], tower: { health: 4 } }),
      weaponsOf([aPulse()]),
    );
    const run = startDeclared(config, [TOWER_AT_20_10], {
      player: { x: 1260, y: 760 },
      kills: 2,
      enemies: [{ type: 'goblin-torch', x: 1300, y: 760, health: 4 }],
    });
    const [s] = ticks(run, 1);
    expect(s?.kills).toBe(3);
    expect(s?.gems).toHaveLength(1);
    expect(s?.structures[0]).toMatchObject({ health: 0, destroyed: true });
  });

  it('Scenario: Las estructuras no consumen azar', () => {
    const config = withWeapons(aCampScenario({ house: { health: 6 } }), linter);
    const withHouse = new CountingRandom(new Mulberry32RandomGenerator(7));
    const without = new CountingRandom(new Mulberry32RandomGenerator(7));
    const a = startDeclared(config, [HOUSE_AT_20_10], { player: UNDER_HOUSE }, withHouse);
    const b = startDeclared(config, [], { player: UNDER_HOUSE }, without);
    const n = destroyedAt(ticks(a, 40));
    ticks(b, 40);
    expect(n).toBe(35);
    expect(withHouse.calls).toBe(without.calls);
    expect(withHouse.next()).toBe(without.next());
  });
});
