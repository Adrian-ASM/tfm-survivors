import { describe, expect, it } from 'vitest';
import { Arena } from '../../src/domain/arena/Arena';
import type { GameMap } from '../../src/domain/map/GameMap';
import { Player } from '../../src/domain/player/Player';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { TICK_SECONDS } from '../../src/domain/run/Run';
import { Vector2 } from '../../src/domain/shared/Vector2';
import { aDefaultConfig } from '../support/builders';
import { mapRules, mapWith, type Layout } from '../support/mapLayouts';

// Spec player-movement (0015), "Colisión con el mapa". Rejilla por defecto: celda (c, r) en
// [60c, 60c + 60] × [60r, 60r + 60]; jugador de radio 16 y 200 px/s salvo que se diga otra cosa.
const CONTENT = aDefaultConfig();
const WORLD = (() => {
  const r = Arena.create(CONTENT.arena.width, CONTENT.arena.height);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
})();
const RULES = mapRules();
const TRUNK_10_4: Layout = { '10,4': 'trunk' };

function expectWithinSpec(actual: number, expected: number): void {
  expect(Math.abs(actual - expected), `${String(actual)} vs ${String(expected)}`).toBeLessThan(
    0.001,
  );
}

/** Mueve al jugador `n` ticks y devuelve las posiciones tras cada uno. */
function walk(
  map: GameMap,
  start: [number, number],
  input: PlayerInput,
  n: number,
  speed = CONTENT.player.speed,
): Vector2[] {
  let p = Player.spawn(Vector2.of(...start), { ...CONTENT.player, speed });
  const path: Vector2[] = [];
  for (let i = 0; i < n; i++) {
    p = p.move(input, TICK_SECONDS, WORLD, map);
    path.push(p.position);
  }
  return path;
}

const last = (path: readonly Vector2[]): Vector2 => {
  const p = path[path.length - 1];
  if (!p) throw new Error('camino vacío');
  return p;
};

const overlapsAny = (map: GameMap, path: readonly Vector2[], r = 16): boolean =>
  path.some((p) => map.overlapsBlocked(p.x, p.y, r));

describe('GameMap · solape con celdas no caminables', () => {
  const map = mapWith(RULES, TRUNK_10_4);

  it('tangencia no es solape; un poco más cerca sí', () => {
    expect(map.overlapsBlocked(584, 270, 16)).toBe(false);
    expect(map.overlapsBlocked(584.01, 270, 16)).toBe(true);
  });

  it('esquina: distancia euclídea al punto más cercano del rectángulo cerrado', () => {
    const d = 16 / Math.SQRT2;
    expect(map.overlapsBlocked(600 - d, 240 - d, 16)).toBe(false);
    expect(map.overlapsBlocked(600 - d + 0.01, 240 - d + 0.01, 16)).toBe(true);
  });

  it('el puente y la hierba no bloquean', () => {
    const bridge = mapWith(RULES, { '10,4': 'bridge' });
    expect(bridge.overlapsBlocked(630, 270, 16)).toBe(false);
  });
});

describe('Colisión con el mapa (spec player-movement)', () => {
  it('Scenario: Choque frontal con un tronco', () => {
    const map = mapWith(RULES, TRUNK_10_4);
    const end = last(walk(map, [560, 270], PlayerInput.of(1, 0), 60));
    expectWithinSpec(end.x, 584);
    expectWithinSpec(end.y, 270);
  });

  it('Scenario: Choque a velocidad máxima (300 px/s, 5 px/tick)', () => {
    const map = mapWith(RULES, TRUNK_10_4);
    const path = walk(map, [500, 270], PlayerInput.of(1, 0), 60, 300);
    expectWithinSpec(last(path).x, 584);
    expect(overlapsAny(map, path)).toBe(false);
  });

  it('Scenario: Deslizar a lo largo de una fila de troncos', () => {
    const column: Layout = {
      '10,2': 'trunk',
      '10,3': 'trunk',
      '10,4': 'trunk',
      '10,5': 'trunk',
      '10,6': 'trunk',
    };
    const map = mapWith(RULES, column);
    const end = last(walk(map, [584, 270], PlayerInput.of(1, 1), 30));
    expect(end.x).toBe(584);
    expectWithinSpec(end.y - 270, 70.711);
  });

  it('Scenario: Rodear la esquina de un tronco', () => {
    const map = mapWith(RULES, TRUNK_10_4);
    const path = walk(map, [630, 224], PlayerInput.of(1, 1), 60);
    expectWithinSpec(last(path).x, 771.421);
    expect(last(path).y).toBeGreaterThan(224);
    expect(overlapsAny(map, path)).toBe(false);
  });

  it('Scenario: Sin paso entre dos troncos en diagonal', () => {
    const map = mapWith(RULES, { '10,4': 'trunk', '11,5': 'trunk' });
    const path = walk(map, [700, 260], PlayerInput.of(-1, 1), 120);
    expectWithinSpec(last(path).x, 676);
    expectWithinSpec(last(path).y, 284);
    const inCell = path.some((p) => {
      const cell = map.cellAt(p.x, p.y);
      return cell.col === 10 && cell.row === 5;
    });
    expect(inCell).toBe(false);
    expect(overlapsAny(map, path)).toBe(false);
  });

  const river = (): Layout => {
    const layout: Record<string, 'water' | 'bridge'> = {};
    for (let c = 0; c < RULES.cols; c++) layout[`${String(c)},9`] = c === 16 ? 'bridge' : 'water';
    return layout;
  };

  it('Scenario: Cruzar un río por el puente', () => {
    const end = last(walk(mapWith(RULES, river()), [990, 500], PlayerInput.of(0, 1), 60));
    expectWithinSpec(end.x, 990);
    expectWithinSpec(end.y, 700);
  });

  it('Scenario: El agua frena fuera del puente', () => {
    const end = last(walk(mapWith(RULES, river()), [950, 500], PlayerInput.of(0, 1), 60));
    expectWithinSpec(end.x, 950);
    expectWithinSpec(end.y, 524);
  });

  it('Scenario: Sin movimiento contra un obstáculo', () => {
    const map = mapWith(RULES, TRUNK_10_4);
    const path = walk(map, [584, 270], PlayerInput.of(1, 0), 60);
    expect(path.every((p) => p.x === 584 && p.y === 270)).toBe(true);
  });

  it('sin rebote: cada componente del paso tiene el signo del movimiento libre o vale 0', () => {
    const map = mapWith(RULES, { '10,4': 'trunk', '11,5': 'trunk' });
    let prev = Vector2.of(700, 260);
    for (const p of walk(map, [700, 260], PlayerInput.of(-1, 1), 120)) {
      expect(p.x - prev.x).toBeLessThanOrEqual(0);
      expect(p.y - prev.y).toBeGreaterThanOrEqual(0);
      prev = p;
    }
  });

  it('hacia −x y −y: tangente a la cara derecha e inferior', () => {
    const map = mapWith(RULES, TRUNK_10_4);
    expectWithinSpec(last(walk(map, [700, 270], PlayerInput.of(-1, 0), 60)).x, 676);
    expectWithinSpec(last(walk(map, [630, 350], PlayerInput.of(0, -1), 60)).y, 316);
  });
});
