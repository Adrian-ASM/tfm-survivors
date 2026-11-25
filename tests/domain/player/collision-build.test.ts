import { describe, expect, it } from 'vitest';
import { Arena } from '../../../src/domain/arena/Arena';
import { GameMap } from '../../../src/domain/map/GameMap';
import { Player } from '../../../src/domain/player/Player';
import { PlayerInput } from '../../../src/domain/player/PlayerInput';
import { TICK_SECONDS } from '../../../src/domain/run/Run';
import { Vector2 } from '../../../src/domain/shared/Vector2';
import { DEFAULT_CHARACTER_UPGRADES, aDefaultConfig, withUpgrades } from '../../support/builders';
import { mapRules } from '../../support/mapLayouts';
import { advance, ticks } from '../../support/runs';
import {
  FOOTPRINT,
  TEST_SITE,
  TEST_SITE_RECT,
  aSiteConfig,
  leaveSiteIfOpen,
  startWithSites,
} from '../../support/sites';

// Spec build-sites 0026, "Edificios que bloquean el paso", y player-movement, "Colisión con el
// mapa": con el mapa y `build` directo (la partida con solares llega en el grupo 3). Huella del
// solar de prueba: x en [1.200, 1.320] e y en [600, 720]; jugador de radio 16.
const CONTENT = aDefaultConfig();
const WORLD = (() => {
  const r = Arena.create(CONTENT.arena.width, CONTENT.arena.height);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
})();
const RULES = mapRules();
const RADIUS = 16;

function builtMap(): GameMap {
  const map = GameMap.open(RULES);
  const r = map.build(TEST_SITE.col, TEST_SITE.row, FOOTPRINT.cols, FOOTPRINT.rows);
  if (!r.ok) throw new Error(r.error.message);
  return map;
}

function walk(
  map: GameMap,
  start: [number, number],
  input: PlayerInput,
  n: number,
  speed: number,
): Vector2[] {
  let p = Player.spawn(Vector2.of(...start), { ...CONTENT.player, speed });
  const path: Vector2[] = [];
  for (let i = 0; i < n; i++) {
    p = p.move(input, TICK_SECONDS, WORLD, map);
    path.push(p.position);
  }
  return path;
}

const lastOf = (path: readonly Vector2[]): Vector2 => {
  const p = path[path.length - 1];
  if (!p) throw new Error('camino vacío');
  return p;
};

/** ¿Solapa el círculo del jugador alguna celda de la huella del solar de prueba? */
const overlapsFootprint = (p: Vector2): boolean => {
  const { left, top, right, bottom } = TEST_SITE_RECT;
  const ex = Math.max(left - p.x, 0, p.x - right);
  const ey = Math.max(top - p.y, 0, p.y - bottom);
  return ex * ex + ey * ey < RADIUS * RADIUS - 1e-6;
};

describe('Colisión con edificios construidos (spec build-sites / player-movement 0026)', () => {
  it('Scenario: El jugador choca con la casa', () => {
    // Borde del círculo a 100 px de la cara izquierda (x = 1.200), input perpendicular.
    const path = walk(builtMap(), [1200 - RADIUS - 100, 660], PlayerInput.of(1, 0), 60, 200);
    expect(Math.abs(lastOf(path).x - (1200 - RADIUS))).toBeLessThanOrEqual(0.001);
    expect(lastOf(path).y).toBe(660);
    expect(path.some(overlapsFootprint)).toBe(false);
  });

  it('Scenario: Choque con una torre construida a velocidad máxima (5 px/tick)', () => {
    // `shortcuts` en nivel 5: 300 px/s. Cara superior (y = 600), input hacia abajo.
    const path = walk(builtMap(), [1260, 600 - RADIUS - 100], PlayerInput.of(0, 1), 60, 300);
    expect(Math.abs(lastOf(path).y - (600 - RADIUS))).toBeLessThanOrEqual(0.001);
    expect(path.some(overlapsFootprint)).toBe(false);
  });
});

describe('Solar libre que bloquea el paso, en la partida (spec build-sites / player-movement 0027)', () => {
  const at = (s: { player: { x: number; y: number } }) => Vector2.of(s.player.x, s.player.y);

  it('Scenario: El jugador choca con el solar libre', () => {
    // Velocidad del contenido (215 px/s): de g = 3,08 pasaría a solapar y el barrido lo deja tangente.
    const config = aSiteConfig({ player: { speed: CONTENT.player.speed } });
    const run = startWithSites(config, { player: { x: 1260, y: 800 } });
    const snaps = [];
    while (run.status === 'running' && snaps.length < 600) {
      snaps.push(...ticks(run, 1, PlayerInput.of(0, -1)));
    }
    const n = snaps.at(-1);
    expect(n?.status).toBe('building');
    expect(Math.abs((n?.player.x ?? 0) - 1260)).toBeLessThanOrEqual(0.001);
    expect(Math.abs((n?.player.y ?? 0) - 736)).toBeLessThanOrEqual(0.001);
    expect(snaps.some((s) => overlapsFootprint(at(s)))).toBe(false);
    expect(n?.sites[0]?.state).toBe('free');
  });

  it('Scenario: El jugador queda tangente empujando contra el solar libre (600 ticks más)', () => {
    const run = startWithSites(aSiteConfig(), { player: { x: 1260, y: 800 } });
    const snaps = advance(run, 664, PlayerInput.of(0, -1));
    expect(snaps.some((s) => overlapsFootprint(at(s)))).toBe(false);
    expect(snaps.at(-1)?.player.y).toBeCloseTo(736, 9);
  });

  it('Scenario: Deslizar junto al solar libre', () => {
    // Desarmado: la oferta se abre en el tick 1 (tangente) y se cierra sin construir.
    const run = startWithSites(aSiteConfig({ player: { speed: 200 } }), {
      player: { x: 1210, y: 736 },
    });
    ticks(run, 1);
    expect(leaveSiteIfOpen(run)).toBe(true);
    const path = ticks(run, 30, PlayerInput.of(1, -1));
    const last = path.at(-1);
    expect(path.every((s) => s.player.y === 736)).toBe(true);
    expect(Math.abs((last?.player.x ?? 0) - 1280.711)).toBeLessThanOrEqual(0.001);
    expect(path.every((s) => s.status === 'running')).toBe(true);
  });

  it('Scenario: Choque con un solar libre a velocidad máxima', () => {
    // `shortcuts` en nivel 5 sobre 200 px/s: 300 px/s = 5 px/tick.
    const CHARACTER = { character: DEFAULT_CHARACTER_UPGRADES, weapons: [] };
    const config = withUpgrades(aSiteConfig({ player: { speed: 200 } }), CHARACTER);
    const run = startWithSites(config, {
      player: { x: 1100, y: 660 },
      upgrades: { shortcuts: 5 },
    });
    const path = advance(run, 60, PlayerInput.of(1, 0));
    expect(Math.abs((path.at(-1)?.player.x ?? 0) - 1184)).toBeLessThanOrEqual(0.001);
    expect(path.at(-1)?.player.y).toBe(660);
    expect(path.some((s) => overlapsFootprint(at(s)))).toBe(false);
  });
});
