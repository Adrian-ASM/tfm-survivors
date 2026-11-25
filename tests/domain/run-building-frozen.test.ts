import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { Run } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { LINTER, aSegment, withWeapons } from '../support/builders';
import { aBehaviorConfig, aProbeType, ticks } from '../support/runs';
import { declaredSheep } from '../support/sheep';
import { leaveSiteIfOpen, startWithSites, untilBuilding, withStock } from '../support/sites';

// Spec run-state 0026, "Simulación congelada en obra". El solar de prueba se abre en el tick 6
// (jugador desde g = 7 bajo la cara inferior, hacia arriba a 1 px por tick: g = 1 en el tick 6).
const UP = PlayerInput.of(0, -1);
const START = { x: 1260, y: 743 };

/**
 * Partida "llena" al abrirse la obra: un enemigo inmortal a 350 px, el Linter con cadencia 1
 * (proyectiles en vuelo), una gema atraída, una oveja huyendo, oleadas de `probe` (el director
 * consume azar) y una dinamita que golpea al jugador en el tick 1 (invulnerable hasta el 31).
 */
function fullConfig(): RunConfig {
  const base = aBehaviorConfig([aProbeType({ health: 1e6 })], {
    player: { speed: 60, pickupRadius: 128 },
    segments: [aSegment(['probe'], 1)],
  });
  const weapons = {
    maxProjectiles: 32,
    hitFlashTicks: 4,
    weapons: [{ ...LINTER, cooldownTicks: 1 }],
  };
  return withWeapons(base, weapons);
}

function fullRun(seed = 42): Run {
  const sheep = declaredSheep([{ x: START.x + 100, y: START.y }], { seed });
  return startWithSites(
    fullConfig(),
    {
      ...withStock(15),
      player: START,
      enemies: [{ type: 'probe', x: START.x + 350, y: START.y }],
      gems: [{ x: START.x - 120, y: START.y, value: 1 }],
      dynamites: [
        { ...START, targetX: START.x, targetY: START.y, ticksLeft: 1, radius: 30, damage: 5 },
      ],
    },
    undefined,
    sheep.kind === 'open' && sheep.sheep ? { sheep: sheep.sheep } : {},
  );
}

describe('Simulación congelada en obra (spec run-state 0026)', () => {
  it('Scenario: 600 ticks en obra', () => {
    const run = fullRun();
    const n = untilBuilding(run, 10, UP);
    const at = run.snapshot();
    expect(n).toBe(6);
    expect(at.enemies.length).toBeGreaterThanOrEqual(1);
    expect(at.projectiles.length).toBeGreaterThanOrEqual(1);
    expect(at.pickups.some((p) => p.kind === 'xp')).toBe(true);
    expect(at.player.invulnerable).toBe(true);
    expect(at.sheep[0]?.state).toBe('flee');

    const during = ticks(run, 600, PlayerInput.of(1, 1));

    expect(during.every((s) => JSON.stringify(s) === JSON.stringify(at))).toBe(true);
    expect(run.snapshot()).toEqual(at);
  });

  it('Scenario: La obra no consume azar', () => {
    const a = fullRun(7);
    const b = fullRun(7);
    untilBuilding(a, 10, UP);
    untilBuilding(b, 10, UP);
    ticks(a, 600, UP);
    leaveSiteIfOpen(a);
    leaveSiteIfOpen(b);
    const left = ticks(a, 600, UP);
    const right = ticks(b, 600, UP);
    expect(left.map((s) => s.tick)).toEqual(right.map((s) => s.tick));
    expect(JSON.stringify(left)).toBe(JSON.stringify(right));
  });
});
