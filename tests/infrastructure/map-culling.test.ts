import { describe, expect, it } from 'vitest';
import { followView } from '../../src/infrastructure/phaser/CameraRig';
import {
  clipRect,
  cullMargin,
  touches,
  CULL_MARGIN_CELLS,
} from '../../src/infrastructure/phaser/map/mapCulling';
import type { Box } from '../../src/infrastructure/phaser/map/planMapArt';
import { WORLD } from '../support/mapArt';

// Spec sprite-rendering (0018), "Recorte del arte del mapa por cámara": regla pura (design §4).
// Las cajas se escriben como en la spec, (x1, y1)–(x2, y2).
const box = (x1: number, y1: number, x2: number, y2: number): Box => ({
  x: x1,
  y: y1,
  width: x2 - x1,
  height: y2 - y1,
});
const size = (width: number, height: number) => ({ width, height });
const viewAt = (x: number, y: number, w = 1280, h = 720, world = WORLD) =>
  followView({ x, y }, size(w, h), world);
/** ¿Se dibuja la caja con el jugador en (x, y), vista w × h y margen m? */
const drawn = (b: Box, m: number, x = 1920, y = 1080, w = 1280, h = 720): boolean =>
  touches(b, clipRect(viewAt(x, y, w, h), m));

const M = 60;
const A = box(1500, 900, 1560, 960);
const H = box(2700, 800, 2760, 860);

describe('mapCulling · regla de recorte (0018)', () => {
  it('margen del juego: 1 celda de map.cellSize', () => {
    expect(CULL_MARGIN_CELLS).toBe(1);
    expect(cullMargin(60)).toBe(60);
  });

  it('clipRect amplía la vista M px por lado, sin recortar al mundo', () => {
    expect(clipRect(viewAt(16, 16), M)).toEqual(box(-60, -60, 1340, 780));
  });

  it('Scenario: Objeto dentro, fuera y en parte (A y C sí, B no)', () => {
    const B = box(100, 100, 160, 160);
    const C = box(0, 1000, 3840, 1060);

    expect([drawn(A, M), drawn(B, M), drawn(C, M)]).toEqual([true, false, true]);
  });

  it.each([
    ['derecho', 0, box(2560, 800, 2620, 860), box(2561, 800, 2621, 860)],
    ['derecho', 60, box(2620, 800, 2680, 860), box(2621, 800, 2681, 860)],
    ['izquierdo', 0, box(1220, 800, 1280, 860), box(1219, 800, 1279, 860)],
    ['izquierdo', 60, box(1160, 800, 1220, 860), box(1159, 800, 1219, 860)],
    ['superior', 0, box(1500, 660, 1560, 720), box(1500, 659, 1560, 719)],
    ['superior', 60, box(1500, 600, 1560, 660), box(1500, 599, 1560, 659)],
    ['inferior', 0, box(1500, 1440, 1560, 1500), box(1500, 1441, 1560, 1501)],
    ['inferior', 60, box(1500, 1500, 1560, 1560), box(1500, 1501, 1560, 1561)],
  ])('Scenario: Caja que toca el borde (%s, M = %s): la que toca sí, la de 1 px fuera no', (_, m, on, off) => {
    expect([drawn(on, m), drawn(off, m)]).toEqual([true, false]);
  });

  it('Scenario: Vista que crece con la ventana (H no a 1.280 × 720, sí a 2.560 × 1.440)', () => {
    expect(drawn(H, M)).toBe(false);
    expect(drawn(H, M, 1920, 1080, 2560, 1440)).toBe(true);
  });

  it('Scenario: Vista que crece con la ventana (a 960 × 540, H no y A sí)', () => {
    expect([drawn(H, M, 1920, 1080, 960, 540), drawn(A, M, 1920, 1080, 960, 540)]).toEqual([
      false,
      true,
    ]);
  });

  it('Scenario: Vista recortada al mundo en una esquina ((16, 16): I sí, J no)', () => {
    const I = box(1300, 100, 1360, 160);
    const J = box(1341, 100, 1400, 160);

    expect([drawn(I, M, 16, 16), drawn(J, M, 16, 16)]).toEqual([true, false]);
  });

  it('Scenario: Vista recortada al mundo en una esquina ((3.824, 2.144): toca la esquina)', () => {
    const corner = box(2440, 1320, 2500, 1380);
    const outside = box(2439, 1319, 2499, 1379);

    expect([drawn(corner, M, 3824, 2144), drawn(outside, M, 3824, 2144)]).toEqual([true, false]);
  });

  it('Scenario: Vista que cubre el mundo entero (mundo y vista de 2.560 × 1.440)', () => {
    const world = size(2560, 1440);
    const rect = clipRect(viewAt(16, 16, 2560, 1440, world), M);
    const plan = [
      box(0, 0, 60, 60),
      box(2500, 0, 2560, 60),
      box(0, 1380, 60, 1440),
      box(2500, 1380, 2560, 1440),
      box(1200, 600, 1260, 660),
      box(570, -50, 690, 60),
      box(0, 700, 2560, 760),
    ];

    expect(plan.map((b) => touches(b, rect))).toEqual(plan.map(() => true));
  });
});
