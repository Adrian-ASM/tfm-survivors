import { describe, expect, it } from 'vitest';
import { CombatRules } from '../../src/domain/combat/CombatRules';
import { HitLog } from '../../src/domain/combat/HitLog';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { TerrainSource } from '../../src/domain/map/TerrainSource';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  LINTER,
  TESTS,
  aDefaultConfig,
  aDynamite,
  aStillType,
  withCombat,
  withSheep,
  withWeapons,
} from '../support/builders';
import { HOUSE_AT_20_10, aCampScenario } from '../support/camps';
import { aHitConfig, hitsOfTick, jumpAt, linterArrival, untilHit } from '../support/combat';
import { randomInputs } from '../support/inputs';
import { chooseFirstWhileOpen, startRun, startSeededRun, ticks } from '../support/runs';
import { sheepRandom } from '../support/sheep';
import { FakeTarget, weaponsOf } from '../support/weapons';

const P = { x: 1000, y: 1000 } as const;
const torches = (at: readonly { x: number; y: number }[]) =>
  at.map((p) => ({ type: 'goblin-torch', ...p }));

/** n `goblin-torch` en una rejilla de 10 px centrada en P (todos dentro del pulso de Tests). */
const grid = (n: number) =>
  torches(
    Array.from({ length: n }, (_, i) => ({
      x: P.x - 30 + (i % 7) * 10,
      y: P.y - 30 + Math.floor(i / 7) * 10,
    })),
  );

const nonPlayer = (s: RunSnapshot) => hitsOfTick(s).filter((h) => h.kind !== 'player');

/** Partida sembrada como en producción con 3.600 inputs fijos y la política de elección fija. */
function seededHits(config: RunConfig): (readonly unknown[])[] {
  const run = startSeededRun(config, 42);
  const out: (readonly unknown[])[] = [];
  for (const input of randomInputs(3600, 7)) {
    chooseFirstWhileOpen(run);
    run.tick(input);
    out.push(run.snapshot().hits);
    if (run.status === 'over') break;
  }
  return out;
}

describe('Run · orden e identificadores de los golpes (0031)', () => {
  it('Scenario: Identificadores en orden de registro', () => {
    // Jugador en S, e2 el enemigo más cercano; en el tick T salta a J, donde el pulso alcanza a e1,
    // e2 y la casa, y una dinamita (daño 5) alcanza a la oveja y al jugador.
    const S = { x: 1620, y: 790 };
    const base = aCampScenario({ types: [aStillType({ id: 'e' })], player: { speed: 360 * 60 } });
    const config = (weapons: (typeof LINTER)[]) => withWeapons(withSheep(base), weaponsOf(weapons));
    const terrain = (): TerrainSource => ({
      kind: 'open',
      structures: [HOUSE_AT_20_10],
      sheep: { at: [{ x: 1260, y: 905 }], random: sheepRandom() },
    });
    const setup: RunSetup = {
      player: S,
      enemies: [
        { type: 'e', x: 1200, y: 800 },
        { type: 'e', x: 1320, y: 800 },
      ],
    };
    const start = (weapons: (typeof LINTER)[], extra: RunSetup = {}) => {
      const r = Run.start(
        config(weapons),
        new Mulberry32RandomGenerator(42),
        { ...setup, ...extra },
        terrain(),
      );
      if (!r.ok) throw new Error(r.error.message);
      return r.value;
    };
    const at = untilHit(start([LINTER])).tick;
    const dynamites = [aDynamite({ x: 1260, y: 845 }, at, { damage: 5 })];
    const s = jumpAt(start([LINTER, TESTS], { dynamites }), at);
    expect(s.hits.map((h) => [h.id, h.kind, h.targetId])).toEqual([
      [0, 'enemy', 1],
      [1, 'enemy', 0],
      [2, 'structure', s.structures[0]?.id],
      [3, 'sheep', s.sheep[0]?.id],
      [4, 'player', undefined],
    ]);
    expect(s.hits.every((h) => h.tick === at)).toBe(true);
  });

  it('Scenario: Secuencia sin huecos entre ticks', () => {
    const r = CombatRules.create({ hitWindowTicks: 15, maxHitsPerTick: 48 });
    if (!r.ok) throw new Error(r.error.message);
    const log = new HitLog(r.value);
    const [a, b, c] = [
      new FakeTarget(0, 0, 50, 10, 1),
      new FakeTarget(0, 0, 50, 10, 2),
      new FakeTarget(0, 0, 50, 10, 3),
    ];
    log.begin(10);
    log.strike('enemy', a, 6, 10);
    const k = log.nextId - 1;
    log.begin(11);
    log.begin(12);
    log.begin(13);
    log.strike('enemy', b, 6, 13);
    log.strike('enemy', c, 6, 13);
    const ids: number[] = [];
    log.forWindow(13, (h) => {
      if (h.tick === 13) ids.push(h.id);
    });
    expect(ids).toEqual([k + 1, k + 2]);
  });

  it('Scenario: Identificadores desde 0 en cada partida', () => {
    const all = seededHits(aDefaultConfig()).flat() as { id: number }[];
    expect(new Set(all.map((h) => h.id)).size).toBeGreaterThanOrEqual(10);
    const fresh = startSeededRun(aDefaultConfig(), 42);
    for (let i = 0; i < 3600 && hitsOfTick(fresh.snapshot()).length === 0; i++) {
      chooseFirstWhileOpen(fresh);
      fresh.tick(PlayerInput.NONE);
    }
    expect(hitsOfTick(fresh.snapshot())[0]?.id).toBe(0);
  });
});

describe('Run · tope de golpes por tick (0031)', () => {
  it('Scenario: Pulso con más objetivos que el tope', () => {
    const at = [
      { x: 960, y: 1000 },
      { x: 980, y: 1000 },
      { x: 1020, y: 1000 },
      { x: 1040, y: 1000 },
      { x: 1000, y: 960 },
    ];
    const run = startRun(aHitConfig([TESTS], { maxHitsPerTick: 3 }), {
      player: P,
      enemies: torches(at),
    });
    const [s] = ticks(run, 1);
    expect(hitsOfTick(s).map((h) => [h.id, h.targetId, h.amount])).toEqual([
      [0, 0, 4],
      [1, 1, 4],
      [2, 2, 4],
    ]);
    expect(s?.enemies.map((e) => e.health)).toEqual([6, 6, 6, 6, 6]);
  });

  it('Scenario: Suma a un golpe conservado con el tope lleno', () => {
    const at = [
      { x: 1010, y: 980 },
      { x: 1010, y: 1020 },
      { x: 1040, y: 1000 },
      { x: 990, y: 1000 },
      { x: 1000, y: 960 },
    ];
    const setup = { player: { x: 1300, y: 1000 }, enemies: torches(at) };
    const start = (weapons: readonly (typeof LINTER)[]) =>
      startRun(aHitConfig(weapons, { maxHitsPerTick: 3 }), setup);
    const s = jumpAt(start([LINTER, TESTS]), linterArrival(start));
    expect(hitsOfTick(s).map((h) => [h.targetId, h.amount])).toEqual([
      [2, 10],
      [0, 4],
      [1, 4],
    ]);
  });

  it('Scenario: El golpe al jugador no cuenta para el tope', () => {
    const types = [aStillType({ id: 'hitter', damage: 10 })];
    const config = aHitConfig([TESTS], { maxHitsPerTick: 1, types });
    const enemies = [
      { type: 'hitter', ...P },
      { type: 'goblin-torch', x: 1040, y: 1000 },
    ];
    const [s] = ticks(startRun(config, { player: P, enemies }), 1);
    expect(hitsOfTick(s).map((h) => [h.kind, h.targetId, h.amount])).toEqual([
      ['enemy', 0, 4],
      ['player', undefined, 10],
    ]);
  });

  it('Scenario: Tope en el límite', () => {
    const play = (n: number) =>
      ticks(startRun(aHitConfig([TESTS]), { player: P, enemies: grid(n) }), 1)[0];
    const exact = play(48);
    const over = play(49);
    expect(hitsOfTick(exact)).toHaveLength(48);
    expect(hitsOfTick(over).map((h) => h.targetId)).toEqual(
      Array.from({ length: 48 }, (_, i) => i),
    );
    expect(over?.enemies.map((e) => e.health)).toEqual(Array.from({ length: 49 }, () => 6));
  });

  it('Scenario: Descarte determinista', () => {
    const config = withCombat(aDefaultConfig(), { maxHitsPerTick: 2 });
    const a = seededHits(config);
    const b = seededHits(config);
    expect(b).toEqual(a);
    const run = startSeededRun(config, 42);
    let worst = 0;
    for (const input of randomInputs(3600, 7)) {
      chooseFirstWhileOpen(run);
      run.tick(input);
      worst = Math.max(worst, nonPlayer(run.snapshot()).length);
      if (run.status === 'over') break;
    }
    expect(worst).toBe(2);
  });
});
