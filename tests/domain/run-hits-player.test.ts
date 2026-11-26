import { describe, expect, it } from 'vitest';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { aDynamite, aStillType } from '../support/builders';
import { hitsOfTick } from '../support/combat';
import { aBehaviorConfig, startRun, ticks } from '../support/runs';
import { withPlayerStat } from '../support/upgrades';

// Spec simulation-loop (0031), "Registro de golpes de combate": el golpe único del paso 5 al
// jugador, con la armadura y el mínimo 1 ya aplicados. Mapa vacío, sin armas.

const TYPES = [
  aStillType({ id: 'scratch', damage: 2 }),
  aStillType({ id: 'hitter', damage: 10 }),
  aStillType({ id: 'brute', damage: 15 }),
];

const onPlayer = (type: string, at: { x: number; y: number }) => ({ type, ...at });

/** Partida sin armas con el jugador en `at`, la vida dada y, si se pide, armadura (mejora 1). */
function playerRun(at: { x: number; y: number }, setup: RunSetup, o: { armor?: number } = {}) {
  const base = aBehaviorConfig(TYPES);
  const config = o.armor === undefined ? base : withPlayerStat(base, 'armor', o.armor);
  const upgrades = o.armor === undefined ? {} : { upgrades: { armor: 1 } };
  return startRun(config, { ...setup, player: { ...at, ...setup.player }, ...upgrades });
}

const playerHits = (s: RunSnapshot | undefined) => hitsOfTick(s).filter((h) => h.kind === 'player');

describe('Run · golpes al jugador (0031)', () => {
  it('Scenario: Golpe al jugador con armadura', () => {
    const at = { x: 480, y: 270 };
    const run = playerRun(at, { enemies: [onPlayer('scratch', at)] }, { armor: 3 });
    const [s] = ticks(run, 1);
    expect(s?.player.health).toBe(99);
    expect(hitsOfTick(s)).toEqual([{ id: 0, tick: 1, kind: 'player', x: 480, y: 270, amount: 1 }]);
    expect(hitsOfTick(s)[0]).not.toHaveProperty('targetId');
  });

  it('Scenario: Un solo golpe al jugador con contacto y explosión', () => {
    const at = { x: 1000, y: 1000 };
    const setup = {
      enemies: [onPlayer('brute', at)],
      dynamites: [aDynamite(at, 1, { damage: 25 })],
    };
    const [s] = ticks(playerRun(at, setup), 1);
    expect(s?.player.health).toBe(75);
    expect(playerHits(s).map((h) => h.amount)).toEqual([25]);
  });

  it('Scenario: Jugador invulnerable sin golpe', () => {
    const at = { x: 1000, y: 1000 };
    const snaps = ticks(playerRun(at, { enemies: [onPlayer('hitter', at)] }), 31);
    const t = snaps[0];
    expect(playerHits(t).map((h) => h.amount)).toEqual([10]);
    const after = snaps.slice(1, 31);
    expect(after.map((s) => s.player.health)).toEqual(after.map(() => 90));
    expect(after.flatMap(playerHits)).toEqual([]);
  });

  it('Scenario: Golpe letal al jugador', () => {
    const at = { x: 1000, y: 1000 };
    const setup = { player: { ...at, health: 5 }, dynamites: [aDynamite(at, 1, { damage: 25 })] };
    const [s] = ticks(playerRun(at, setup), 1);
    expect([s?.status, s?.outcome]).toEqual(['over', 'lost']);
    expect(playerHits(s).map((h) => h.amount)).toEqual([5]);
  });

  it('Scenario: Las curaciones no son golpes', () => {
    const at = { x: 1000, y: 1000 };
    const config = withPlayerStat(aBehaviorConfig(TYPES), 'regeneration', 1);
    const meat = { kind: 'meat' as const, ...at, value: 1 };
    const run = startRun(config, {
      player: { ...at, health: 50 },
      upgrades: { regeneration: 1 },
      gems: [meat],
    });
    const snaps = ticks(run, 121);
    expect(snaps.at(-1)?.player.health).toBeGreaterThan(50);
    expect(snaps.flatMap((s) => hitsOfTick(s))).toEqual([]);
  });
});
