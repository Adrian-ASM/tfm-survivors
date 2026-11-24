import { describe, expect, it } from 'vitest';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import {
  aDefaultConfig,
  aDynamite,
  aSegment,
  aStillType,
  aWavesConfig,
  withScenarioCurve,
} from '../support/builders';
import { aBehaviorConfig, aProbeType, startRun, ticks } from '../support/runs';
import { withPlayerStat } from '../support/upgrades';

// Spec player-health (0024), "Daño discreto por contacto": daño aplicado max(1, bruto − armadura).
// Mapa vacío, sin armas; jugador de radio 16 en (1.000, 1.000) y enemigos quietos encima.

const P = { x: 1000, y: 1000 };

/** Partida con armadura `armor` (una mejora de nivel 1 con ese `perLevel`) y la vida dada. */
function armored(armor: number, setup: RunSetup, health = 100) {
  const types = [aStillType({ id: 'hitter', damage: 10 }), aStillType({ id: 'brute', damage: 15 })];
  const config = withPlayerStat(aBehaviorConfig(types), 'armor', armor);
  return startRun(config, { ...setup, player: { ...P, health }, upgrades: { armor: 1 } });
}

const afterOne = (run: ReturnType<typeof startRun>): RunSnapshot => {
  const [s] = ticks(run, 1);
  if (!s) throw new Error('sin snapshot');
  return s;
};

describe('Armadura (player-health 0024)', () => {
  it('Scenario: Armadura sobre un contacto (armadura 3, damage 10: 93 e invulnerable)', () => {
    const s = afterOne(armored(3, { enemies: [{ type: 'hitter', ...P }] }));

    expect([s.player.health, s.player.invulnerable]).toEqual([93, true]);
  });

  it('Scenario: Armadura sobre el golpe único (contacto 15 y explosión 25: 78)', () => {
    const run = armored(3, {
      enemies: [{ type: 'brute', ...P }],
      dynamites: [aDynamite(P, 1, { damage: 25 })],
    });

    expect(afterOne(run).player.health).toBe(78);
  });

  it.each([12, 10])('Scenario: Daño mínimo 1 (armadura %i, damage 10: 99 e invulnerable)', (a) => {
    const s = afterOne(armored(a, { enemies: [{ type: 'hitter', ...P }] }));

    expect([s.player.health, s.player.invulnerable]).toEqual([99, true]);
  });

  it('Scenario: La armadura no evita la derrota (vida 1, armadura 50)', () => {
    const s = afterOne(armored(50, { enemies: [{ type: 'hitter', ...P }] }, 1));

    expect([s.player.health, s.status, s.outcome]).toEqual([0, 'over', 'lost']);
  });
});

// Spec player-health (0024), "Invulnerabilidad temporal tras un golpe": N efectiva en el golpe.
describe('Invulnerabilidad mejorada (player-health 0024)', () => {
  /** Ticks (desde 1) en los que baja la vida. */
  const hitTicks = (snaps: readonly RunSnapshot[], start = 100): number[] =>
    snaps.flatMap((s, i) =>
      s.player.health < (snaps[i - 1]?.player.health ?? start) ? [s.tick] : [],
    );

  it('Scenario: Invulnerabilidad mejorada (steady-nerves +10: 90 tras el 41 y 80 tras el 42)', () => {
    const types = [aStillType({ id: 'hitter', damage: 10 })];
    const config = withPlayerStat(aBehaviorConfig(types), 'steady-nerves', 10);
    const run = startRun(config, {
      player: P,
      enemies: [{ type: 'hitter', ...P }],
      upgrades: { 'steady-nerves': 1 },
    });

    const snaps = ticks(run, 42);

    expect([snaps[40]?.player.health, snaps[41]?.player.health]).toEqual([90, 80]);
    expect(hitTicks(snaps)).toEqual([1, 42]);
  });

  it('Scenario: Mejora durante la invulnerabilidad (golpes en 10, 41 y 82, nada entre medias)', () => {
    const base = withScenarioCurve(aDefaultConfig());
    const probe = aProbeType({ damage: 10, health: 1e6 });
    const config = withPlayerStat(
      {
        ...base,
        enemies: { ...base.enemies, types: [...base.enemies.types, probe] },
        waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves,
      },
      'steady-nerves',
      10,
    );
    // El probe (1 px/tick) entra en contacto en el tick 10; la gema atraída se recoge en el 20.
    const run = startRun(config, {
      player: { x: 480, y: 270 },
      enemies: [{ type: 'probe', x: 480 + 35, y: 270 }],
      gems: [{ x: 480, y: 270 - 138, value: 1, attracted: true }],
      experience: { level: 1, xp: 4 },
    });

    const first = ticks(run, 20);
    expect(first.at(-1)?.offer.map((o) => o.id)).toEqual(['steady-nerves']);
    expect(run.chooseUpgrade(0).ok).toBe(true);
    const rest = ticks(run, 62);

    expect(hitTicks([...first, ...rest])).toEqual([10, 41, 82]);
  });
});
