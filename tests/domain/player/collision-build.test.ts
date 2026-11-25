import { describe, expect, it } from 'vitest';
import { Arena } from '../../../src/domain/arena/Arena';
import { GameMap } from '../../../src/domain/map/GameMap';
import { Player } from '../../../src/domain/player/Player';
import { PlayerInput } from '../../../src/domain/player/PlayerInput';
import { TICK_SECONDS } from '../../../src/domain/run/Run';
import { Vector2 } from '../../../src/domain/shared/Vector2';
import { aDefaultConfig } from '../../support/builders';
import { mapRules } from '../../support/mapLayouts';
import { FOOTPRINT, TEST_SITE, TEST_SITE_RECT } from '../../support/sites';

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

  it('Scenario: Un solar sin construir no bloquea', () => {
    const start: [number, number] = [1100, 660];
    const input = PlayerInput.of(1, 0);
    const free = GameMap.open(RULES);
    const across = walk(free, start, input, 90, 200);
    const reference = walk(GameMap.open(RULES), start, input, 90, 200);
    expect(lastOf(across).x).toBeGreaterThan(TEST_SITE_RECT.right + RADIUS);
    expect(across).toEqual(reference);
  });
});
