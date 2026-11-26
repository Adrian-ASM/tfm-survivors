import { describe, expect, it } from 'vitest';
import { formatClock, healthLabel, killsLabel } from '../../src/infrastructure/phaser/hudFormat';
import { screenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
import {
  HUD_BASE,
  HUD_RESERVE_TEXTS,
  hudBoxes,
  hudLayout,
  hudPanels,
  type Box,
  type CenteredRect,
} from '../../src/infrastructure/phaser/ui/uiLayout';
import { levelLabel } from '../../src/infrastructure/phaser/XpBar';

// Spec hud (0017): "HUD anclado a la ventana" y "Escala del HUD por escalones" (design D5).
const frame = screenFrame;
/** Textos más largos del escenario "HUD entero y sin solapes". */
const LONGEST = {
  health: healthLabel(120, 120),
  clock: formatClock(600),
  level: levelLabel(99),
  kills: killsLabel(12345),
  // 0022: oro 123.456 y madera 12.345, enteros completos.
  gold: String(123456),
  wood: String(12345),
  // 0025: piedra 12.345.
  stone: String(12345),
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
    [3840, 2160],
  ])('Scenario: HUD entero y sin solapes (%i × %i, textos más largos)', (w, h) => {
    const boxes = hudBoxes(hudLayout(frame(w, h)), LONGEST);
    const all = Object.values(boxes);

    expect(all.every((b) => inside(b, w, h))).toBe(true);
    expect(all.every((b) => [b.x, b.y, b.width, b.height].every(Number.isFinite))).toBe(true);
    const pairs = all.flatMap((a, i) => all.slice(i + 1).map((b) => overlap(a, b)));
    expect(pairs.some(Boolean)).toBe(false);
  });
});

// Spec hud (0022): contadores de oro y madera, icono + número como un solo elemento.
describe('hudLayout · oro y madera (0022)', () => {
  /** Igualdad con error ≤ 1 px (spec hud). */
  const near = (a: number[][], b: number[][]) => {
    expect(a.flat().every((v, i) => Math.abs(v - (b.flat()[i] ?? NaN)) <= 1)).toBe(true);
  };

  /** Distancia al borde derecho y al superior de la caja de cada contador. */
  const anchors = (w: number, h: number) => {
    const boxes = hudBoxes(hudLayout(frame(w, h)), LONGEST);
    return (['gold', 'wood', 'stone'] as const).map((k) => {
      const b = boxes[k];
      return b ? [w - (b.x + b.width), b.y, b.width, b.height] : [];
    });
  };

  it('Scenario: Mismo anclaje con dos ventanas (contadores, 960 × 540 y 1.280 × 720)', () => {
    near(anchors(1280, 720), anchors(960, 540));
  });

  it('Scenario: Esquina opuesta que sigue a la ventana (contadores: 280 px a la izquierda)', () => {
    const at = (w: number, h: number) => hudLayout(frame(w, h)).gold.icon.x;
    expect(at(1280, 720) - at(1000, 600)).toBe(280);
  });

  it('Scenario: Ventana menor que 960 × 540 (contadores a ×1, mismas distancias)', () => {
    near(anchors(640, 360), anchors(960, 540));
  });

  it('Scenario: Contadores reubicados al redimensionar (1.280 → 960 → 2.560: distancia por factor)', () => {
    const [ref] = anchors(960, 540);
    const [big] = anchors(2560, 1440);
    near(anchors(1280, 720), anchors(960, 540));
    near([big ?? []], [(ref ?? []).map((v) => 2 * v)]);
  });

  it('icono a la derecha del número, en la fila de la XP (oro) y bajo él (madera y piedra)', () => {
    const l = hudLayout(frame(960, 540));
    expect(l.gold.label.x).toBeLessThan(l.gold.icon.x - l.gold.icon.size / 2);
    // 0032: filas de HUD_BASE (desplazadas para los paneles), no literales.
    expect([l.gold.icon.y, l.wood.icon.y, l.stone.icon.y]).toEqual([
      l.xp.bar.y,
      HUD_BASE.woodY,
      HUD_BASE.stoneY,
    ]);
    expect(l.gold.label.originX).toBe(1);
    // 0025: a ×2 la piedra baja al doble, alineada con los demás contadores.
    const two = hudLayout(frame(2560, 1440));
    expect([two.stone.icon.y, two.stone.icon.x]).toEqual([2 * HUD_BASE.stoneY, two.gold.icon.x]);
  });
});

// Spec hud (0032), "Paneles del HUD con piezas de UI" (parte de layout, pura).
describe('hudPanels (0032)', () => {
  const PANEL = { left: 16, top: 16, right: 16, bottom: 16 };
  const toBox = (r: CenteredRect): Box => ({
    x: r.x - r.width / 2,
    y: r.y - r.height / 2,
    width: r.width,
    height: r.height,
  });
  /** `inner` está dentro de `outer` con al menos `m` px por lado. */
  const contains = (outer: Box, inner: Box, m: number): boolean =>
    inner.x - outer.x >= m - 1e-9 &&
    inner.y - outer.y >= m - 1e-9 &&
    outer.x + outer.width - (inner.x + inner.width) >= m - 1e-9 &&
    outer.y + outer.height - (inner.y + inner.height) >= m - 1e-9;
  const GROUPS = {
    left: ['healthBar', 'healthLabel', 'xpBar', 'xpLabel'],
    center: ['clock'],
    right: ['kills', 'gold', 'wood', 'stone'],
  } as const;

  it.each([
    [960, 540, 1],
    [1280, 720, 1],
    [2560, 1440, 2],
    [1920, 1080, 2],
  ])('Scenario: Tres paneles con su contenido (%i × %i, k = %i)', (w, h, k) => {
    const l = hudLayout(frame(w, h));
    expect(l.uiScale).toBe(k);
    const p = hudPanels(l, PANEL);
    const boxes = hudBoxes(l, HUD_RESERVE_TEXTS);
    const panels = { left: toBox(p.left), center: toBox(p.center), right: toBox(p.right) };
    for (const [side, keys] of Object.entries(GROUPS)) {
      const panel = panels[side as keyof typeof panels];
      for (const key of keys) {
        const box = boxes[key];
        if (!box) throw new Error(key);
        expect(contains(panel, box, 16 * k), `${side}/${key}`).toBe(true);
      }
      expect(inside(panel, w, h), side).toBe(true);
      // A ≥ panelInset × k de los bordes de la ventana que toca.
      expect(panel.y).toBeGreaterThanOrEqual(HUD_BASE.panelInset * k - 1e-9);
    }
    expect(overlap(panels.left, panels.center)).toBe(false);
    expect(overlap(panels.center, panels.right)).toBe(false);
    expect(overlap(panels.left, panels.right)).toBe(false);
  });

  it('Scenario: Paneles independientes del snapshot (texto vivo largo, mismo panel y contenido dentro)', () => {
    const l = hudLayout(frame(1280, 720));
    const p = hudPanels(l, PANEL);
    // El panel no depende del snapshot: es función de la ventana, k y los márgenes.
    expect(hudPanels(hudLayout(frame(1280, 720)), PANEL)).toEqual(p);
    const live = hudBoxes(l, LONGEST);
    for (const [side, keys] of Object.entries(GROUPS)) {
      const panel = toBox(p[side as keyof typeof p]);
      for (const key of keys) {
        const box = live[key];
        if (!box) throw new Error(key);
        expect(contains(panel, box, 16), `${side}/${key}`).toBe(true);
      }
    }
  });

  it('los textos de reserva son los más largos del escenario (mismo número de caracteres)', () => {
    for (const key of Object.keys(LONGEST) as (keyof typeof LONGEST)[]) {
      expect(HUD_RESERVE_TEXTS[key].length, key).toBeGreaterThanOrEqual(LONGEST[key].length);
    }
  });
});
