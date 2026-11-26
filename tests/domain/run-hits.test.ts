import { describe, expect, it } from 'vitest';
import type { RunSetup } from '../../src/domain/run/Run';
import type { WeaponTypeConfig } from '../../src/domain/weapon/WeaponType';
import { LINTER, NO_WEAPONS, TESTS, aDynamite, aStillType, withWeapons } from '../support/builders';
import { HOUSE_AT_20_10, aCampScenario, startDeclared } from '../support/camps';
import { aHitConfig, hitsOfTick, jumpAt, linterArrival, untilHit } from '../support/combat';
import { startRun, ticks } from '../support/runs';
import { SHEEP_AT, aSheepConfig, startWithSheep } from '../support/sheep';
import { aLinter, weaponsOf } from '../support/weapons';

const AT = { x: 1000, y: 1000 } as const;

/** Enemigo quieto en (1.000, 1.000) con la vida dada y el jugador a `gap` px a su derecha. */
const facing = (type: string, gap: number, health?: number): RunSetup => ({
  player: { x: AT.x + gap, y: AT.y },
  enemies: [{ type, ...AT, ...(health === undefined ? {} : { health }) }],
});

const starter = (setup: RunSetup) => (weapons: readonly WeaponTypeConfig[]) =>
  startRun(aHitConfig(weapons), setup);

describe('Run · registro de golpes de combate (0031)', () => {
  it('Scenario: Golpe letal recortado a la vida restante', () => {
    const s = untilHit(starter(facing('goblin-torch', 200, 4))([LINTER]));
    expect(s.enemies).toEqual([]);
    expect(hitsOfTick(s)).toEqual([
      { id: 0, tick: s.tick, kind: 'enemy', targetId: 0, x: 1000, y: 1000, amount: 4 },
    ]);
  });

  it('Scenario: Suma por objetivo y tick', () => {
    const start = starter(facing('goblin-tnt', 300));
    const at = linterArrival(start);
    const s = jumpAt(start([LINTER, aLinter({ id: 'linter-b' }), TESTS]), at);
    expect(s.enemies[0]?.health).toBe(29);
    expect(hitsOfTick(s).map((h) => [h.targetId, h.amount])).toEqual([[0, 16]]);
  });

  it('Scenario: Suma de armas y explosión en el mismo tick', () => {
    const setup = facing('goblin-tnt', 200);
    const at = linterArrival(starter(setup));
    const blast = { ...setup, dynamites: [aDynamite(AT, at, { damage: 25 })] };
    const s = untilHit(starter(blast)([LINTER]));
    expect(s.tick).toBe(at);
    expect(s.enemies[0]?.health).toBe(14);
    expect(hitsOfTick(s).map((h) => [h.kind, h.targetId, h.amount])).toEqual([['enemy', 0, 31]]);
  });

  it('Scenario: Golpe letal sumado en el mismo tick', () => {
    const start = starter(facing('goblin-torch', 300));
    const s = jumpAt(start([LINTER, TESTS]), linterArrival(start));
    expect(s.enemies).toEqual([]);
    expect(hitsOfTick(s).map((h) => [h.targetId, h.amount])).toEqual([[0, 10]]);
  });

  it('Scenario: Impacto sobre un objetivo ya abatido en el tick', () => {
    const start = starter(facing('goblin-torch', 300, 4));
    const s = jumpAt(start([LINTER, TESTS]), linterArrival(start));
    expect(s.enemies).toEqual([]);
    expect(hitsOfTick(s).map((h) => [h.targetId, h.amount])).toEqual([[0, 4]]);
  });

  it('Scenario: Golpes en ticks distintos no se suman', () => {
    // Una segunda flecha algo más lenta (460 px/s) llega exactamente un tick después.
    const slow = aLinter({
      id: 'linter-b',
      attack: { type: 'projectile', speed: 460, radius: 4, lifetimeTicks: 60 },
    });
    const run = starter(facing('goblin-tnt', 300))([LINTER, slow]);
    const first = untilHit(run);
    const next = ticks(run, 1)[0];
    const all = next?.hits.filter((h) => h.targetId === 0) ?? [];
    expect(all.map((h) => [h.tick, h.amount])).toEqual([
      [first.tick, 6],
      [first.tick + 1, 6],
    ]);
  });

  it('Scenario: Golpe en una estructura que pasa a ruina', () => {
    const config = withWeapons(aCampScenario(), weaponsOf([LINTER]));
    const setup = { player: { x: 1260, y: 990 }, structures: [{ health: 4 }] };
    const s = untilHit(startDeclared(config, [HOUSE_AT_20_10], setup));
    const house = s.structures[0];
    expect(house).toMatchObject({ destroyed: true, health: 0 });
    expect(hitsOfTick(s)).toEqual([
      { id: 0, tick: s.tick, kind: 'structure', targetId: house?.id, x: 1260, y: 690, amount: 4 },
    ]);
  });

  it('Scenario: Sin golpe en una ruina ni con explosiones', () => {
    const lure = aStillType();
    const ruinConfig = withWeapons(aCampScenario({ types: [lure] }), weaponsOf([LINTER]));
    const ruinSetup = {
      player: { x: 1260, y: 990 },
      structures: [{ health: 0 }],
      enemies: [{ type: 'still', x: 1260, y: 600 }],
    };
    const ruin = ticks(startDeclared(ruinConfig, [HOUSE_AT_20_10], ruinSetup), 600);
    const blastSetup = {
      player: { x: 1260, y: 990 },
      structures: [{ health: 30 }],
      dynamites: [aDynamite({ x: 1260, y: 690 }, 10, { radius: 48, damage: 20 })],
    };
    const blast = ticks(startDeclared(aCampScenario(), [HOUSE_AT_20_10], blastSetup), 10);
    const kinds = [...ruin, ...blast].flatMap((s) => hitsOfTick(s).map((h) => h.kind));
    expect(kinds).not.toContain('structure');
    expect(kinds).toContain('enemy');
    expect(blast.at(-1)?.structures[0]?.health).toBe(30);
  });

  it('Scenario: Golpes en una oveja', () => {
    const player = { x: 1300, y: 1000 };
    const shot = untilHit(
      startWithSheep(withWeapons(aSheepConfig(), weaponsOf([LINTER])), [SHEEP_AT], { player }),
    );
    const sheepId = shot.sheep[0]?.id;
    expect(hitsOfTick(shot)).toEqual([
      { id: 0, tick: shot.tick, kind: 'sheep', targetId: sheepId, x: 1000, y: 1000, amount: 6 },
    ]);
    expect(shot.sheep[0]?.health).toBe(6);
    const dynamites = [aDynamite(SHEEP_AT, 5, { damage: 25 })];
    const config = withWeapons(aSheepConfig(), NO_WEAPONS);
    const blown = untilHit(startWithSheep(config, [SHEEP_AT], { player, dynamites }));
    expect(hitsOfTick(blown).map((h) => [h.kind, h.amount])).toEqual([['sheep', 12]]);
    expect(blown.sheep).toEqual([]);
  });
});
