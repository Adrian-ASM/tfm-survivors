import { describe, expect, it } from 'vitest';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';
import {
  TESTS,
  aBarrelType,
  aDefaultConfig,
  aDynamite,
  aSegment,
  aStillType,
  aWavesConfig,
  inState,
  withDrops,
  withDuration,
  withScenarioCurve,
  withStoneChance,
  withWeapons,
} from '../support/builders';
import { CountingRandom, ScriptedRandom, StubRandom } from '../support/random';
import {
  aBehaviorConfig,
  aContactConfig,
  aProbeType,
  startRun,
  startSeededRun,
  ticks,
} from '../support/runs';
import { buyAll, leaveShopIfOpen, startAtDoor, untilShopping } from '../support/shop';
import { withPlayerStat } from '../support/upgrades';
import { aLinter, weaponsOf } from '../support/weapons';

// Spec resources (0025), "Contador de piedra de la partida" y los bordes de "Piedra por enemigo
// abatido"; simulation-loop, snapshot y tick de la victoria; xp-gems, recogida de la piedra.

const P = { x: 1000, y: 1000 };
const CENTER = { x: 480, y: 270 };
const TORCH = aStillType({ id: 'goblin-torch', health: 10, xp: 1 });
const LINTER = weaponsOf([aLinter()]);

const at = (snaps: readonly RunSnapshot[], k: number): RunSnapshot => {
  const s = snaps[k - 1];
  if (!s) throw new Error(`sin snapshot del tick ${String(k)}`);
  return s;
};
const stonesOf = (s: RunSnapshot | undefined) =>
  (s?.pickups ?? []).filter((p) => p.kind === 'stone');

/** Combate con el torch quieto y el barril; probabilidades de piedra de escenario. */
const combat = (stone: Record<string, number>, weapons = LINTER): RunConfig =>
  withStoneChance(
    withDrops(withWeapons(aBehaviorConfig([TORCH, aBarrelType()]), weapons), { wood: 2 }),
    stone,
  );
const fight = (c: RunConfig, setup: RunSetup, stones: RandomGenerator) =>
  startRun(c, { player: P, ...setup }, undefined, stones);

/** Contenido por defecto (curva 5/5) sin oleadas: con el mapa vacío, nada a lo que disparar. */
const quiet = (patch: Partial<RunConfig> = {}): RunConfig => ({
  ...withScenarioCurve(aDefaultConfig()),
  waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves,
  ...patch,
});
const still = (setup: RunSetup, c: RunConfig = quiet()) =>
  startRun(c, { player: CENTER, ...setup });

describe('Bordes de la tirada de piedra (resources 0025)', () => {
  it('Scenario: El barril que explota consume y no suelta (1 gema, ninguna piedra, 1 valor)', () => {
    const stones = new CountingRandom(new StubRandom(0));
    const r = fight(
      combat({ 'goblin-barrel': 100 }, weaponsOf([])),
      { enemies: [{ type: 'goblin-barrel', x: 1100, y: 1000 }] },
      stones,
    );
    const s = at(ticks(r, 82), 82);

    expect(s.blasts).toHaveLength(1);
    expect(s.pickups.map((p) => p.kind)).toEqual(['xp']);
    expect(stones.calls).toBe(1);
  });

  it('Scenario: Baja por explosión ajena (torch de vida 10 y dinamita de 25: gema y piedra)', () => {
    const T = { x: 1500, y: 1000 };
    const r = fight(
      combat({ 'goblin-torch': 100 }, weaponsOf([])),
      { enemies: [{ type: 'goblin-torch', ...T }], dynamites: [aDynamite(T, 5, { damage: 25 })] },
      new StubRandom(0),
    );
    const s = at(ticks(r, 5), 5);

    expect(s.enemies).toEqual([]);
    expect(s.pickups.map((p) => [p.kind, p.value])).toEqual([
      ['xp', 1],
      ['stone', 1],
    ]);
  });

  it('Scenario: Tiradas del paso de armas antes que las del de peligros (B 0,1 suelta; A 0,9 no)', () => {
    const A = { x: 1000, y: 1500 };
    const B = { x: 1150, y: 1000 };
    const c = combat({ 'goblin-torch': 50 });
    const probe = ticks(
      fight(c, { enemies: [{ type: 'goblin-torch', ...B, health: 4 }] }, new StubRandom(0.9)),
      120,
    );
    const n = probe.findIndex((s) => s.kills === 1) + 1;
    const stones = new ScriptedRandom([0.1, 0.9]);
    const r = fight(
      c,
      {
        enemies: [
          { type: 'goblin-torch', ...A },
          { type: 'goblin-torch', ...B, health: 4 },
        ],
        dynamites: [aDynamite(A, n, { damage: 25 })],
      },
      stones,
    );
    const snaps = ticks(r, n);
    const s = at(snaps, n);
    const gemB = s.gems[0];

    expect([at(snaps, n - 1).kills, s.kills]).toEqual([0, 2]);
    expect(stonesOf(s).map((p) => [p.x, p.y])).toEqual([[gemB?.x, gemB?.y]]);
    expect([gemB?.x, gemB?.y]).toEqual([B.x, B.y]);
    expect(stones.calls).toBe(2);
  });
});

describe('Contador de piedra de la partida (resources 0025)', () => {
  it.each([['generated'], ['empty']] as const)(
    'Scenario: Partida recién creada (semilla 42, mapa %s: piedra 0)',
    (mode) => {
      const s = startSeededRun(aDefaultConfig(), 42, mode).snapshot();

      expect(s.resources.stone).toBe(0);
      expect(stonesOf(s)).toEqual([]);
    },
  );

  it('Scenario: Recogida de piedra con otros tipos en el mismo tick (piedra 3, oro 10, XP 1)', () => {
    const run = still({
      gems: [
        { kind: 'stone', ...CENTER, value: 3 },
        { kind: 'gold', ...CENTER, value: 10 },
        { ...CENTER, value: 1 },
      ],
    });
    const [s] = ticks(run, 1);

    expect(s?.pickups).toEqual([]);
    expect(s?.resources).toEqual({ gold: 10, wood: 0, stone: 3 });
    expect(s?.progression.xp).toBe(1);
  });

  it('Scenario: Sin bonificación (g = 20 y XP +50: 10 piedras de 1 suman 10)', () => {
    const gold = withPlayerStat(quiet(), 'prospector', 20).upgrades.character;
    const xp = withPlayerStat(quiet(), 'scholar', 50).upgrades.character;
    const base = quiet();
    const c = { ...base, upgrades: { ...base.upgrades, character: [...gold, ...xp] } };
    const gemOnTick = (k: number) => ({
      kind: 'stone' as const,
      x: CENTER.x + 21 + 6 * (k - 1) + 3,
      y: CENTER.y,
      value: 1,
      attracted: true,
    });
    const run = still(
      {
        upgrades: { prospector: 1, scholar: 1 },
        gems: Array.from({ length: 10 }, (_, i) => gemOnTick(1 + 3 * i)),
      },
      c,
    );
    const snaps = ticks(run, 30);

    expect(snaps.at(-1)?.resources).toEqual({ gold: 0, wood: 0, stone: 10 });
    expect(new Set(snaps.map((s) => s.resources.stone)).size).toBe(10);
  });

  it('Scenario: No baja al recibir daño (piedra 5 tras un golpe de 10)', () => {
    const hitter = aProbeType({ id: 'goblin-torch', speed: 1e-6, damage: 10, health: 1e6 });
    const run = startRun(aContactConfig({ types: [hitter] }), {
      player: CENTER,
      enemies: [{ type: 'goblin-torch', ...CENTER }],
      resources: { gold: 30, wood: 0, stone: 5 },
    });
    const [s] = ticks(run, 1);

    expect(s?.player.health).toBe(90);
    expect(s?.resources.stone).toBe(5);
  });

  it('Scenario: No baja al comprar (piedra 5 y oro 30: compra y salida de la tienda)', () => {
    const run = startAtDoor(aDefaultConfig(), { resources: { gold: 30, wood: 0, stone: 5 } });
    untilShopping(run, 1);
    const product = run.snapshot().shop.products.find((p) => (p.price ?? 99) <= 30);
    if (product?.price == null) throw new Error('sin producto asequible');
    const bought = buyAll(run, [product.id]);
    leaveShopIfOpen(run);

    expect(bought.resources.gold).toBe(30 - product.price);
    expect([bought.resources.stone, run.snapshot().resources.stone]).toEqual([5, 5]);
  });

  it('Scenario: Valores grandes (99.999 + 1 = 100.000)', () => {
    const run = still({
      gems: [{ kind: 'stone', ...CENTER, value: 1 }],
      resources: { gold: 0, wood: 0, stone: 99_999 },
    });
    const [s] = ticks(run, 1);

    expect(s?.resources.stone).toBe(100_000);
  });

  it('una piedra inicial negativa o no entera en RunSetup es un error', () => {
    for (const stone of [-1, 1.5]) {
      expect(() => still({ resources: { gold: 0, wood: 0, stone } })).toThrow();
    }
  });
});

// Spec simulation-loop (0025): tick de la victoria, orden armas/mecha y snapshot.
describe('Piedra en el tick y en el snapshot (simulation-loop)', () => {
  /** Atraída a 738 px: se recogería en el tick 120 (738 − 6 · 120 < 21 ≤ 738 − 6 · 119). */
  const incoming: RunSetup = {
    player: CENTER,
    gems: [{ kind: 'stone', x: CENTER.x + 738, y: 270, value: 4, attracted: true }],
  };

  it('control: con la duración por defecto la piedra se recoge en el tick 120', () => {
    const snaps = ticks(still(incoming), 120);
    expect(snaps[118]?.resources.stone).toBe(0);
    expect(snaps[119]?.resources.stone).toBe(4);
  });

  it('Scenario: Sin piedra en el tick de la victoria (el recogible sigue y la piedra en 0)', () => {
    const last = ticks(startRun(withDuration(quiet(), 2), incoming), 120)[119];

    expect(last).toMatchObject({ status: 'over', outcome: 'won' });
    expect(stonesOf(last)).toHaveLength(1);
    expect(last?.resources.stone).toBe(0);
  });

  it('Scenario: Tirada en el tick de la victoria (Tests abate un torch: gema y piedra en el 120)', () => {
    const types = [aProbeType({ id: 'goblin-torch', speed: 60, health: 10, xp: 1, damage: 5 })];
    const base = withDuration(withWeapons(aContactConfig({ types }), weaponsOf([TESTS])), 2);
    const run = startRun(
      withStoneChance(base, { 'goblin-torch': 100 }),
      { player: CENTER, enemies: [{ type: 'goblin-torch', x: 480 + 219.5, y: 270, health: 4 }] },
      undefined,
      new StubRandom(0),
    );
    const snaps = ticks(run, 120);
    const [before, last] = [snaps[118], snaps[119]];

    expect(before?.kills).toBe(0);
    expect(last).toMatchObject({ outcome: 'won', kills: 1, enemies: [] });
    expect(last?.pickups.map((p) => p.kind)).toEqual(['xp', 'stone']);
  });

  it('Scenario: Las armas antes que la mecha, con piedra (wood y stone; 1 solo valor)', () => {
    const X = { x: 1039.333, y: 1000 };
    const c = combat({ 'goblin-barrel': 100 });
    const probe = ticks(
      fight(
        c,
        { enemies: [{ type: 'goblin-barrel', ...X, ...inState('fuse') }] },
        new StubRandom(0),
      ),
      120,
    );
    const h =
      probe.findIndex((s) => (s.enemies[0]?.health ?? 0) < (probe[0]?.enemies[0]?.health ?? 0)) + 1;
    const stones = new CountingRandom(new StubRandom(0));
    const r = fight(
      c,
      { enemies: [{ type: 'goblin-barrel', ...X, health: 4, ...inState('fuse', 30 - h) }] },
      stones,
    );
    const s = at(ticks(r, h), h);

    expect([s.blasts.length, s.kills]).toEqual([0, 1]);
    expect(s.pickups.map((p) => p.kind)).toEqual(['xp', 'wood', 'stone']);
    expect(stones.calls).toBe(1);
  });

  it('Scenario: Partida recién creada (piedra 0 y ningún recogible stone)', () => {
    const s = startRun(quiet()).snapshot();

    expect(s.resources).toEqual({ gold: 0, wood: 0, stone: 0 });
    expect(stonesOf(s)).toEqual([]);
  });

  it('Scenario: Piedra en el snapshot (s1 recogida: w1, g1, s2 de goblin-tnt-guard; piedra 5)', () => {
    const run = still({
      gems: [
        { kind: 'wood', x: 1000, y: 900, value: 1 },
        { kind: 'stone', ...CENTER, value: 1, source: 'goblin-torch' },
        { x: 1100, y: 900, value: 1 },
        { kind: 'stone', x: 1200, y: 900, value: 1, source: 'goblin-tnt-guard' },
      ],
      resources: { gold: 0, wood: 0, stone: 4 },
    });
    const [s] = ticks(run, 1);

    expect(s?.pickups).toEqual([
      { id: 0, kind: 'wood', value: 1, x: 1000, y: 900, radius: 5 },
      { id: 2, kind: 'xp', value: 1, x: 1100, y: 900, radius: 5 },
      { id: 3, kind: 'stone', value: 1, x: 1200, y: 900, radius: 5, source: 'goblin-tnt-guard' },
    ]);
    expect(s?.resources.stone).toBe(5);
  });

  it('Scenario: Snapshot de la piedra no mutable desde fuera (piedra 3, origen y valor)', () => {
    const run = still({
      gems: [{ kind: 'stone', x: 1000, y: 900, value: 1, source: 'goblin-torch' }],
      resources: { gold: 0, wood: 0, stone: 3 },
    });
    ticks(run, 10);
    const snap = run.snapshot();
    const tryWrite = (f: () => void) => {
      try {
        f();
      } catch {
        // congelado: en modo estricto, escribir lanza
      }
    };
    tryWrite(() => Object.assign(snap.resources, { stone: 99 }));
    tryWrite(() => Object.assign(snap.pickups[0] ?? {}, { source: 'goblin-tnt', value: 5 }));
    const [next] = ticks(run, 1);

    expect(next?.resources.stone).toBe(3);
    expect(next?.pickups.map((p) => [p.kind, p.value, p.source])).toEqual([
      ['stone', 1, 'goblin-torch'],
    ]);
  });
});

// Spec xp-gems (0025), "Recogida de gemas" y "Recogibles con tipo".
describe('Recogida de la piedra (xp-gems)', () => {
  const reach = (pickupRadius: number) =>
    quiet({ player: { ...aDefaultConfig().player, pickupRadius } });

  it('Scenario: Piedra recogida al pasar (538 tras el tick 1, 502 tras el 7, recogida en el 8)', () => {
    const run = still({ gems: [{ kind: 'stone', x: 544, y: 270, value: 2 }] }, reach(64));
    const snaps = ticks(run, 8);

    expect([at(snaps, 1).pickups[0]?.x, at(snaps, 7).pickups[0]?.x]).toEqual([538, 502]);
    expect(at(snaps, 7).resources.stone).toBe(0);
    expect(at(snaps, 8).pickups).toEqual([]);
    expect(at(snaps, 8).resources).toEqual({ gold: 0, wood: 0, stone: 2 });
    expect(at(snaps, 8).progression.xp).toBe(0);
  });

  it('Scenario: Piedra fuera del radio (distancia 129 con radio 128 durante 36.000 ticks)', () => {
    const run = still({ gems: [{ kind: 'stone', x: 609, y: 270, value: 1 }] }, reach(128));
    ticks(run, 36_000);
    const s = run.snapshot();

    expect(s.pickups.map((p) => [p.x, p.y])).toEqual([[609, 270]]);
    expect(s.resources.stone).toBe(0);
  });

  it('Scenario: Piedra de una baja recogida en su tick (XP 1 y piedra 1 en el tick n)', () => {
    const c = combat({ 'goblin-torch': 100 });
    const run = startRun(
      c,
      { player: CENTER, enemies: [{ type: 'goblin-torch', x: 490, y: 270, health: 4 }] },
      undefined,
      new StubRandom(0),
    );
    const snaps = ticks(run, 120);
    const n = snaps.findIndex((s) => s.kills === 1) + 1;
    const s = at(snaps, n);

    expect(s.pickups).toEqual([]);
    expect(s.progression.xp).toBe(1);
    expect(s.resources.stone).toBe(1);
  });

  it('Scenario: Tipos del snapshot (el stone con source goblin-tnt; los otros cuatro sin source)', () => {
    const run = still({
      gems: [
        { x: 1000, y: 900, value: 2 },
        { kind: 'gold', x: 1100, y: 900, value: 8 },
        { kind: 'wood', x: 1200, y: 900, value: 3 },
        { kind: 'meat', x: 1300, y: 900, value: 1 },
        { kind: 'stone', x: 1400, y: 900, value: 1, source: 'goblin-tnt' },
      ],
    });
    const { pickups } = run.snapshot();

    expect(pickups.map((p) => p.kind)).toEqual(['xp', 'gold', 'wood', 'meat', 'stone']);
    expect(pickups.every((p) => p.radius === 5)).toBe(true);
    expect(pickups.filter((p) => 'source' in p)).toEqual([
      { id: 4, kind: 'stone', value: 1, x: 1400, y: 900, radius: 5, source: 'goblin-tnt' },
    ]);
  });
});
