import { describe, expect, it } from 'vitest';
import { toMapSnapshot } from '../../src/domain/map/MapSnapshot';
import { followView } from '../../src/infrastructure/phaser/CameraRig';
import {
  clipRect,
  cullMargin,
  touches,
  CULL_MARGIN_CELLS,
  MapCuller,
} from '../../src/infrastructure/phaser/map/mapCulling';
import type { Box } from '../../src/infrastructure/phaser/map/planMapArt';
import { aDefaultConfig } from '../support/builders';
import { WORLD, drawnByRule, planFor, visibleByRule } from '../support/mapArt';
import { mapRules, mapWith } from '../support/mapLayouts';
import { mapForSeed } from '../support/mapStats';

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
  ])(
    'Scenario: Caja que toca el borde (%s, M = %s): la que toca sí, la de 1 px fuera no',
    (_, m, on, off) => {
      expect([drawn(on, m), drawn(off, m)]).toEqual([true, false]);
    },
  );

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

// "Recorte al cambiar de partida, de ventana y de modo" y "`drawn` igual al recorte" (design D3).
/** Lienzo doble del culler: visibilidad por índice y llamadas a `show`. */
function showLog(objects: number) {
  const visible = Array<boolean>(objects).fill(true);
  const calls: [number, boolean][] = [];
  const canvas = {
    show: (i: number, v: boolean) => {
      calls.push([i, v]);
      visible[i] = v;
    },
  };
  return { canvas, visible, calls };
}
const planOf = (seed: number) => planFor(toMapSnapshot(mapForSeed(aDefaultConfig(), seed)), seed);
const EMPTY = planFor(toMapSnapshot(mapWith(mapRules(), {})));

describe('MapCuller (0018, design D3)', () => {
  it('tras reset todo visible y drawn = objects', () => {
    const plan = planOf(42);
    const culler = new MapCuller();
    culler.reset(plan);

    expect(culler.drawn).toBe(plan.objects);
  });

  it.each([
    [1920, 1080],
    [16, 16],
  ])('Scenario: `drawn` igual al recorte (semilla 42, jugador en (%s, %s))', (x, y) => {
    const plan = planOf(42);
    const { canvas, visible } = showLog(plan.objects);
    const culler = new MapCuller();
    culler.reset(plan);
    const view = viewAt(x, y);

    culler.apply(view, canvas);

    expect(culler.drawn).toBe(drawnByRule(plan, view));
    expect(culler.drawn).toBeGreaterThan(0);
    expect(culler.drawn).toBeLessThan(plan.objects);
    expect(visible).toEqual(visibleByRule(plan, view));
  });

  it('misma vista dos veces: la segunda no llama a show', () => {
    const plan = planOf(42);
    const { canvas, calls } = showLog(plan.objects);
    const culler = new MapCuller();
    culler.reset(plan);
    culler.apply(viewAt(1920, 1080), canvas);
    const first = calls.length;

    culler.apply(viewAt(1920, 1080), canvas);

    expect(first).toBeGreaterThan(0);
    expect(calls).toHaveLength(first);
  });

  it('solo llama a show en los índices que cambian, con su visibilidad nueva', () => {
    const plan = planOf(42);
    const { canvas, calls } = showLog(plan.objects);
    const culler = new MapCuller();
    culler.reset(plan);
    const a = viewAt(1920, 1080);
    const b = viewAt(2400, 1300);
    culler.apply(a, canvas);
    calls.length = 0;

    culler.apply(b, canvas);

    const before = visibleByRule(plan, a);
    const after = visibleByRule(plan, b);
    const changed = after.flatMap((v, i) => (v === before[i] ? [] : [[i, v]]));
    expect(calls).toEqual(changed);
    expect(changed.length).toBeGreaterThan(0);
  });

  it('Scenario: Redimensionado (crece de 1.280 × 720 a 2.560 × 1.440 y encoge a 960 × 540)', () => {
    const plan = planOf(42);
    const { canvas, visible } = showLog(plan.objects);
    const culler = new MapCuller();
    culler.reset(plan);
    culler.apply(viewAt(1920, 1080), canvas);
    const normal = culler.drawn;

    const big = viewAt(1920, 1080, 2560, 1440);
    culler.apply(big, canvas);
    const grown = culler.drawn;
    expect(visible).toEqual(visibleByRule(plan, big));
    const small = viewAt(1920, 1080, 960, 540);
    culler.apply(small, canvas);

    expect(grown).toBe(drawnByRule(plan, big));
    expect(grown).toBeGreaterThan(normal);
    expect(culler.drawn).toBe(drawnByRule(plan, small));
    expect(culler.drawn).toBeLessThan(grown);
    expect(visible).toEqual(visibleByRule(plan, small));
  });

  it('Scenario: Mapa vacío (drawn 0 y ninguna llamada)', () => {
    const { canvas, calls } = showLog(0);
    const culler = new MapCuller();
    culler.reset(EMPTY);

    culler.apply(viewAt(1920, 1080), canvas);

    expect([culler.drawn, calls]).toEqual([0, []]);
  });

  it('Scenario: R tras acabar en una esquina (reset con la semilla 43 no hereda nada)', () => {
    const culler = new MapCuller();
    const old = planOf(42);
    culler.reset(old);
    culler.apply(viewAt(3824, 2144), showLog(old.objects).canvas);
    const next = planOf(43);
    // paintMapArt deja visible cada entrada del plan nuevo antes del primer recorte.
    const { canvas, visible, calls } = showLog(next.objects);

    culler.reset(next);
    expect(culler.drawn).toBe(next.objects);
    const view = viewAt(1950, 1170);
    culler.apply(view, canvas);

    expect(visible).toEqual(visibleByRule(next, view));
    expect(culler.drawn).toBe(drawnByRule(next, view));
    expect(calls.every(([, v]) => !v)).toBe(true);
  });
});
