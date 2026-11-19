import { describe, expect, it } from 'vitest';
import type { GemSnapshot } from '../../src/domain/run/RunSnapshot';
import type { CircleSprite } from '../../src/infrastructure/phaser/EnemyLayer';
import { GEM_COLOR, GemLayer } from '../../src/infrastructure/phaser/GemLayer';

class FakeCircle implements CircleSprite {
  x = 0;
  y = 0;
  radius = 0;
  color = 0;
  visible = true;
  resizes = 0;

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  setRadius(radius: number): this {
    this.radius = radius;
    this.resizes += 1;
    return this;
  }
  setFillStyle(color: number): this {
    this.color = color;
    return this;
  }
  setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }
}

function layer(capacity: number) {
  const created: FakeCircle[] = [];
  const l = new GemLayer(capacity, () => {
    const c = new FakeCircle();
    created.push(c);
    return c;
  });
  return { l, created };
}

const gem = (id: number, x: number, y: number): GemSnapshot => ({ id, x, y, radius: 5 });
const gems = (from: number, n: number) =>
  Array.from({ length: n }, (_, i) => gem(from + i, i * 3, 7));
const visible = (created: FakeCircle[]) => created.filter((c) => c.visible);

describe('GemLayer', () => {
  it('Scenario: Recogidas y nuevas (10 pintadas; 3 recogidas y 2 nuevas: 9 visibles)', () => {
    const { l, created } = layer(300);
    const first = gems(0, 10);
    l.sync(first);
    const next = [
      ...first.filter((g) => ![1, 4, 7].includes(g.id)),
      gem(10, 500, 1),
      gem(11, 600, 2),
    ];
    l.sync(next);
    const shown = visible(created);
    expect(shown).toHaveLength(9);
    for (const g of next) {
      const s = shown.filter((c) => Math.abs(c.x - g.x) <= 0.001 && Math.abs(c.y - g.y) <= 0.001);
      expect(s, 'gema ' + String(g.id)).toHaveLength(1);
      expect(s[0]?.radius).toBe(5);
    }
  });

  it('Scenario: Tope de gemas pintado (300 gemas: 300 visibles, sin crear más)', () => {
    const { l, created } = layer(300);
    l.sync(gems(0, 300));
    expect(visible(created)).toHaveLength(300);
    expect(created).toHaveLength(300);
  });

  it('Scenario: Todas recogidas (300 pintadas y después ninguna)', () => {
    const { l, created } = layer(300);
    l.sync(gems(0, 300));
    l.sync([]);
    expect(visible(created)).toHaveLength(0);
  });

  it('un color fijo y el radio solo al ocupar un hueco', () => {
    const { l, created } = layer(1);
    l.sync([gem(1, 0, 0)]);
    l.sync([gem(1, 6, 0)]);
    expect([created[0]?.color, created[0]?.radius, created[0]?.resizes]).toEqual([GEM_COLOR, 5, 1]);
  });
});
