import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import { SETUP_TOO_MANY_SITES } from '../../src/domain/run/RunSetup';
import type { TerrainSource } from '../../src/domain/map/TerrainSource';
import { MAP_SITE_OVERLAPS_PLAYER } from '../../src/domain/site/resolveSites';
import { MAP_SHEEP_ILLEGAL } from '../../src/domain/sheep/resolveSheep';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aDefaultConfig, withSheep } from '../support/builders';
import { ticks } from '../support/runs';
import { sheepRandom } from '../support/sheep';
import {
  TEST_SITE,
  TOUCH,
  aSiteConfig,
  declaredSites,
  startWithSites,
  withRearm,
} from '../support/sites';

const start = (terrain: TerrainSource, config = aDefaultConfig()) =>
  Run.start(config, new Mulberry32RandomGenerator(42), {}, terrain);

// Spec build-sites 0027, "Solar libre que bloquea el paso", y procedural-map, "Mapa explícito y mapa
// vacío": validaciones de arranque tras marcar las huellas (design 0027 §1.3).
describe('Arranque con solares bloqueantes (spec build-sites / procedural-map 0027)', () => {
  it.each([
    ['Solar declarado sobre el jugador (build-sites)'],
    ['Solar declarado sobre la posición inicial (procedural-map)'],
  ])('Scenario: %s (huella en las columnas 31–32 y filas 17–18)', () => {
    const r = start(declaredSites([{ col: 31, row: 17 }]));
    expect(r.ok).toBe(false);
    expect(r.ok ? '' : r.error.field).toBe('map.sites.0');
    expect(r.ok ? '' : r.error.message).toContain(MAP_SITE_OVERLAPS_PLAYER);
    expect(r.ok ? '' : r.error.message).toMatch(/solar/i);
  });

  it('Scenario: Solar declarado sobre el jugador (tangente, g = 0: se crea)', () => {
    const terrain: TerrainSource = {
      kind: 'open',
      start: { x: 1904, y: 1080 },
      sites: [{ col: 32, row: 18 }],
    };
    expect(start(terrain).ok).toBe(true);
  });

  it('el error nombra el solar que solapa (el segundo de la lista)', () => {
    const r = start(
      declaredSites([
        { col: 10, row: 5 },
        { col: 31, row: 17 },
      ]),
    );
    expect(r.ok ? '' : r.error.field).toBe('map.sites.1');
  });

  it.each([
    ['dentro de la huella', 660, false],
    ['a 15 px de la cara inferior', 735, false],
    ['tangente a la cara inferior', 740, true],
  ])('Scenario: Oveja declarada sobre el solar libre (%s)', (_name, y, created) => {
    const terrain: TerrainSource = {
      kind: 'open',
      sites: [TEST_SITE],
      sheep: { at: [{ x: 1260, y }], random: sheepRandom(42) },
    };
    const r = start(terrain, withSheep(aDefaultConfig()));
    expect(r.ok).toBe(created);
    if (!created) {
      expect(r.ok ? '' : r.error.field).toBe('map.sheep.0');
      expect(r.ok ? '' : r.error.message).toContain(MAP_SHEEP_ILLEGAL);
    }
  });

  it('un solar de `RunSetup.sites` con `armed: false` empieza desarmado y no se arma a g < X', () => {
    const run = startWithSites(withRearm(aSiteConfig(), 1e6), {
      player: TOUCH,
      sites: [{ armed: false }],
    });
    expect(run.snapshot().sites[0]?.armed).toBe(false);
    const snaps = ticks(run, 600, PlayerInput.of(0, 1));
    expect(snaps.every((x) => x.status === 'running' && x.sites[0]?.armed === false)).toBe(true);
  });
});

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
