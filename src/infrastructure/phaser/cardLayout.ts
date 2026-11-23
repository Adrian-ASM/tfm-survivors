import type { ScreenFrame } from './ui/screenFrame';

/** Medidas de una carta de mejora a ×1 (presentación); se multiplican por el escalón de UI. */
export const CARD_WIDTH = 240;
export const CARD_HEIGHT = 170;
export const CARD_GAP = 24;

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
