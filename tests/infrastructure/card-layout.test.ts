import { describe, expect, it } from 'vitest';
import { cardLayout, type CardRect } from '../../src/infrastructure/phaser/cardLayout';
import { screenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
import { veilLayout } from '../../src/infrastructure/phaser/ui/uiLayout';

// Spec upgrades (0017): cartas centradas en la ventana y enteras (design D5).
const left = (c: CardRect) => c.x - c.width / 2;
const right = (c: CardRect) => c.x + c.width / 2;
const top = (c: CardRect) => c.y - c.height / 2;
const bottom = (c: CardRect) => c.y + c.height / 2;
/** Centro del rectángulo que engloba las cartas. */
const center = (cards: CardRect[]) => [
  (Math.min(...cards.map(left)) + Math.max(...cards.map(right))) / 2,
  (Math.min(...cards.map(top)) + Math.max(...cards.map(bottom))) / 2,
];
const inside = (cards: CardRect[], w: number, h: number) =>
  cards.every((c) => left(c) >= 0 && top(c) >= 0 && right(c) <= w && bottom(c) <= h);
const apart = (cards: CardRect[]) =>
  cards.every((c, i) => i === 0 || left(c) >= right(cards[i - 1] ?? c));

describe('cardLayout (0017)', () => {
  it('Scenario: Tres cartas centradas (1.280 × 720: centro (640, 360), la 1 lo contiene)', () => {
    const cards = cardLayout(screenFrame(1280, 720), 3);
    const middle = cards[1];

    expect(center(cards)).toEqual([640, 360]);
    expect(middle && left(middle) <= 640 && right(middle) >= 640).toBe(true);
    expect(middle && top(middle) <= 360 && bottom(middle) >= 360).toBe(true);
  });

  it.each([2, 1])('Scenario: Dos cartas y una carta (%i en 960 × 540: centro (480, 270))', (n) => {
    const cards = cardLayout(screenFrame(960, 540), n);

    expect(cards).toHaveLength(n);
    expect(center(cards)).toEqual([480, 270]);
  });

  it.each([
    [960, 540],
    [2560, 1440],
  ])('Scenario: Ventana mínima con cartas enteras (%i × %i, sin solapes)', (w, h) => {
    const cards = cardLayout(screenFrame(w, h), 3);

    expect(inside(cards, w, h)).toBe(true);
    expect(apart(cards)).toBe(true);
  });

  it('con ×2 (lienzo 2.560 × 1.440 de una ventana 3.840 × 2.160) las cartas miden el doble', () => {
    const one = cardLayout(screenFrame(960, 540), 3);
    const two = cardLayout(screenFrame(2560, 1440), 3);

    expect(two.map((c) => [c.width, c.height])).toEqual(
      one.map((c) => [2 * c.width, 2 * c.height]),
    );
  });

  it('Scenario: Ventana menor que 960 × 540 (640 × 360: centradas en (320, 180))', () => {
    expect(center(cardLayout(screenFrame(640, 360), 3))).toEqual([320, 180]);
  });

  it('velo: width × height centrado', () => {
    expect(veilLayout(screenFrame(1000, 600))).toEqual({
      x: 500,
      y: 300,
      width: 1000,
      height: 600,
    });
  });
});
