/** Medidas de una carta de mejora (presentación). */
export const CARD_WIDTH = 240;
export const CARD_HEIGHT = 170;
export const CARD_GAP = 24;

/** Rectángulo de una carta: centro (x, y) y tamaño, en unidades de la vista. */
export interface CardRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Coloca `count` cartas en fila, centradas en la vista (función pura, sin motor). */
export function cardLayout(
  view: { readonly width: number; readonly height: number },
  count: number,
): CardRect[] {
  const total = count * CARD_WIDTH + Math.max(0, count - 1) * CARD_GAP;
  const left = (view.width - total) / 2 + CARD_WIDTH / 2;
  return Array.from({ length: count }, (_, i) => ({
    x: left + i * (CARD_WIDTH + CARD_GAP),
    y: view.height / 2,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  }));
}
