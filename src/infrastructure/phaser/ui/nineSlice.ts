import type { UiPiece } from '../../content/appearanceSchema';
import type { CenteredRect } from './uiLayout';

// Geometría pura de una pieza nine-slice (0032, design §5), compartida por el adaptador CSS (los
// anchos de `border-image-width`) y el de Phaser (`NineSlice` con `setScale(k)`): sin motor.

/** Márgenes de una pieza en px de la hoja; en la cabecera 3-slice, t = b = 0. */
export interface SliceMargins {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Un rectángulo en px de pantalla, ancho × alto. */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Márgenes de una pieza de `ui` (0032): la cabecera 3-slice no tiene t ni b. */
export function uiMargins(piece: UiPiece): SliceMargins {
  const { slice } = piece;
  return 'top' in slice
    ? { left: slice.left, top: slice.top, right: slice.right, bottom: slice.bottom }
    : { left: slice.left, top: 0, right: slice.right, bottom: 0 };
}

/** Las 4 esquinas en pantalla con escala de UI k: (l·k × t·k), (r·k × t·k), (l·k × b·k), (r·k × b·k). */
export function screenCorners(
  m: SliceMargins,
  k: number,
): { topLeft: Size; topRight: Size; bottomLeft: Size; bottomRight: Size } {
  return {
    topLeft: { width: m.left * k, height: m.top * k },
    topRight: { width: m.right * k, height: m.top * k },
    bottomLeft: { width: m.left * k, height: m.bottom * k },
    bottomRight: { width: m.right * k, height: m.bottom * k },
  };
}

/** Colocación de un `NineSlice`: centro, tamaño sin escalar y escala k. */
export interface NineSlicePlacement {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
}

/**
 * Colocación de un `NineSlice` para ocupar `rect` con esquinas de margen × k: se dibuja con
 * `setScale(k)` y `setSize(w / k, h / k)`, sin bajar del mínimo `l + r` × `t + b` de la pieza.
 */
export function nineSliceGeometry(
  rect: CenteredRect,
  k: number,
  m: SliceMargins,
): NineSlicePlacement {
  return {
    x: rect.x,
    y: rect.y,
    width: Math.max(rect.width / k, m.left + m.right),
    height: Math.max(rect.height / k, m.top + m.bottom),
    scale: k,
  };
}
