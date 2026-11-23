import { describe, expect, it } from 'vitest';
import { formatClock, healthLabel, killsLabel } from '../../src/infrastructure/phaser/hudFormat';
import { screenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
import { hudBoxes, hudLayout, type Box } from '../../src/infrastructure/phaser/ui/uiLayout';
import { levelLabel } from '../../src/infrastructure/phaser/XpBar';

// Spec hud (0017): "HUD anclado a la ventana" y "Escala del HUD por escalones" (design D5).
const frame = screenFrame;
/** Textos más largos del escenario "HUD entero y sin solapes". */
const LONGEST = {
  health: healthLabel(120, 120),
  clock: formatClock(600),
  level: levelLabel(99),
  kills: killsLabel(12345),
};

const inside = (b: Box, w: number, h: number): boolean =>
  b.x >= 0 && b.y >= 0 && b.x + b.width <= w && b.y + b.height <= h;
const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('hudLayout (0017)', () => {
  it('anclajes: vida y XP a la izquierda, reloj en width / 2 y bajas en width − margen', () => {
    const l = hudLayout(frame(960, 540));

    expect([l.health.bar.x, l.xp.bar.x]).toEqual([l.margin, l.margin]);
    expect([l.clock.x, l.clock.originX]).toEqual([480, 0.5]);
    expect([l.kills.x, l.kills.originX]).toEqual([960 - l.margin, 1]);
  });

  it('Scenario: Mismo anclaje con dos ventanas (960 × 540 y 1.280 × 720, mismo factor)', () => {
    const a = hudLayout(frame(960, 540));
    const b = hudLayout(frame(1280, 720));

    expect(b.health).toEqual(a.health);
    expect(b.xp).toEqual(a.xp);
    expect([b.clock.y, 1280 / 2 - b.clock.x]).toEqual([a.clock.y, 960 / 2 - a.clock.x]);
    expect([b.kills.y, 1280 - b.kills.x]).toEqual([a.kills.y, 960 - a.kills.x]);
    expect([b.fontSize, b.barWidth, b.barHeight]).toEqual([a.fontSize, a.barWidth, a.barHeight]);
  });

  it('Scenario: Esquina opuesta que sigue a la ventana (1.280 → 1.000: 280 px a la izquierda)', () => {
    const before = hudLayout(frame(1280, 720)).kills.x;
    const after = hudLayout(frame(1000, 600)).kills.x;

    expect(before - after).toBe(280);
  });

  it('Scenario: Ventana menor que 960 × 540 (640 × 360: ×1, mismas distancias que 960 × 540)', () => {
    const small = hudLayout(frame(640, 360));
    const ref = hudLayout(frame(960, 540));

    expect(small.uiScale).toBe(1);
    expect(small.health).toEqual(ref.health);
    expect(640 - small.kills.x).toBe(960 - ref.kills.x);
  });

  it('Scenario: Tamaños proporcionales al factor (×2: medidas y distancias dobles)', () => {
    const one = hudLayout(frame(960, 540));
    const two = hudLayout(frame(1920, 1080));

    expect(two.uiScale).toBe(2);
    expect([two.barWidth, two.barHeight, two.fontSize, two.margin]).toEqual([
      2 * one.barWidth,
      2 * one.barHeight,
      2 * one.fontSize,
      2 * one.margin,
    ]);
    expect([two.health.bar.y, two.xp.bar.y, two.health.label.x]).toEqual([
      2 * one.health.bar.y,
      2 * one.xp.bar.y,
      2 * one.health.label.x,
    ]);
    expect(1920 - two.kills.x).toBe(2 * (960 - one.kills.x));
  });

  it.each([
    [960, 540],
    [1280, 720],
    [1920, 1080],
    [2560, 1440],
  ])('Scenario: HUD entero y sin solapes (%i × %i, textos más largos)', (w, h) => {
    const boxes = hudBoxes(hudLayout(frame(w, h)), LONGEST);
    const all = Object.values(boxes);

    expect(all.every((b) => inside(b, w, h))).toBe(true);
    expect(all.every((b) => [b.x, b.y, b.width, b.height].every(Number.isFinite))).toBe(true);
    const pairs = all.flatMap((a, i) => all.slice(i + 1).map((b) => overlap(a, b)));
    expect(pairs.some(Boolean)).toBe(false);
  });
});
