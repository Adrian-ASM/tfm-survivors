import { screenFrame } from '../phaser/ui/screenFrame';

interface Size {
  readonly width: number;
  readonly height: number;
}

/** Ventana usada en el frame (px CSS, hacia abajo) y escala de UI del lienzo (design 0017 D10). */
export interface ViewportView {
  readonly width: number;
  readonly height: number;
  readonly uiScale: number;
}

/**
 * Sonda `window.__sprint.viewport`: `parentSize` es el tamaño de `#game` (la ventana) y `gameSize`
 * el del lienzo, ya recortado al tope por el `ScaleManager`.
 */
export function viewportProbe(parentSize: Size, gameSize: Size): ViewportView {
  return {
    width: Math.floor(parentSize.width),
    height: Math.floor(parentSize.height),
    uiScale: screenFrame(gameSize.width, gameSize.height).uiScale,
  };
}
