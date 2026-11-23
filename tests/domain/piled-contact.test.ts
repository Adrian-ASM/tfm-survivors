import { describe, expect, it } from 'vitest';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { LONG_RUN_HEALTH, aDefaultConfig, withPlayer } from '../support/builders';
import { advance, pileOnPlayer, startRun } from '../support/runs';

// Spec simulation-loop (0013), "Contacto con cualquier tamaño de mundo": la preparación del bench
// "200 enemigos encima del jugador" con el mundo por defecto y con una arena de 4.000 × 4.000.
const MEASURED_TICKS = 600;
const PILE = 200;

/** Vida inalcanzable para jugador y enemigos, como en el bench (las armas no vacían el montón). */
const immortal = (config: RunConfig): RunConfig => ({
  ...withPlayer(config, { maxHealth: LONG_RUN_HEALTH }),
  enemies: { types: config.enemies.types.map((t) => ({ ...t, health: LONG_RUN_HEALTH })) },
});

const bigWorld = (config: RunConfig): RunConfig => ({
  ...config,
  arena: { width: 4000, height: 4000 },
});

/** ¿Algún enemigo a ≤ r_jugador + r_enemigo del jugador? */
const inContact = (s: RunSnapshot, playerRadius: number): boolean =>
  s.enemies.some((e) => Math.hypot(e.x - s.player.x, e.y - s.player.y) <= playerRadius + e.radius);

describe('200 enemigos encima del jugador con cualquier tamaño de mundo (0013)', () => {
  it.each([
    ['mundo por defecto', immortal(aDefaultConfig())],
    ['arena explícita de 4.000 × 4.000', bigWorld(immortal(aDefaultConfig()))],
  ])('Scenario: Contacto con cualquier tamaño de mundo (%s)', (_name, config) => {
    const run = startRun(config, pileOnPlayer(config, PILE));

    const snaps = advance(run, MEASURED_TICKS);

    expect(run.snapshot().enemies).toHaveLength(PILE);
    expect(snaps.filter((s) => !inContact(s, config.player.radius))).toEqual([]);
    expect(snaps.every((s) => s.status === 'running')).toBe(true);
  });
});
