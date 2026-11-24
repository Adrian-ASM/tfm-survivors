import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../../src/domain/player/PlayerInput';
import type { RunSnapshot } from '../../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  DEFAULT_ENEMY_TYPES,
  aSegment,
  anUpgrade,
  withDuration,
  withUpgrades,
  withWeapons,
} from '../../support/builders';
import {
  HOUSE_AT_20_10,
  TNT_GUARD,
  aCampScenario,
  aCampsConfig,
  aGuardAt,
  aStructuresConfig,
  startDeclared,
} from '../../support/camps';
import { CountingRandom } from '../../support/random';
import { aProbeType, ticks } from '../../support/runs';
import { aLinter, weaponsOf } from '../../support/weapons';

const DOOR = { x: 1290, y: 810 };
const FAR = { x: 3000, y: 2000 };
const TORCH = aProbeType({ id: 'goblin-torch', speed: 90, health: 10, damage: 5 });
const houseOf = (max: number, everyTicks: number, health = 30) => ({
  health,
  guards: { type: 'guard', max, everyTicks },
});
const guards = (s: RunSnapshot | undefined) => s?.enemies.filter((e) => e.type === 'guard') ?? [];

describe('Nacimiento de guardias · lugar en el tick (enemy-spawning, simulation-loop, run-state)', () => {
  it('Scenario: El director va antes que las casas', () => {
    const config = aCampScenario({
      types: [TORCH],
      segments: [aSegment(['goblin-torch'], 60)],
      maxAlive: 1,
      house: houseOf(2, 1),
    });
    const [s] = ticks(startDeclared(config, [HOUSE_AT_20_10], { player: FAR }), 1);
    expect(s?.enemies.map((e) => e.type)).toEqual(['goblin-torch']);
  });

  it('Scenario: Sin nacimientos en el tick final', () => {
    const config = withDuration(aCampScenario({ house: houseOf(2, 120) }), 2);
    const snaps = ticks(startDeclared(config, [HOUSE_AT_20_10], { player: FAR }), 120);
    const last = snaps[119];
    expect([last?.status, last?.outcome]).toEqual(['over', 'won']);
    const before = new Set(snaps[118]?.enemies.map((e) => e.id));
    expect(last?.enemies.filter((e) => !before.has(e.id))).toEqual([]);
  });

  it('Scenario: Nacer no consume azar', () => {
    const config = aCampScenario({ house: houseOf(1, 5) });
    const withHouse = new CountingRandom(new Mulberry32RandomGenerator(7));
    const without = new CountingRandom(new Mulberry32RandomGenerator(7));
    const a = startDeclared(config, [HOUSE_AT_20_10], { player: FAR }, withHouse);
    const b = startDeclared(config, [], { player: FAR }, without);
    const born = ticks(a, 5)[4];
    ticks(b, 5);
    expect(guards(born)).toHaveLength(1);
    expect(withHouse.calls).toBe(without.calls);
    expect(withHouse.next()).toBe(without.next());
  });

  it('Scenario: Una casa destruida no hace nacer en ese tick', () => {
    const config = withWeapons(aCampScenario({ house: houseOf(1, 35, 6) }), weaponsOf([aLinter()]));
    const run = startDeclared(config, [HOUSE_AT_20_10], { player: { x: 1260, y: 1000 } });
    const snaps = ticks(run, 35);
    expect(snaps[33]?.structures[0]?.destroyed).toBe(false);
    expect(snaps[34]?.structures[0]?.destroyed).toBe(true);
    expect(snaps.every((s) => s.enemies.length === 0)).toBe(true);
  });

  it('Scenario: El guardia nacido no se mueve en su tick', () => {
    const config = aCampScenario({ house: houseOf(1, 10) });
    const run = startDeclared(config, [HOUSE_AT_20_10], { player: { x: 1320, y: 810 } });
    const s = ticks(run, 10)[9];
    expect(guards(s)).toEqual([expect.objectContaining({ ...DOOR, stateKind: 'patrol' })]);
    expect([s?.player.health, s?.player.invulnerable]).toEqual([100, false]);
  });

  it('Scenario: Estructuras congeladas al terminar', () => {
    const config = withWeapons(
      withDuration(aCampScenario({ house: houseOf(2, 70) }), 1),
      weaponsOf([aLinter()]),
    );
    const run = startDeclared(config, [HOUSE_AT_20_10, { ...HOUSE_AT_20_10, col: 40 }], {
      player: { x: 1260, y: 1000 },
      structures: [{}, { health: 0 }],
      enemies: [aGuardAt(3200, 300)],
    });
    const ended = ticks(run, 60)[59];
    expect(ended?.status).toBe('over');
    expect(ended?.projectiles.length).toBeGreaterThan(0);
    expect(guards(ended)[0]?.stateKind).toBe('patrol');
    ticks(run, 600, PlayerInput.of(1, 1));
    expect(run.snapshot()).toEqual(ended);
  });

  it('Scenario: Nacimiento en pausa durante la oferta', () => {
    const config = withUpgrades(aCampScenario({ house: houseOf(1, 6) }), {
      upgrades: [anUpgrade('guardrail')],
    });
    const run = startDeclared(config, [HOUSE_AT_20_10], {
      player: FAR,
      experience: { level: 1, xp: 4 },
      gems: [{ ...FAR, value: 1 }],
    });
    const [open] = ticks(run, 1);
    expect(open?.status).toBe('choosing');
    ticks(run, 600);
    expect(run.snapshot()).toEqual(open);
    expect(run.chooseUpgrade(0).ok).toBe(true);
    const after = ticks(run, 5);
    expect(after.slice(0, 4).map((s) => guards(s).length)).toEqual([0, 0, 0, 0]);
    expect([after[4]?.tick, guards(after[4]).length]).toEqual([6, 1]);
  });

  it('Scenario: Estado inicial al aparecer (oleada y guardia del contenido por defecto)', () => {
    const base = aCampsConfig(
      aStructuresConfig({
        house: { guards: { type: TNT_GUARD.id, max: 1, everyTicks: 30 } },
      }),
    );
    const segments = [aSegment(['goblin-torch', 'goblin-tnt', 'goblin-barrel'], 60)];
    const config = { ...base, waves: { ...base.waves, segments } };
    const run = startDeclared(config, [HOUSE_AT_20_10]);
    const seen = new Map<string, string>();
    const known = new Set<number>();
    for (const s of ticks(run, 120)) {
      for (const e of s.enemies) {
        if (known.has(e.id)) continue;
        known.add(e.id);
        if (!seen.has(e.type)) seen.set(e.type, `${e.state}/${e.stateKind}`);
      }
    }
    const initial = Object.fromEntries(
      DEFAULT_ENEMY_TYPES.map((t) => [t.id, `${t.behavior.initial}/chase`]),
    );
    expect(Object.fromEntries(seen)).toEqual({ ...initial, [TNT_GUARD.id]: 'patrol/patrol' });
  });
});
