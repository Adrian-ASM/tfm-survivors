import { describe, expect, it } from 'vitest';
import { screenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';

// Spec hud (0017), "Escala del HUD por escalones"; world-camera, "Ventana minimizada" (saneado).
// El tope del lienzo (2.560 × 1.440) lo aplica el ScaleManager: aquí llega el tamaño ya recortado.
const TOPE = { width: 2560, height: 1440 };
const canvasOf = (w: number, h: number) =>
  screenFrame(Math.min(w, TOPE.width), Math.min(h, TOPE.height));

describe('screenFrame (0017, design D5)', () => {
  it.each([
    [320, 180, 1],
    [640, 360, 1],
    [959, 539, 1],
    [960, 540, 1],
    [1280, 720, 1],
    [1919, 1080, 1],
    [1920, 1080, 2],
    [2560, 1440, 2],
  ])('Scenario: Escala mínima / en pantallas grandes (%i × %i → ×%i)', (w, h, k) => {
    expect(screenFrame(w, h)).toEqual({ width: w, height: h, uiScale: k });
  });

  it('Scenario: Escala en pantallas grandes (3.840 × 2.160 recortada al tope: ×2, ≥ la de 2.560)', () => {
    expect(canvasOf(3840, 2160)).toEqual({ width: 2560, height: 1440, uiScale: 2 });
  });

  it('redondea hacia abajo los tamaños con decimales (1.280,5 → 1.280)', () => {
    expect(screenFrame(1280.5, 720.9)).toEqual({ width: 1280, height: 720, uiScale: 1 });
  });

  it.each([
    [0, 0],
    [Number.NaN, Number.NaN],
    [Number.POSITIVE_INFINITY, -5],
  ])('Scenario: Ventana minimizada (%s × %s → 1 × 1, ×1)', (w, h) => {
    expect(screenFrame(w, h)).toEqual({ width: 1, height: 1, uiScale: 1 });
  });

  it('Scenario: Monotonía (960 × 540 … 3.840 × 2.160: enteros ≥ 1, no decrecientes)', () => {
    const scales = [
      [960, 540],
      [1280, 720],
      [1600, 900],
      [1920, 1080],
      [2560, 1440],
      [3840, 2160],
    ].map(([w = 0, h = 0]) => canvasOf(w, h).uiScale);

    expect(scales.every((k) => Number.isInteger(k) && k >= 1)).toBe(true);
    expect(scales).toEqual([...scales].sort((a, b) => a - b));
  });
});
