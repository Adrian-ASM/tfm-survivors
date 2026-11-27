import { describe, expect, it } from 'vitest';
import { cardLayout } from '../../src/infrastructure/phaser/cardLayout';
import {
  displayScale,
  fitsAt,
  maxUiScale,
  mobileFrameRule,
  mobileUiScale,
} from '../../src/infrastructure/phaser/ui/mobileFrame';
import { desktopFrameRule } from '../../src/infrastructure/phaser/ui/screenFrame';
import {
  HUD_BASE,
  HUD_RESERVE_TEXTS,
  hudBoxes,
  hudLayout,
  type Box,
} from '../../src/infrastructure/phaser/ui/uiLayout';
import { DEFAULT_MOBILE } from '../support/builders';
import { HUD_METRICS } from '../support/hud';

// Spec mobile-display y hud (0033), "Escala de la UI del lienzo en modo móvil" (design §3).
const BASE = { width: DEFAULT_MOBILE.minWidth, height: DEFAULT_MOBILE.baseHeight };

/**
 * Tamaño lógico de Phaser 4.2.1 en EXPAND (ScaleManager.updateScale) con la base del contenido;
 * aquí solo para preparar los casos (la única implementación de verdad es la del motor).
 */
function expand(pw: number, ph: number): { width: number; height: number } {
  const sx = pw / BASE.width;
  const sy = ph / BASE.height;
  return sx < sy ? { width: BASE.width, height: ph / sx } : { width: pw / sy, height: BASE.height };
}

/** Frame móvil de una ventana P_w × P_h con texto mínimo m. */
const frameAt = (pw: number, ph: number, m = DEFAULT_MOBILE.minTextPx) =>
  mobileFrameRule(m, HUD_METRICS)(expand(pw, ph), { width: pw, height: ph });

const inside = (b: Box, w: number, h: number): boolean =>
  b.x >= 0 && b.y >= 0 && b.x + b.width <= w && b.y + b.height <= h;
const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('mobileFrame (0033)', () => {
  it('displayScale: px CSS por unidad (390 / 640) y 0 con la ventana a cero', () => {
    expect(displayScale({ width: 1385.03, height: 640 }, { width: 844, height: 390 })).toBe(
      390 / 640,
    );
    expect(displayScale({ width: 0, height: 0 }, { width: 0, height: 0 })).toBe(0);
  });

  it('Scenario: Texto mínimo en un móvil horizontal (844 × 390: k 1,4066 y texto de 12 px CSS)', () => {
    const f = frameAt(844, 390);
    const s = displayScale(expand(844, 390), { width: 844, height: 390 });

    expect([f.width, f.height]).toEqual([1385, 640]);
    expect(f.uiScale).toBeCloseTo(1.4066, 3);
    expect(Math.abs(HUD_BASE.fontSize * f.uiScale * s - 12)).toBeLessThanOrEqual(0.1);
    const cards = cardLayout(f, 3);
    const boxes = cards.map((c) => ({
      x: c.x - c.width / 2,
      y: c.y - c.height / 2,
      width: c.width,
      height: c.height,
    }));
    expect(boxes.every((b) => inside(b, f.width, f.height))).toBe(true);
    expect(overlap(boxes[0] as Box, boxes[1] as Box)).toBe(false);
    expect(overlap(boxes[1] as Box, boxes[2] as Box)).toBe(false);
    expect(cards.every((c) => c.width * s >= 44 && c.height * s >= 44)).toBe(true);
  });

  it('Scenario: Pantalla grande con factor 1 (1.024 × 768: lienzo 960 × 720, k_min ≈ 0,80)', () => {
    const f = frameAt(1024, 768);

    expect([f.width, f.height, f.uiScale]).toEqual([960, 720, 1]);
    expect(fitsAt(960, 720, 1, HUD_METRICS)).toBe(true);
  });

  it('Scenario: Texto mínimo inalcanzable (texto 20: k < 2,344 y k + 0,01 ya no cabe)', () => {
    const f = frameAt(844, 390, 20);

    expect(f.uiScale).toBeLessThan(2.344);
    expect(f.uiScale).toBeGreaterThan(1);
    expect(fitsAt(f.width, f.height, f.uiScale, HUD_METRICS)).toBe(true);
    expect(fitsAt(f.width, f.height, f.uiScale + 0.01, HUD_METRICS)).toBe(false);
  });

  it.each([
    [844, 390],
    [915, 412],
    [1024, 768],
    [1366, 1024],
  ])('Scenario: HUD entero en móvil (%i × %i)', (pw, ph) => {
    const f = frameAt(pw, ph);
    const all = Object.values(hudBoxes(hudLayout(f, HUD_METRICS), HUD_RESERVE_TEXTS));

    expect(all.every((b) => inside(b, f.width, f.height))).toBe(true);
    const pairs = all.flatMap((a, i) => all.slice(i + 1).map((b) => overlap(a, b)));
    expect(pairs.some(Boolean)).toBe(false);
  });

  it('Scenario: Factor fraccionario en modo móvil (medidas 1,4066 × las de factor 1)', () => {
    const mobile = hudLayout(frameAt(844, 390), HUD_METRICS);
    const desktop = hudLayout(
      desktopFrameRule({ width: 1280, height: 720 }, { width: 0, height: 0 }),
      HUD_METRICS,
    );
    const k = mobile.uiScale;
    const s = 390 / 640;

    expect(desktop.uiScale).toBe(1);
    expect(k).toBeCloseTo(1.4066, 3);
    const pairs = [
      [mobile.barWidth, desktop.barWidth],
      [mobile.barHeight, desktop.barHeight],
      [mobile.fontSize, desktop.fontSize],
      [mobile.xp.bar.y, desktop.xp.bar.y],
    ];
    expect(pairs.every(([m, d]) => Math.abs((m ?? 0) - k * (d ?? 0)) <= 1)).toBe(true);
    expect(mobile.fontSize * s).toBeGreaterThanOrEqual(12 - 0.1);
  });

  it('Scenario: El mismo tamaño de ventana con y sin modo móvil (1.280 × 720: k 1 en ambos)', () => {
    const desktop = desktopFrameRule({ width: 1280, height: 720 }, { width: 1280, height: 720 });
    const game = expand(1280, 720);
    const mobile = mobileFrameRule(12, HUD_METRICS)(game, { width: 1280, height: 720 });
    const s = displayScale(game, { width: 1280, height: 720 });

    expect(game.width).toBeCloseTo(1137.78, 2);
    expect([desktop.uiScale, mobile.uiScale]).toEqual([1, 1]);
    expect(HUD_BASE.fontSize * desktop.uiScale).toBe(14);
    expect(HUD_BASE.fontSize * mobile.uiScale * s).toBeCloseTo(15.75, 1);
  });

  it('Scenario: Ventana a cero en móvil (k = 1, sin errores)', () => {
    const f = mobileFrameRule(12, HUD_METRICS)({ width: 0, height: 0 }, { width: 0, height: 0 });

    expect(f.uiScale).toBe(1);
    expect(mobileUiScale(1385, 640, 0, 12, HUD_METRICS)).toBe(1);
    expect(mobileUiScale(1385, 640, Number.NaN, 12, HUD_METRICS)).toBe(1);
  });

  it('maxUiScale: ≥ 1 con el lienzo mínimo y limitado por la fila de cartas a 844 × 390', () => {
    expect(maxUiScale(960, 540, HUD_METRICS)).toBeGreaterThanOrEqual(1);
    expect(maxUiScale(1385, 640, HUD_METRICS)).toBeCloseTo(1385 / 768, 2);
    expect(maxUiScale(1, 1, HUD_METRICS)).toBe(1);
  });
});

// Spec hud (0036), "Iconos del HUD en modo móvil": lado s·k con el k fraccionario, que siguen fijando
// las 3 cartas (k_max = 1.385 / 768 y 1,4066 a 844 × 390, como antes del change).
describe('Contadores con icono en modo móvil (0036)', () => {
  it('Scenario: Iconos del HUD en modo móvil (844 × 390, texto 12 px: s·k y HUD entero)', () => {
    const f = frameAt(844, 390);
    const s = displayScale(expand(844, 390), { width: 844, height: 390 });
    const l = hudLayout(f, HUD_METRICS);
    for (const c of [l.kills, l.gold, l.wood, l.stone]) {
      expect(Math.abs(c.icon.size - HUD_METRICS.iconSize * f.uiScale)).toBeLessThanOrEqual(1);
    }
    const all = Object.values(hudBoxes(l, HUD_RESERVE_TEXTS));
    expect(all).toHaveLength(9);
    expect(all.every((b) => inside(b, f.width, f.height))).toBe(true);
    const pairs = all.flatMap((a, i) => all.slice(i + 1).map((b) => overlap(a, b)));
    expect(pairs.some(Boolean)).toBe(false);
    expect(Math.abs(HUD_BASE.fontSize * f.uiScale * s - 12)).toBeLessThanOrEqual(0.1);
    expect(f.uiScale).toBeCloseTo(1.4066, 3);
    expect(maxUiScale(1385, 640, HUD_METRICS)).toBeCloseTo(1385 / 768, 2);
  });
});
