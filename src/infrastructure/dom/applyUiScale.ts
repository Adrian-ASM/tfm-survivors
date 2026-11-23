import type { ScreenFrame } from '../phaser/ui/screenFrame';

/** Variable CSS con el escalón de UI que usan los paneles DOM (`src/styles.css`). */
export const UI_SCALE_PROPERTY = '--ui-scale';

/** Lo que se usa de `CSSStyleDeclaration` (CSSOM: lo permite `style-src 'self'`). */
export interface StyleLike {
  setProperty(name: string, value: string): void;
  getPropertyValue(name: string): string;
}

/**
 * Pone `--ui-scale` en el contenedor del juego con el escalón del frame (design 0017 D6, D11): una
 * sola escala para HUD, cartas y paneles DOM. Solo escribe si el valor cambia.
 */
export function applyUiScale(style: StyleLike, frame: ScreenFrame): void {
  const value = String(frame.uiScale);
  if (style.getPropertyValue(UI_SCALE_PROPERTY) === value) return;
  style.setProperty(UI_SCALE_PROPERTY, value);
}
