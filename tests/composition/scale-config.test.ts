import { describe, expect, it } from 'vitest';
import { NO_CENTER, RESIZE_MODE, scaleConfig } from '../../src/composition/scaleConfig';
import { DEFAULT_MAX_VIEW } from '../support/builders';

// Spec world-camera (0017), "Vista a ventana completa con tope" (design D1, ADR-0014).
describe('scaleConfig (0017)', () => {
  it('RESIZE con mínimo 1 × 1, máximo el tope, snap 1 × 1, sin centrado y tamaño inicial el tope', () => {
    expect(scaleConfig(DEFAULT_MAX_VIEW)).toEqual({
      mode: RESIZE_MODE,
      width: DEFAULT_MAX_VIEW.width,
      height: DEFAULT_MAX_VIEW.height,
      min: { width: 1, height: 1 },
      max: { width: DEFAULT_MAX_VIEW.width, height: DEFAULT_MAX_VIEW.height },
      snap: { width: 1, height: 1 },
      autoCenter: NO_CENTER,
    });
  });

  it('las constantes son las de Phaser 4.2.1 (Scale.RESIZE = 5, Scale.NO_CENTER = 0)', () => {
    expect([RESIZE_MODE, NO_CENTER]).toEqual([5, 0]);
  });
});
