import { describe, expect, it } from 'vitest';
import { viewportProbe } from '../../src/infrastructure/e2e/viewportProbe';
import { mobileFrameRule } from '../../src/infrastructure/phaser/ui/mobileFrame';
import { HUD_METRICS } from '../support/hud';

// Spec world-camera (0017), "Sonda de cámara para E2E" (design D10): tamaño de ventana y escala.
describe('viewportProbe (0017)', () => {
  it('ventana redondeada hacia abajo y escala de UI del lienzo', () => {
    expect(viewportProbe({ width: 1280.6, height: 720.4 }, { width: 1280, height: 720 })).toEqual({
      width: 1280,
      height: 720,
      uiScale: 1,
      mobile: false,
      domScale: 1,
      displayScale: 1,
      hint: false,
    });
  });

  it('ventana mayor que el tope: tamaño de la ventana, escala del lienzo recortado (×2)', () => {
    expect(
      viewportProbe({ width: 3840, height: 2160 }, { width: 2560, height: 1440 }),
    ).toMatchObject({ width: 3840, height: 2160, uiScale: 2, domScale: 2, mobile: false });
  });
});

// Spec mobile-display (0033), "Sonda de pantalla con modo móvil".
describe('viewportProbe con modo móvil (0033)', () => {
  const MOBILE = { mobile: true, rule: mobileFrameRule(12, HUD_METRICS) };

  it('Scenario: Sonda en móvil (844 × 390: móvil, DOM 1, factor ≥ 1 y px CSS por unidad)', () => {
    const v = viewportProbe(
      { width: 844, height: 390 },
      { width: 1385.03, height: 640 },
      { width: 844, height: 390 },
      MOBILE,
      true,
    );

    expect([v.mobile, v.width, v.height, v.domScale, v.hint]).toEqual([true, 844, 390, 1, true]);
    expect(v.uiScale).toBeCloseTo(1.4066, 3);
    expect(v.displayScale).toBeCloseTo(390 / 640, 9);
    expect(14 * v.uiScale * v.displayScale).toBeGreaterThanOrEqual(12 - 1e-9);
  });

  it('Scenario: Sonda en escritorio (1.280 × 720: no móvil, escala 1 como antes, sin indicación)', () => {
    const v = viewportProbe(
      { width: 1280, height: 720 },
      { width: 1280, height: 720 },
      undefined,
      undefined,
      true,
    );

    expect(v).toEqual({
      width: 1280,
      height: 720,
      uiScale: 1,
      mobile: false,
      domScale: 1,
      displayScale: 1,
      hint: false,
    });
  });
});
