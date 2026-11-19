import { describe, expect, it } from 'vitest';
import type { PulseSnapshot } from '../../src/domain/run/RunSnapshot';
import {
  PulseLayer,
  pulseAlpha,
  type RingSprite,
} from '../../src/infrastructure/phaser/PulseLayer';

class FakeRing implements RingSprite {
  x = 0;
  y = 0;
  radius = 0;
  alpha = 1;
  visible = true;

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  setRadius(radius: number): this {
    this.radius = radius;
    return this;
  }
  setAlpha(alpha: number): this {
    this.alpha = alpha;
    return this;
  }
  setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }
}

const VISUAL = new Map([['tests', 8]]);

function layer(capacity: number) {
  const created: FakeRing[] = [];
  const l = new PulseLayer(capacity, VISUAL, () => {
    const r = new FakeRing();
    created.push(r);
    return r;
  });
  return { l, created };
}

const pulse = (firedAt: number, x = 480, y = 270): PulseSnapshot => ({
  weapon: 'tests',
  firedAt,
  x,
  y,
  radius: 90,
});

describe('pulseAlpha', () => {
  it('1 − edad / visualTicks: 1 al disparar y decreciente hasta 1/8', () => {
    expect([0, 4, 7].map((age) => pulseAlpha(10 + age, 10, 8))).toEqual([1, 0.5, 0.125]);
  });
});

describe('PulseLayer', () => {
  it('preasigna pulseCapacity anillos ocultos', () => {
    const { created } = layer(1);
    expect(created).toHaveLength(1);
    expect(created[0]?.visible).toBe(false);
  });

  it('Scenario: Duración del pulso (pintado): un anillo por pulso, centro fijo y radio 90', () => {
    const { l, created } = layer(1);
    for (let tick = 40; tick <= 47; tick++) {
      l.sync([pulse(40)], tick);
      expect(
        created[0] && [created[0].visible, created[0].x, created[0].y, created[0].radius],
      ).toEqual([true, 480, 270, 90]);
    }
    expect(created[0]?.alpha).toBeCloseTo(0.125, 9);
    l.sync([], 48);
    expect(created[0]?.visible).toBe(false);
  });

  it('Scenario: Indicación visual (un anillo por cada pulso del snapshot, sin crear más)', () => {
    const { l, created } = layer(3);
    l.sync([pulse(5, 100, 100), pulse(6, 200, 200)], 6);
    expect(created.map((r) => r.visible)).toEqual([true, true, false]);
    l.sync([pulse(6, 200, 200)], 7);
    expect(created.map((r) => [r.visible, r.x])).toEqual([
      [true, 200],
      [false, 200],
      [false, 0],
    ]);
    expect(created).toHaveLength(3);
  });
});
