import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { aDefaultConfig, aSegment, aWavesConfig } from '../support/builders';
import { aProbeType, startRun, ticks } from '../support/runs';

const UP_RIGHT = PlayerInput.of(1, 1);

/**
 * Contenido por defecto sin spawns y con un `probe` de vida enorme. En el tick 1 el Linter dispara
 * (proyectil vivo), Tests lanza su pulso (visible), el probe en contacto golpea al jugador
 * (invulnerable) y se recoge la gema que abre la oferta.
 */
function busyConfig(): RunConfig {
  const base = aDefaultConfig();
  const probe = aProbeType({ health: 1e6, speed: 1e-6 });
  return {
    ...base,
    enemies: { types: [...base.enemies.types, probe] },
    waves: aWavesConfig({ segments: [aSegment(['bug'], 0)] }).waves,
  };
}

const busySetup: RunSetup = {
  player: { x: 480, y: 270 },
  enemies: [
    { type: 'probe', x: 495, y: 270 },
    { type: 'probe', x: 800, y: 270 },
  ],
  gems: [
    { x: 500, y: 270, value: 1 },
    { x: 530, y: 270, value: 1, attracted: true },
  ],
  experience: { level: 1, xp: 4 },
};

describe('Simulación congelada mientras se elige mejora', () => {
  it('Scenario: 600 ticks con una oferta abierta (snapshot igual, sin errores)', () => {
    const run = startRun(busyConfig(), busySetup);
    const [n] = ticks(run, 1);
    expect(n?.status).toBe('choosing');
    expect(n?.projectiles.length).toBeGreaterThanOrEqual(1);
    expect(n?.pulses).toHaveLength(1);
    expect(n?.gems.length).toBeGreaterThanOrEqual(1);
    expect(n?.player.invulnerable).toBe(true);
    const after = ticks(run, 600, UP_RIGHT);
    expect(after.at(-1)).toEqual(n);
  });

  it('Scenario: Input ignorado mientras se elige (60 ticks con input (1, 0))', () => {
    const run = startRun(busyConfig(), busySetup);
    ticks(run, 1);
    const after = ticks(run, 60, PlayerInput.of(1, 0)).at(-1);
    expect([after?.player.x, after?.player.y]).toEqual([480, 270]);
  });
});
