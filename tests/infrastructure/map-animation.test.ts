import { describe, expect, it } from 'vitest';
import { phasedFrameAt } from '../../src/infrastructure/phaser/art/animation';
import { MapAnimator } from '../../src/infrastructure/phaser/map/mapAnimation';
import type { MapArtPlan, PlannedAnimation } from '../../src/infrastructure/phaser/map/planMapArt';
import { aDefaultConfig } from '../support/builders';
import { planFor } from '../support/mapArt';
import { startSeededRun } from '../support/runs';

// Spec sprite-rendering (0029), "Animación del arte del mapa" y "El recorte no cambia lo que se ve":
// el animador (puro) pone el frame solo a lo dibujado y ceba lo que reaparece.
const FRAME_MS = 16.667;
const TREE: Omit<PlannedAnimation, 'indices' | 'phase'> = { frames: [0, 1, 2, 3, 4, 5], fps: 6 };
const TOWER: Omit<PlannedAnimation, 'indices' | 'phase'> = { frames: [0, 1, 2, 3], fps: 5 };

/** Plan mínimo: `n` objetos y los grupos dados (el animador solo lee longitudes y grupos). */
const planOf = (n: number, animations: PlannedAnimation[]): MapArtPlan =>
  ({ low: Array.from({ length: n }), high: [], animations }) as unknown as MapArtPlan;

/** Recorte y lienzo dobles: visibilidad por índice y frames recibidos. */
function doubles(n: number) {
  const visible = new Array<boolean>(n).fill(true);
  const sheet = new Array<number>(n).fill(-1);
  const calls: [number, number][] = [];
  return {
    visible,
    sheet,
    calls,
    drawn: { isVisible: (i: number) => visible[i] === true },
    canvas: {
      frame: (i: number, f: number) => {
        calls.push([i, f]);
        sheet[i] = f;
      },
    },
  };
}

describe('MapAnimator', () => {
  it('Scenario: Frame de un árbol según su fase (tronco y copa, mismo frame; R 0, 700 y 1.000)', () => {
    const anim = new MapAnimator();
    anim.reset(planOf(4, [{ ...TREE, phase: 2, indices: [0, 3] }]));
    const d = doubles(4);
    const seen = [0, 700, 1000].map((ms) => {
      anim.tick(ms, d.drawn, d.canvas);
      return [d.sheet[0], d.sheet[3]];
    });
    expect(seen).toEqual([
      [2, 2],
      [0, 0],
      [2, 2],
    ]);
    expect([d.sheet[1], d.sheet[2]]).toEqual([-1, -1]);
  });

  it('Scenario: Torre intacta animada (60 frames: el de ψ y el reloj, pasa por los 4 de su idle)', () => {
    const anim = new MapAnimator();
    anim.reset(planOf(2, [{ ...TOWER, phase: 3, indices: [0, 1] }]));
    const d = doubles(2);
    const seen = new Set<number>();
    for (let f = 0; f < 60; f++) {
      const ms = f * FRAME_MS;
      anim.tick(ms, d.drawn, d.canvas);
      expect(d.sheet[0]).toBe(phasedFrameAt(TOWER, ms, 3));
      expect(d.sheet[1]).toBe(d.sheet[0]);
      seen.add(d.sheet[0] ?? -1);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it('solo pone el frame cuando cambia y solo a los objetos dibujados', () => {
    const anim = new MapAnimator();
    anim.reset(planOf(3, [{ ...TREE, phase: 0, indices: [0, 1, 2] }]));
    const d = doubles(3);
    d.visible[1] = false;
    anim.tick(0, d.drawn, d.canvas);
    anim.tick(10, d.drawn, d.canvas);
    expect(d.calls).toEqual([
      [0, 0],
      [2, 0],
    ]);
  });

  it('Scenario: Árbol y torre al reaparecer (oculto en f + 1, cebado en f + 37 con el frame vigente)', () => {
    const anim = new MapAnimator();
    anim.reset(
      planOf(4, [
        { ...TREE, phase: 4, indices: [0, 1] },
        { ...TOWER, phase: 1, indices: [2, 3] },
      ]),
    );
    const d = doubles(4);
    anim.tick(0, d.drawn, d.canvas);
    d.visible.fill(false);
    for (let f = 1; f < 37; f++) anim.tick(f * FRAME_MS, d.drawn, d.canvas);
    const stale = [...d.sheet];
    const ms = 37 * FRAME_MS;
    anim.tick(ms, d.drawn, d.canvas);
    for (const i of [0, 1, 2, 3]) {
      anim.prime(i, d.canvas);
      d.visible[i] = true;
    }
    expect(d.sheet).toEqual([
      phasedFrameAt(TREE, ms, 4),
      phasedFrameAt(TREE, ms, 4),
      phasedFrameAt(TOWER, ms, 1),
      phasedFrameAt(TOWER, ms, 1),
    ]);
    expect(d.sheet).not.toEqual(stale);
  });

  it('Scenario: Elementos estáticos (sin grupo: ni tick ni prime los tocan)', () => {
    const anim = new MapAnimator();
    anim.reset(planOf(3, [{ ...TREE, phase: 0, indices: [0] }]));
    const d = doubles(3);
    for (let f = 0; f < 600; f++) anim.tick(f * FRAME_MS, d.drawn, d.canvas);
    anim.prime(1, d.canvas);
    anim.prime(2, d.canvas);
    expect(d.calls.every(([i]) => i === 0)).toBe(true);
  });

  it('Scenario: Torre que cae en ruina (aspecto intacto deshabilitado: nunca recibe frame; la ruina, estática)', () => {
    // Con el plan real: la ruina de la torre no está en ningún grupo y el intacto, oculto, no recibe.
    const plan = planFor(startSeededRun(aDefaultConfig(), 42).map, 42);
    const tower = plan.structures.find((s) => s.type === 'goblin-tower');
    if (!tower) throw new Error('sin torre en la 42');
    const anim = new MapAnimator();
    anim.reset(plan);
    const n = plan.low.length + plan.high.length;
    const d = doubles(n);
    for (const i of tower.intact) d.visible[i] = false;
    for (let f = 0; f < 61; f++) anim.tick(f * FRAME_MS, d.drawn, d.canvas);
    const touched = new Set(d.calls.map(([i]) => i));
    expect([...tower.intact, ...tower.ruin].filter((i) => touched.has(i))).toEqual([]);
  });

  it('reset con un plan sin grupos: tick no llama nunca a frame', () => {
    const anim = new MapAnimator();
    anim.reset(planOf(5, []));
    const d = doubles(5);
    anim.tick(1234, d.drawn, d.canvas);
    anim.prime(0, d.canvas);
    expect(d.calls).toEqual([]);
  });
});
