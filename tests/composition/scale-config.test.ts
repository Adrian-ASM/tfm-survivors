import { describe, expect, it } from 'vitest';
import {
  EXPAND_MODE,
  NO_CENTER,
  RESIZE_MODE,
  scaleConfig,
} from '../../src/composition/scaleConfig';
import { DEFAULT_MAX_VIEW, DEFAULT_MOBILE } from '../support/builders';

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

// Spec world-camera y mobile-display (0033, ADR-0029): EXPAND solo en móvil, elegido al cargar.
describe('scaleConfig con modo móvil (0033)', () => {
  it('Scenario: Misma ventana con y sin modo móvil (sin móvil: el objeto RESIZE de siempre)', () => {
    expect(scaleConfig(DEFAULT_MAX_VIEW, undefined)).toEqual(scaleConfig(DEFAULT_MAX_VIEW));
    expect(scaleConfig(DEFAULT_MAX_VIEW).mode).toBe(RESIZE_MODE);
  });

  it('Scenario: Misma ventana con y sin modo móvil (con móvil: EXPAND sobre 960 × 640 con el tope)', () => {
    expect(scaleConfig(DEFAULT_MAX_VIEW, DEFAULT_MOBILE)).toEqual({
      mode: EXPAND_MODE,
      width: 960,
      height: 640,
      min: { width: 1, height: 1 },
      max: { width: DEFAULT_MAX_VIEW.width, height: DEFAULT_MAX_VIEW.height },
      snap: { width: 1, height: 1 },
      autoCenter: NO_CENTER,
    });
  });

  it('Scenario: Modo móvil con densidad de píxeles 3 (la config no depende del dpr)', () => {
    // La única entrada es el contenido: no hay ningún parámetro de densidad que pueda cambiarla.
    expect(scaleConfig.length).toBe(2);
    expect(scaleConfig(DEFAULT_MAX_VIEW, DEFAULT_MOBILE)).toEqual(
      scaleConfig({ ...DEFAULT_MAX_VIEW }, { ...DEFAULT_MOBILE }),
    );
  });

  it('EXPAND es la constante de Phaser 4.2.1 (Scale.EXPAND = 6)', () => {
    expect(EXPAND_MODE).toBe(6);
  });
});
