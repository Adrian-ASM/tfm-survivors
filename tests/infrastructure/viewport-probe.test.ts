import { describe, expect, it } from 'vitest';
import { viewportProbe } from '../../src/infrastructure/e2e/viewportProbe';

// Spec world-camera (0017), "Sonda de cámara para E2E" (design D10): tamaño de ventana y escala.
describe('viewportProbe (0017)', () => {
  it('ventana redondeada hacia abajo y escala de UI del lienzo', () => {
    expect(viewportProbe({ width: 1280.6, height: 720.4 }, { width: 1280, height: 720 })).toEqual({
      width: 1280,
      height: 720,
      uiScale: 1,
    });
  });

  it('ventana mayor que el tope: tamaño de la ventana, escala del lienzo recortado (×2)', () => {
    expect(viewportProbe({ width: 3840, height: 2160 }, { width: 2560, height: 1440 })).toEqual({
      width: 3840,
      height: 2160,
      uiScale: 2,
    });
  });
});
