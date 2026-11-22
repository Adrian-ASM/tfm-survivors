import { describe, expect, it } from 'vitest';
import type { GemSnapshot } from '../../src/domain/run/RunSnapshot';
import { GemLayer } from '../../src/infrastructure/phaser/GemLayer';
import { GEM_FILE } from '../support/appearance';
import { fakeKit } from '../support/FakeSprite';
import { someLooks } from '../support/looks';

// Specs xp-gems (pintado de gemas) y sprite-rendering ("Flechas y gemas") (change 0012).
const gem = (id: number, x: number, y: number, radius = 5): GemSnapshot => ({ id, x, y, radius });
const gems = (from: number, n: number) =>
  Array.from({ length: n }, (_, i) => gem(from + i, 10 * i, 3 * i));

function layer(capacity: number) {
  const kit = fakeKit();
  const l = new GemLayer(capacity, kit, someLooks().gem);
  return { l, created: kit.created };
}

const visible = <T extends { visible: boolean }>(sprites: T[]): T[] =>
  sprites.filter((s) => s.visible);

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
      expect(s[0]?.texture).toBe(GEM_FILE);
    }
    expect(l.counts).toEqual({ visible: 9, placeholder: 0 });
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
    expect([visible(created).length, l.counts.visible]).toEqual([0, 0]);
  });

  it('Scenario: Flechas y gemas (tamaño por aspecto, no por gemRadius; frame fijo, sin rotar)', () => {
    const { l, created } = layer(2);
    l.sync([gem(1, 0, 0, 5), gem(2, 10, 0, 9)]);
    expect(created.map((s) => [s.scale, s.frame, s.rotation, s.flipX])).toEqual([
      [0.5, 0, 0, false],
      [0.5, 0, 0, false],
    ]);
  });
});
