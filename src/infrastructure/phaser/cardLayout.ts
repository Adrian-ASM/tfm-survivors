import type { ScreenFrame } from './ui/screenFrame';

/** Medidas de una carta de mejora a ×1 (presentación); se multiplican por el escalón de UI. */
export const CARD_WIDTH = 240;
export const CARD_HEIGHT = 170;
export const CARD_GAP = 24;
/** Margen interior mínimo del texto de la carta (también horizontal con pieza) y su fuente a ×1. */
export const CARD_TEXT_PADDING = 16;
export const CARD_FONT_SIZE = 14;
/** Alto de línea estimado de los textos de la carta, en múltiplos del tamaño de fuente. */
export const CARD_LINE_HEIGHT = 1.25;
/** Separación vertical entre nombre, descripción y nivel a ×1. */
export const CARD_TEXT_GAP = 6;

/** Márgenes de la pieza de la carta (l, t, r, b) en px de la hoja. */
export interface CardMargins {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * Área de texto de una carta (spec upgrades 0032): centro horizontal `x` y ancho de ajuste
 * `wrapWidth`, borde superior del nombre `nameTop` y borde inferior del nivel `levelBottom`.
 */
export interface CardTextLayout {
  readonly x: number;
  readonly wrapWidth: number;
  readonly left: number;
  readonly nameTop: number;
  readonly levelBottom: number;
}

/**
 * Área útil del texto de la carta (función pura): a izquierda y derecha max(16, l)·k y
 * max(16, r)·k, arriba t·k y abajo b·k de la pieza `button` (design 0032 §5).
 */
export function cardTextLayout(rect: CardRect, m: CardMargins, k: number): CardTextLayout {
  const left = rect.x - rect.width / 2 + Math.max(CARD_TEXT_PADDING, m.left) * k;
  const right = rect.x + rect.width / 2 - Math.max(CARD_TEXT_PADDING, m.right) * k;
  return {
    x: (left + right) / 2,
    wrapWidth: right - left,
    left,
    nameTop: rect.y - rect.height / 2 + m.top * k,
    levelBottom: rect.y + rect.height / 2 - m.bottom * k,
  };
}

/**
 * Líneas de un texto con ajuste por palabras a `maxChars` caracteres por línea (estimación con la
 * fuente monoespaciada; una palabra más larga que la línea ocupa las que necesite).
 */
export function wrapLines(text: string, maxChars: number): number {
  const width = Math.max(1, Math.floor(maxChars));
  let lines = 1;
  let used = 0;
  for (const word of text.split(' ')) {
    const len = word.length;
    const need = used === 0 ? len : used + 1 + len;
    if (need <= width) {
      used = need;
      continue;
    }
    if (used > 0) lines++;
    lines += Math.max(0, Math.ceil(len / width) - 1);
    used = len % width || (len === 0 ? 0 : width);
  }
  return lines;
}

/** Rectángulo de una carta: centro (x, y) y tamaño, en píxeles del lienzo. */
export interface CardRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Coloca `count` cartas en fila, centradas en el lienzo y a la escala de UI del frame (función
 * pura, sin motor; design 0017 D5). Con ×1 la fila de 3 mide 768 px: en un lienzo más estrecho se
 * recorta (sin mínimo de ventana, decisión del usuario).
 */
export function cardLayout(frame: ScreenFrame, count: number): CardRect[] {
  const k = frame.uiScale;
  const width = CARD_WIDTH * k;
  const gap = CARD_GAP * k;
  const total = count * width + Math.max(0, count - 1) * gap;
  const left = (frame.width - total) / 2 + width / 2;
  return Array.from({ length: count }, (_, i) => ({
    x: left + i * (width + gap),
    y: frame.height / 2,
    width,
    height: CARD_HEIGHT * k,
  }));
}
