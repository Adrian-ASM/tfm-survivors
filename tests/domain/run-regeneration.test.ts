import { describe, expect, it } from 'vitest';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { aDefaultConfig, aDynamite, aSegment, aStillType, aWavesConfig } from '../support/builders';
import { aBehaviorConfig, startRun, ticks } from '../support/runs';
import { withPlayerStat } from '../support/upgrades';

// Spec player-health (0024), "Regeneración de vida": en el paso 7.3 de cada tick múltiplo del
// intervalo sube la vida en la regeneración efectiva, con tope. Mapa vacío, sin armas ni enemigos.

const P = { x: 1000, y: 1000 };

/** Contenido de escenario con intervalo `interval` y regeneración `regen` (mejora de nivel 1). */
const regenConfig = (regen: number, interval = 60): RunConfig =>
  withPlayerStat(
    aBehaviorConfig([aStillType()], { player: { regenIntervalTicks: interval } }),
    'regeneration',
    regen,
  );

const regenRun = (regen: number, health: number, extra: RunSetup = {}, interval = 60) =>
  startRun(regenConfig(regen, interval), {
    player: { ...P, health },
    upgrades: { regeneration: 1 },
    ...extra,
  });

describe('Regeneración de vida (player-health 0024)', () => {
  it('Scenario: Regeneración por intervalo (50 tras el 59, 51 tras el 60 y el 119, 52 tras el 120)', () => {
    const snaps = ticks(regenRun(1, 50), 120);
    const at = (k: number) => snaps[k - 1]?.player.health;

    expect([at(59), at(60), at(119), at(120)]).toEqual([50, 51, 51, 52]);
  });

  it('Scenario: Tope en la vida máxima (99 de 100, regeneración 3: 100 en el tick 60)', () => {
    const s = ticks(regenRun(3, 99), 60).at(-1);

    expect([s?.player.health, s?.player.maxHealth]).toEqual([100, 100]);
  });

  it('Scenario: Sin mejora no regenera (contenido por defecto, 3.600 ticks a 50)', () => {
    const base = aDefaultConfig();
    const config = {
      ...base,
      waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves,
    };
    const snaps = ticks(startRun(config, { player: { ...P, health: 50 } }), 3600);

    expect(snaps.every((s) => s.player.health === 50)).toBe(true);
  });

  it('Scenario: La regeneración no resucita (vida 10, regeneración 5 y golpe de 10 en el 60)', () => {
    const run = regenRun(5, 10, { dynamites: [aDynamite(P, 60, { damage: 10 })] });
    const s = ticks(run, 60).at(-1);

    expect([s?.tick, s?.player.health, s?.status, s?.outcome]).toEqual([60, 0, 'over', 'lost']);
  });

  it('la regeneración no inicia ni cambia la invulnerabilidad', () => {
    const snaps = ticks(regenRun(1, 50), 60);

    expect(snaps.some((s) => s.player.invulnerable)).toBe(false);
  });
});

// Spec simulation-loop (0024), paso 7.3 tras 7.1.
describe('Orden de la regeneración en el tick', () => {
  it('Scenario: Regeneración tras los recogibles (99 de 100, carne en el tick 60: 100)', () => {
    // Carne atraída a 6 px/tick que el jugador (radio 16) recoge justo en el tick 60.
    const meat = {
      kind: 'meat' as const,
      x: P.x + 21 + 6 * 59 + 3,
      y: P.y,
      value: 1,
      attracted: true,
    };
    const snaps = ticks(regenRun(5, 99, { gems: [meat] }), 60);

    expect(snaps[58]?.pickups).toHaveLength(1);
    expect(snaps[59]?.pickups).toEqual([]);
    expect(snaps[59]?.player.health).toBe(100);
  });
});
