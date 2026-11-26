import { displayScale } from '../phaser/ui/mobileFrame';
import { desktopFrameRule, type FrameRule } from '../phaser/ui/screenFrame';

interface Size {
  readonly width: number;
  readonly height: number;
}

/** Ventana usada en el frame (px CSS, hacia abajo) y escala de UI del lienzo (design 0017 D10). */
export interface ViewportView {
  readonly width: number;
  readonly height: number;
  /** Factor del HUD y las cartas: entero en escritorio, fraccionario en modo móvil (0033). */
  readonly uiScale: number;
  /** Modo móvil de la carga (0033). */
  readonly mobile: boolean;
  /** Escala de UI de los paneles DOM: 1 en móvil, igual a `uiScale` en escritorio (0033). */
  readonly domScale: number;
  /** Px CSS por unidad lógica del lienzo (1 en escritorio; 0033). */
  readonly displayScale: number;
  /** Indicación en reposo del joystick visible en el último frame (siempre falso en escritorio). */
  readonly hint: boolean;
}

/** Modo de la carga para la sonda: si es móvil y con qué regla se calcula el frame. */
export interface ViewportMode {
  readonly mobile: boolean;
  readonly rule: FrameRule;
}

export const DESKTOP_VIEWPORT: ViewportMode = { mobile: false, rule: desktopFrameRule };

/**
 * Sonda `window.__sprint.viewport`: `parentSize` es el tamaño de `#game` (la ventana), `gameSize`
 * el del lienzo, ya recortado al tope por el `ScaleManager`, y `displaySize` el mostrado en px CSS
 * (igual al `gameSize` en escritorio).
 */
export function viewportProbe(
  parentSize: Size,
  gameSize: Size,
  displaySize: Size = gameSize,
  mode: ViewportMode = DESKTOP_VIEWPORT,
  hint = false,
): ViewportView {
  const uiScale = mode.rule(gameSize, displaySize).uiScale;
  return {
    width: Math.floor(parentSize.width),
    height: Math.floor(parentSize.height),
    uiScale,
    mobile: mode.mobile,
    domScale: mode.mobile ? 1 : uiScale,
    displayScale: displayScale(gameSize, displaySize),
    hint: mode.mobile && hint,
  };
}
