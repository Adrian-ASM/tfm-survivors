/** Referencia de la UI a escala ×1 (el lienzo de antes de 0017): los escalones se cuentan en ella. */
export const UI_REFERENCE = { width: 960, height: 540 } as const;

/**
 * Tamaño entero del lienzo y escala de UI entera (value object de presentación, design 0017 D5).
 * No llega al núcleo: solo coloca HUD, cartas y paneles.
 */
export interface ScreenFrame {
  readonly width: number;
  readonly height: number;
  /** Escalón de la UI: ×1 por debajo de 1.920 × 1.080, ×2 desde ahí (con el tope de 2.560 × 1.440). */
  readonly uiScale: number;
}

/** Entero ≥ 1 redondeado hacia abajo; los valores no finitos o menores que 1 dan 1. */
const side = (v: number): number => (Number.isFinite(v) && v >= 1 ? Math.floor(v) : 1);

/** Frame saneado del tamaño del lienzo (el motor ya lo recorta al tope de vista). */
export function screenFrame(width: number, height: number): ScreenFrame {
  const w = side(width);
  const h = side(height);
  const steps = Math.floor(Math.min(w / UI_REFERENCE.width, h / UI_REFERENCE.height));
  return { width: w, height: h, uiScale: Math.max(1, steps) };
}

/** Tamaño en unidades del lienzo (`gameSize`) o en px CSS (`displaySize`). */
export interface FrameSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Regla del frame (0033): del tamaño lógico del lienzo y del mostrado en px CSS al `ScreenFrame`.
 * En escritorio es `screenFrame` (escalones enteros); en móvil, `mobileFrameRule` (k fraccionario).
 */
export type FrameRule = (game: FrameSize, display: FrameSize) => ScreenFrame;

/** Regla de escritorio: la de siempre, que ignora el tamaño mostrado (zoom 1). */
export const desktopFrameRule: FrameRule = (game) => screenFrame(game.width, game.height);
