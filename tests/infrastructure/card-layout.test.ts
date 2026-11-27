import { describe, expect, it } from 'vitest';
import upgradesJson from '../../content/upgrades.json';
import type { OfferSnapshot } from '../../src/domain/run/RunSnapshot';
import {
  CARD_FONT_SIZE,
  CARD_HEIGHT,
  CARD_ICON_SIZE,
  CARD_LINE_HEIGHT,
  CARD_TEXT_PADDING,
  CARD_WIDTH,
  cardContentLayout,
  cardLayout,
  wrapLines,
  type CardMargins,
  type CardRect,
} from '../../src/infrastructure/phaser/cardLayout';
import { mobileFrameRule } from '../../src/infrastructure/phaser/ui/mobileFrame';
import { uiMargins } from '../../src/infrastructure/phaser/ui/nineSlice';
import { screenFrame, type ScreenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
import { MONO_CHAR_RATIO, veilLayout } from '../../src/infrastructure/phaser/ui/uiLayout';
import {
  PLAIN_CARD_MARGINS,
  cardLevel,
  cardName,
} from '../../src/infrastructure/phaser/UpgradeOverlay';
import { DEFAULT_MOBILE } from '../support/builders';
import { repoUi } from '../support/phaserUi';
import { HUD_METRICS } from '../support/hud';

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

  it('con el hueco del icono la carta mide 240 × 240 a ×1 (0034, design D4)', () => {
    const [card] = cardLayout(screenFrame(1280, 720), 1);
    expect([card?.width, card?.height]).toEqual([CARD_WIDTH, 240]);
    expect(CARD_HEIGHT).toBe(240);
    expect(CARD_ICON_SIZE).toBe(64);
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

// Spec upgrades (0034), "Icono en la carta de mejora" (design D4): hueco del icono arriba y centrado,
// con los textos reales de las 9 mejoras de personaje.
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const MOBILE_BASE = { width: DEFAULT_MOBILE.minWidth, height: DEFAULT_MOBILE.baseHeight };
/** Frame móvil de 844 × 390 CSS (EXPAND de Phaser 4.2.1 con la base del contenido). */
function mobileFrame(pw: number, ph: number): ScreenFrame {
  const sx = pw / MOBILE_BASE.width;
  const sy = ph / MOBILE_BASE.height;
  const logical =
    sx < sy
      ? { width: MOBILE_BASE.width, height: ph / sx }
      : { width: pw / sy, height: MOBILE_BASE.height };
  return mobileFrameRule(DEFAULT_MOBILE.minTextPx, HUD_METRICS)(logical, { width: pw, height: ph });
}

const BUTTON: CardMargins = uiMargins(repoUi().pieces.button);
const FRAMES: [string, ScreenFrame][] = [
  ['k 1 (1.280 × 720)', screenFrame(1280, 720)],
  ['k 1 (960 × 540)', screenFrame(960, 540)],
  ['k 2 (2.560 × 1.440)', screenFrame(2560, 1440)],
  ['k 1,4066 (móvil 844 × 390)', mobileFrame(844, 390)],
];
const options: OfferSnapshot[] = upgradesJson.character.map((u) => ({
  id: u.id,
  name: u.name,
  description: u.description,
  level: u.maxLevel - 1,
  nextLevel: u.maxLevel,
}));

/** Cajas de icono, nombre, descripción y nivel de la carta `i` con la opción `o`. */
function boxesOf(rect: CardRect, m: CardMargins, k: number, i: number, o: OfferSnapshot) {
  const line = CARD_FONT_SIZE * k * CARD_LINE_HEIGHT;
  const probe = cardContentLayout(rect, m, k, 1);
  const chars = probe.wrapWidth / (CARD_FONT_SIZE * k * MONO_CHAR_RATIO);
  const nameLines = wrapLines(cardName(i, o), chars);
  const c = cardContentLayout(rect, m, k, nameLines);
  const left = c.x - c.wrapWidth / 2;
  const levelLines = wrapLines(cardLevel(o), chars);
  return {
    layout: c,
    icon: { x: c.icon.x - c.icon.size / 2, y: c.icon.top, w: c.icon.size, h: c.icon.size },
    name: { x: left, y: c.nameTop, w: c.wrapWidth, h: nameLines * line },
    description: {
      x: left,
      y: c.descriptionTop,
      w: c.wrapWidth,
      h: wrapLines(o.description, chars) * line,
    },
    level: { x: left, y: c.levelBottom - levelLines * line, w: c.wrapWidth, h: levelLines * line },
  };
}

describe('cardContentLayout (0034)', () => {
  it('el frame móvil de 844 × 390 tiene k ≈ 1,4066', () => {
    expect(mobileFrame(844, 390).uiScale).toBeCloseTo(1.4066, 3);
  });

  it.each(FRAMES)(
    'Scenario: Descripción más larga con icono (las 9 mejoras de personaje, %s)',
    (_label, frame) => {
      const k = frame.uiScale;
      const rects = cardLayout(frame, 3);
      for (const m of [BUTTON, PLAIN_CARD_MARGINS]) {
        options.forEach((o, n) => {
          const i = n % 3;
          const rect = rects[i] as CardRect;
          const b = boxesOf(rect, m, k, i, o);
          const area = {
            left: rect.x - rect.width / 2 + Math.max(CARD_TEXT_PADDING, m.left) * k,
            right: rect.x + rect.width / 2 - Math.max(CARD_TEXT_PADDING, m.right) * k,
            top: rect.y - rect.height / 2 + m.top * k,
            bottom: rect.y + rect.height / 2 - m.bottom * k,
          };
          const all = [b.icon, b.name, b.description, b.level];
          for (const box of all) {
            expect(box.x, o.id).toBeGreaterThanOrEqual(area.left - 1e-9);
            expect(box.x + box.w, o.id).toBeLessThanOrEqual(area.right + 1e-9);
            expect(box.y, o.id).toBeGreaterThanOrEqual(area.top - 1e-9);
            expect(box.y + box.h, o.id).toBeLessThanOrEqual(area.bottom + 1e-9);
          }
          for (let p = 0; p < all.length; p++) {
            for (let q = p + 1; q < all.length; q++) {
              expect(
                overlaps(all[p] as Box, all[q] as Box),
                `${o.id} ${String(p)}/${String(q)}`,
              ).toBe(false);
            }
          }
        });
      }
      expect(rects.every((r) => r.x - r.width / 2 >= 0 && r.x + r.width / 2 <= frame.width)).toBe(
        true,
      );
    },
  );

  it('Scenario: Hueco escalado con k entero y fraccionario', () => {
    const slot = (frame: ScreenFrame) => {
      const [rect] = cardLayout(frame, 1);
      const r = rect as CardRect;
      const c = cardContentLayout(r, BUTTON, frame.uiScale, 1);
      const left = r.x - r.width / 2;
      const top = r.y - r.height / 2;
      return { dx: c.icon.x - c.icon.size / 2 - left, dy: c.icon.top - top, size: c.icon.size };
    };
    const one = slot(screenFrame(1280, 720));
    expect(one).toEqual({ dx: (CARD_WIDTH - CARD_ICON_SIZE) / 2, dy: 20, size: 64 });
    for (const frame of [screenFrame(2560, 1440), mobileFrame(844, 390)]) {
      const k = frame.uiScale;
      const s = slot(frame);
      expect(Math.abs(s.dx - one.dx * k)).toBeLessThanOrEqual(1);
      expect(Math.abs(s.dy - one.dy * k)).toBeLessThanOrEqual(1);
      expect(Math.abs(s.size - one.size * k)).toBeLessThanOrEqual(1);
    }
    // Con k 1,4066 las 3 cartas siguen enteras, sin solaparse y ≥ 44 × 44 px CSS.
    const f = mobileFrame(844, 390);
    const css = 390 / f.height;
    const cards = cardLayout(f, 3);
    const boxes = cards.map((c) => ({
      x: c.x - c.width / 2,
      y: c.y - c.height / 2,
      w: c.width,
      h: c.height,
    }));
    expect(
      boxes.every((b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= f.width && b.y + b.h <= f.height),
    ).toBe(true);
    expect(overlaps(boxes[0] as Box, boxes[1] as Box)).toBe(false);
    expect(overlaps(boxes[1] as Box, boxes[2] as Box)).toBe(false);
    expect(cards.every((c) => c.width * css >= 44 && c.height * css >= 44)).toBe(true);
  });

  it('el nombre empieza (64 + 6)·k bajo el borde superior del área útil', () => {
    const [rect] = cardLayout(screenFrame(1280, 720), 1);
    const r = rect as CardRect;
    const c = cardContentLayout(r, BUTTON, 1, 2);
    expect(c.nameTop - (r.y - r.height / 2)).toBe(20 + 70);
    expect(c.descriptionTop - c.nameTop).toBeCloseTo(2 * 17.5 + 6, 9);
    expect(r.y + r.height / 2 - c.levelBottom).toBe(28);
  });
});
