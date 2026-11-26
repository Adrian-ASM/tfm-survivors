import { describe, expect, it } from 'vitest';
import type { PickupSnapshot, RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { TICK_MS } from '../../src/infrastructure/phaser/advanceFrame';
import { floatOffset } from '../../src/infrastructure/phaser/art/pickupMotion';
import type { RingSprite } from '../../src/infrastructure/phaser/PulseLayer';
import { RenderLayers } from '../../src/infrastructure/phaser/RenderLayers';
import {
  FLOAT_TEST,
  GOLD_FILE,
  GOLD_SPAWN_FILE,
  WOOD_FILE,
  withPickupMotion,
} from '../support/appearance';
import { aDefaultConfig } from '../support/builders';
import {
  FAKE_HAZARD_CAPACITY,
  FakeGraphics,
  fakeKit,
  type FakeSprite,
} from '../support/FakeSprite';
import { someLooks } from '../support/looks';
import { startRun } from '../support/runs';

// Spec sprite-rendering (0030): el flote y la aparición de los recogibles usan el reloj de render de
// `RenderLayers` (el de la espuma y los árboles), que se congela en pausa, con una oferta, en la
// tienda, en la obra y con la partida terminada, y que en modo manual avanza ticks × TICK_MS.
const FRAME_MS = 16.667;

class FakeRing implements RingSprite {
  setPosition(): this {
    return this;
  }
  setRadius(): this {
    return this;
  }
  setAlpha(): this {
    return this;
  }
  setVisible(): this {
    return this;
  }
}

const BASE = startRun(aDefaultConfig()).snapshot();
const pick = (id: number, kind: PickupSnapshot['kind'], x: number, y: number): PickupSnapshot => ({
  id,
  kind,
  value: 1,
  x,
  y,
  radius: 5,
  ...(kind === 'stone' ? { source: 'goblin-tnt' } : {}),
});
const snap = (pickups: PickupSnapshot[], over: Partial<RunSnapshot> = {}): RunSnapshot =>
  ({ ...BASE, pickups, ...over }) as RunSnapshot;

function setup() {
  const kit = fakeKit();
  const layers = new RenderLayers(
    {
      kit,
      warnings: () => new FakeGraphics(),
      ring: () => new FakeRing(),
      looks: someLooks((r) => {
        withPickupMotion(r);
      }),
      capacity: {
        enemies: 8,
        projectiles: 8,
        pulses: 4,
        pickups: 16,
        corpses: 8,
        visualTicks: new Map([['tests', 8]]),
        hazards: FAKE_HAZARD_CAPACITY,
      },
    },
    { visible: 1, placeholder: 0 },
  );
  const frame = (s: RunSnapshot, paused = false, ms = FRAME_MS): void => {
    layers.advance(ms, paused);
    layers.render(s);
  };
  const sprite = (x: number): FakeSprite | undefined =>
    kit.created.find((s) => s.visible && Math.abs(s.x - x) <= 0.001);
  return { layers, frame, sprite };
}

/** Estados con el mundo detenido: [nombre, cambios del snapshot, pausa]. */
const STOPPED: [string, Partial<RunSnapshot>, boolean][] = [
  ['pausa', {}, true],
  ['oferta', { status: 'choosing' }, false],
  ['tienda', { status: 'shopping' }, false],
  ['obra', { status: 'building' }, false],
  ['terminada', { status: 'over', outcome: 'lost' }, false],
];

describe('Reloj de render de los recogibles (sprite-rendering 0030)', () => {
  it('Scenario: Flote congelado en pausa, oferta, tienda, obra y fin (60 frames con la misma y)', () => {
    const items = [pick(0, 'xp', 100, 100), pick(1, 'stone', 200, 100), pick(2, 'wood', 300, 100)];
    for (const [name, over, paused] of STOPPED) {
      const { layers, frame, sprite } = setup();
      for (let f = 0; f < 90; f++) frame(snap(items));
      expect(sprite(300)?.texture, name).toBe(WOOD_FILE);
      frame(snap(items, over), paused);
      const r0 = layers.renderMs;
      const ys = () => [100, 200, 300].map((x) => sprite(x)?.y);
      const first = ys();
      for (let f = 0; f < 59; f++) {
        frame(snap(items, over), paused);
        expect(ys(), name).toEqual(first);
      }
      expect(layers.renderMs, name).toBe(r0);
      expect(first[0], name).toBeCloseTo(100 + floatOffset(FLOAT_TEST, 0, r0), 3);
      expect(first[1], name).toBeCloseTo(100 + floatOffset(FLOAT_TEST, 1, r0), 3);
    }
    // Al reanudar la pausa: 1 frame de 16,667 ms y d(id, R0 + 16,667).
    const { layers, frame, sprite } = setup();
    for (let f = 0; f < 90; f++) frame(snap(items));
    const r0 = layers.renderMs;
    for (let f = 0; f < 60; f++) frame(snap(items), true);
    frame(snap(items));
    expect(Math.abs(layers.renderMs - (r0 + FRAME_MS))).toBeLessThanOrEqual(0.001);
    expect(sprite(100)?.y).toBeCloseTo(100 + floatOffset(FLOAT_TEST, 0, r0 + FRAME_MS), 3);
    expect(sprite(200)?.y).toBeCloseTo(100 + floatOffset(FLOAT_TEST, 1, r0 + FRAME_MS), 3);
  });

  it('Scenario: Aparición congelada en pausa, oferta, tienda, obra y fin (frame 2; al reanudar, el 3 sin saltos)', () => {
    const gold = [pick(5, 'gold', 300, 200)];
    for (const [name, over, paused] of STOPPED) {
      const { frame, sprite } = setup();
      frame(snap([]));
      frame(snap(gold));
      // 15 frames de 16,667 ms: R = R_a + 250.
      for (let f = 0; f < 14; f++) frame(snap(gold));
      expect(sprite(300)?.frame, name).toBe(2);
      // La pausa congela desde su primer frame; los estados del snapshot, desde el segundo.
      if (!paused) frame(snap(gold, over), false, 0);
      for (let f = 0; f < 60; f++) {
        frame(snap(gold, over), paused);
        expect([sprite(300)?.texture, sprite(300)?.frame], name).toEqual([GOLD_SPAWN_FILE, 2]);
      }
    }
    const { frame, sprite, layers } = setup();
    frame(snap([]));
    frame(snap(gold));
    const ra = layers.renderMs;
    for (let f = 0; f < 14; f++) frame(snap(gold));
    for (let f = 0; f < 60; f++) frame(snap(gold), true);
    const seen: (number | string)[] = [];
    while (layers.renderMs - ra < 700) {
      frame(snap(gold));
      const s = sprite(300);
      seen.push(s?.texture === GOLD_SPAWN_FILE ? s.frame : 'idle');
      if (layers.renderMs - ra < 300) expect(s?.frame).toBe(2);
    }
    const distinct = seen.filter((f, i) => f !== seen[i - 1]);
    expect(distinct).toEqual([2, 3, 4, 5, 6, 'idle']);
  });

  it('Scenario: Flote en modo manual (step(24): reloj 400 y d = 4; sin step, la y no cambia)', () => {
    const { layers, frame, sprite } = setup();
    const gem = [pick(0, 'xp', 300, 200)];
    frame(snap(gem), false, 0);
    expect(sprite(300)?.y).toBeCloseTo(200, 3);

    frame(snap(gem), false, 24 * TICK_MS);

    expect(Math.abs(layers.renderMs - 400)).toBeLessThanOrEqual(0.001);
    expect(sprite(300)?.y).toBeCloseTo(204, 3);
    // Sin `step`, GameScene no avanza el reloj en modo manual: 60 renders sin `advance`.
    for (let f = 0; f < 60; f++) layers.render(snap(gem));
    expect(sprite(300)?.y).toBeCloseTo(204, 3);
  });

  it('Scenario: Aparición en modo manual (step(9): frame 1 en R_a + 150; step(42): idle en R_a + 850)', () => {
    const { layers, frame, sprite } = setup();
    frame(snap([]), false, 0);
    const gold = [pick(5, 'gold', 300, 200)];
    frame(snap(gold), false, 3 * TICK_MS);
    const ra = layers.renderMs;
    expect(sprite(300)?.frame).toBe(0);

    frame(snap(gold), false, 9 * TICK_MS);
    expect(Math.abs(layers.renderMs - (ra + 150))).toBeLessThanOrEqual(0.001);
    expect([sprite(300)?.texture, sprite(300)?.frame]).toEqual([GOLD_SPAWN_FILE, 1]);

    frame(snap(gold), false, 42 * TICK_MS);
    expect(Math.abs(layers.renderMs - (ra + 850))).toBeLessThanOrEqual(0.001);
    expect(sprite(300)?.texture).toBe(GOLD_FILE);
  });
});
