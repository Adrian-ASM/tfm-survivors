/**
 * `Phaser.Scale.RESIZE`, `Phaser.Scale.EXPAND` y `Phaser.Scale.NO_CENTER` en Phaser 4.2.1
 * (`src/scale/const/SCALE_MODE_CONST.js`, `CENTER_CONST.js`). Valores literales para que la
 * configuración se pruebe en Node sin cargar el motor; `main.ts` la pasa tal cual a `Phaser.Game`.
 */
export const RESIZE_MODE = 5;
export const EXPAND_MODE = 6;
export const NO_CENTER = 0;

interface Size {
  readonly width: number;
  readonly height: number;
}

/** Base del lienzo en modo móvil (`arena.mobile`, 0033): ancho mínimo × alto base. */
export interface MobileBase {
  readonly minWidth: number;
  readonly baseHeight: number;
}

/** Configuración de escalado del lienzo (design 0017 D1, ADR-0014; 0033, ADR-0029). */
export interface ScaleSettings {
  readonly mode: typeof RESIZE_MODE | typeof EXPAND_MODE;
  readonly width: number;
  readonly height: number;
  readonly min: Size;
  readonly max: Size;
  readonly snap: Size;
  readonly autoCenter: typeof NO_CENTER;
}

/**
 * Lienzo a ventana completa con tope: RESIZE ajusta el lienzo al padre `#game` recortado a `max`
 * (el tope de vista), con `snap` 1 × 1 (enteros aunque el padre mida 1.280,5 px) y `min` 1 × 1
 * (ventana minimizada). Sin `autoCenter`: el centrado lo hace la rejilla CSS de `#game`, y los dos a
 * la vez desplazarían el lienzo el doble. El tamaño inicial lo sustituye el del padre en el arranque.
 *
 * Con `mobile` (0033, ADR-0029): EXPAND sobre la base `minWidth × baseHeight`, con el mismo tope.
 * Phaser calcula el tamaño lógico (nunca menos que la base) y lo muestra a la ventana. La ruta se
 * elige una vez al cargar: el `ScaleManager` lee el modo al construir el juego.
 */
export function scaleConfig(maxView: Size, mobile?: MobileBase): ScaleSettings {
  return {
    mode: mobile ? EXPAND_MODE : RESIZE_MODE,
    width: mobile ? mobile.minWidth : maxView.width,
    height: mobile ? mobile.baseHeight : maxView.height,
    min: { width: 1, height: 1 },
    max: { width: maxView.width, height: maxView.height },
    snap: { width: 1, height: 1 },
    autoCenter: NO_CENTER,
  };
}
