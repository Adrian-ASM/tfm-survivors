import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { Run } from '../../src/domain/run/Run';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  LONG_RUN_HEALTH,
  aBarrelType,
  aDefaultConfig,
  aSegment,
  aStillType,
  withDrops,
  withPlayer,
  withResources,
  withWeapons,
  withoutResourceSources,
  withoutSites,
} from '../support/builders';
import { startOn } from '../support/camps';
import { randomInputs } from '../support/inputs';
import { CountingRandom } from '../support/random';
import { aBehaviorConfig, chooseFirstWhileOpen, startSeededRun } from '../support/runs';
import { sheepRandom } from '../support/sheep';
import { aPulse, weaponsOf } from '../support/weapons';

// Spec resources "Recursos sin efecto en el combate" y simulation-loop "Determinismo" (0022).
// Test-after (ADR-0018): el comportamiento ya está en los grupos 1–3.1.
const LONG = 14_400;
const TOUGH = withPlayer(aDefaultConfig(), { maxHealth: LONG_RUN_HEALTH });
/** 0027: sin solares (su colocación evita vetas y montones y desde 0027 bloquean el paso). */
const TOUGH_NO_SITES = withoutSites(TOUGH);

/** Campos de combate y de progresión del requisito, sin los ids de las gemas ni los recursos. */
function combat(s: RunSnapshot): string {
  return JSON.stringify([
    s.tick,
    s.status,
    s.outcome,
    s.kills,
    s.player,
    s.enemies.map((e) => [e.id, e.type, e.x, e.y, e.health, e.state, e.stateKind, e.damaged]),
    // 0023: ovejas (id, posición, vida y estado) y carne, aparte de los ids de los recogibles.
    s.sheep.map((o) => [o.id, o.x, o.y, o.health, o.state]),
    s.pickups.filter((p) => p.kind === 'meat').map((p) => [p.x, p.y, p.value]),
    s.projectiles,
    s.pulses,
    s.dynamites,
    s.warnings,
    s.blasts,
    s.structures,
    s.weapons,
    s.gems.map((g) => [g.x, g.y, g.radius]),
    s.progression,
    s.offer,
    s.upgrades,
  ]);
}

/** Juega las dos a la par con la política fija; devuelve el primer tick que difiere (−1 si no). */
function lockstep(
  a: Run,
  b: Run,
  inputs: readonly PlayerInput[],
  same: (x: RunSnapshot, y: RunSnapshot) => boolean,
): number {
  for (const [i, input] of inputs.entries()) {
    chooseFirstWhileOpen(a);
    chooseFirstWhileOpen(b);
    a.tick(input);
    b.tick(input);
    if (!same(a.snapshot(), b.snapshot())) return i + 1;
  }
  return -1;
}

describe('Recursos sin efecto en el combate (resources)', () => {
  it.each([7, 42])(
    'Scenario: Mismo combate con y sin recursos (semilla %i, 14.400 ticks, ovejas incluidas)',
    (seed) => {
      const inputs = randomInputs(LONG, 2026);
      const withRes = startSeededRun(TOUGH_NO_SITES, seed);
      const without = startSeededRun(withoutResourceSources(TOUGH_NO_SITES), seed);
      expect(without.snapshot().veins).toEqual([]);
      expect(withRes.snapshot().sheep.length).toBeGreaterThan(0);
      const diverged = lockstep(withRes, without, inputs, (x, y) => combat(x) === combat(y));
      expect(diverged).toBe(-1);
      const { gold, wood, stone } = withRes.snapshot().resources;
      expect(gold + wood).toBeGreaterThan(0);
      // 0025: sin fuentes también es probabilidad de piedra 0 (NO_RESOURCES no tiene tabla); con
      // recursos se ha soltado ≥ 1 piedra (recogida o en el suelo).
      const onGround = withRes.snapshot().pickups.filter((p) => p.kind === 'stone').length;
      expect(stone + onGround).toBeGreaterThan(0);
      expect(without.snapshot().resources).toEqual({ gold: 0, wood: 0, stone: 0 });
    },
    60_000,
  );

  it('Scenario: Los recursos no consumen azar (3 gold, 2 wood, 1 veta y 1 barril abatido)', () => {
    const barrel = aBarrelType({ speed: 1e-6 });
    const torch = aStillType({ id: 'goblin-torch', health: 10, xp: 1 });
    const base = aBehaviorConfig([torch, barrel], {
      segments: [aSegment(['goblin-torch'], 30)],
    });
    const config = withDrops(withWeapons(base, weaponsOf([aPulse()])), { wood: 1 });
    const P = { x: 1000, y: 1000 };
    const busy = new CountingRandom(new Mulberry32RandomGenerator(7));
    const idle = new CountingRandom(new Mulberry32RandomGenerator(7));
    // 0023: el azar de las ovejas (una oveja declarada lejos en cada partida) tampoco cambia.
    const busySheep = new CountingRandom(sheepRandom(7));
    const idleSheep = new CountingRandom(sheepRandom(7));
    const far = [{ x: 3000, y: 300 }];
    const a = startOn(
      config,
      { kind: 'open', resources: { veins: [P] }, sheep: { at: far, random: busySheep } },
      {
        player: P,
        enemies: [{ type: 'goblin-barrel', x: 1040, y: 1000, health: 4 }],
        gems: [
          ...Array.from({ length: 3 }, () => ({ kind: 'gold' as const, ...P, value: 2 })),
          ...Array.from({ length: 2 }, () => ({ kind: 'wood' as const, ...P, value: 1 })),
        ],
      },
      busy,
    );
    const b = startOn(
      config,
      {
        kind: 'open',
        resources: { veins: [{ x: 3000, y: 2000 }] },
        sheep: { at: far, random: idleSheep },
      },
      { player: P, enemies: [{ type: 'goblin-barrel', x: 1040, y: 1000 }] },
      idle,
    );
    a.tick(PlayerInput.NONE);
    b.tick(PlayerInput.NONE);
    const sa = a.snapshot();
    expect(sa.status).toBe('running');
    expect(sa.veins[0]?.depleted).toBe(true);
    expect(sa.resources).toEqual({ gold: 6 + (sa.veins[0]?.gold ?? 0), wood: 2, stone: 0 });
    expect(sa.pickups.map((p) => p.kind)).toEqual(['xp', 'wood']);
    expect(b.snapshot().resources).toEqual({ gold: 0, wood: 0, stone: 0 });
    expect(busy.calls).toBe(idle.calls);
    expect(busy.next()).toBe(idle.next());
    expect(busySheep.calls).toBe(idleSheep.calls);
    expect(busySheep.next()).toBe(idleSheep.next());
  });
});

/** Política simple: hacia el objetivo de recursos más cercano (vetas activas y recogibles). */
function greedy(s: RunSnapshot): PlayerInput {
  const { x, y } = s.player;
  const targets = [
    ...s.veins.filter((v) => !v.depleted),
    ...s.pickups.filter((p) => p.kind !== 'xp'),
    ...s.structures.filter((t) => !t.destroyed),
  ];
  let best: { x: number; y: number } | undefined;
  let bestD = Infinity;
  for (const t of targets) {
    const d = Math.hypot(t.x - x, t.y - y);
    if (d < bestD) [best, bestD] = [t, d];
  }
  if (!best) return PlayerInput.NONE;
  const sign = (v: number) => (Math.abs(v) < 2 ? 0 : Math.sign(v));
  return PlayerInput.of(sign(best.x - x), sign(best.y - y));
}

describe('Determinismo con recursos (simulation-loop)', () => {
  it('Scenario: Partida con recursos reproducible (semilla 7, política hacia los recursos)', () => {
    const config = withResources(TOUGH, TOUGH.resources);
    const a = startSeededRun(config, 7);
    const b = startSeededRun(config, 7);
    let reached = -1;
    let barrelWood = false;
    let diverged = -1;
    for (let t = 1; t <= LONG && reached < 0 && diverged < 0; t++) {
      chooseFirstWhileOpen(a);
      chooseFirstWhileOpen(b);
      const input = greedy(a.snapshot());
      const before = a.snapshot();
      a.tick(input);
      b.tick(input);
      const [sa, sb] = [a.snapshot(), b.snapshot()];
      if (JSON.stringify(sa) !== JSON.stringify(sb)) diverged = t;
      const knownWood = new Set(before.pickups.map((p) => p.id));
      barrelWood ||= sa.pickups.some((p) => p.kind === 'wood' && !knownWood.has(p.id));
      if (sa.resources.gold > 0 && sa.resources.wood > 0 && barrelWood) reached = t;
    }
    expect(diverged).toBe(-1);
    expect(reached).toBeGreaterThan(0);
    expect(a.snapshot().resources).toEqual(b.snapshot().resources);
    expect(a.snapshot().veins).toEqual(b.snapshot().veins);
  }, 60_000);
});
