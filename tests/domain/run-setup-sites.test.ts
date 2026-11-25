import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import { SETUP_TOO_MANY_SITES } from '../../src/domain/run/RunSetup';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { ticks } from '../support/runs';
import { TEST_SITE, aSiteConfig, declaredSites, startWithSites } from '../support/sites';

// Escenarios preparados de 0026 (bench e invariantes con edificios): `RunSetup.sites` construye
// solares antes del tick 1 (en el tick 0), con el mismo efecto que construirlos en la obra: la huella
// bloquea, se despeja y una torre dispara. No consume azar.
describe('RunSetup.sites (solares construidos al empezar)', () => {
  it('construye en el tick 0: estado, caminabilidad y sin obra abierta', () => {
    const run = startWithSites(aSiteConfig(), {
      player: { x: 1260, y: 900 },
      sites: [{ state: 'house' }],
    });
    const s = run.snapshot();
    expect([s.sites[0]?.state, s.sites[0]?.armed, s.status]).toEqual(['house', true, 'running']);
    // Hacia arriba, el jugador queda tangente a la cara inferior de la huella (y = 720).
    const up = ticks(run, 300, PlayerInput.of(0, -1));
    expect(up.at(-1)?.player.y).toBeCloseTo(736, 3);
  });

  it('una torre preparada dispara desde el tick 1 y un enemigo en la huella se despeja', () => {
    const run = startWithSites(aSiteConfig({ player: { maxHealth: 1e6 } }), {
      player: { x: 1260, y: 900 },
      enemies: [{ type: 'probe', x: 1230, y: 630 }],
      sites: [{ state: 'tower' }],
    });
    const e = run.snapshot().enemies[0];
    const inFootprint = (x: number, y: number) => x >= 1200 && x < 1320 && y >= 600 && y < 720;
    expect(inFootprint(e?.x ?? 1260, e?.y ?? 660)).toBe(false);
    expect(ticks(run, 1)[0]?.towerProjectiles).toHaveLength(1);
  });

  it('más entradas que solares es un error', () => {
    const r = Run.start(
      aSiteConfig(),
      new Mulberry32RandomGenerator(42),
      { sites: [{ state: 'house' }, { state: 'tower' }] },
      declaredSites([TEST_SITE]),
    );
    expect(r.ok ? '' : r.error.message).toBe(SETUP_TOO_MANY_SITES);
  });
});
