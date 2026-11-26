import { cardLayout } from '../cardLayout';
import { screenFrame, type FrameRule, type FrameSize, type ScreenFrame } from './screenFrame';
import { HUD_BASE, HUD_RESERVE_TEXTS, hudBoxes, hudLayout, type Box } from './uiLayout';

// Escala de la UI del lienzo en modo móvil (spec mobile-display 0033, design §3): funciones puras,
// sin motor. k = min(k_max, max(1, k_min)), sin redondeo.

/** Cartas de una oferta completa (spec upgrades: 3 opciones). */
const OFFER_CARDS = 3;
/** Intervalo y tolerancia de la bisección de k_max. */
const K_LOW = 1;
const K_HIGH = 8;
const K_TOLERANCE = 1e-4;

/**
 * Px CSS por unidad lógica del lienzo: alto mostrado / alto lógico (1 en escritorio). Un tamaño no
 * finito o ≤ 0 (ventana a 0) da 0, que las funciones de escala tratan como «sin medida».
 */
export function displayScale(game: FrameSize, display: FrameSize): number {
  const s = display.height / game.height;
  return Number.isFinite(s) && s > 0 ? s : 0;
}

const inside = (b: Box, w: number, h: number): boolean =>
  b.x >= 0 && b.y >= 0 && b.x + b.width <= w && b.y + b.height <= h;
const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Cajas enteras dentro del lienzo y sin solaparse entre sí. */
function laidOut(boxes: readonly Box[], w: number, h: number): boolean {
  if (!boxes.every((b) => inside(b, w, h))) return false;
  return !boxes.some((a, i) => boxes.slice(i + 1).some((b) => overlap(a, b)));
}

/**
 * ¿Caben con factor k las 3 cartas de una oferta y los elementos del HUD (con los textos de
 * reserva), enteros dentro del lienzo W × H y sin solaparse? (spec: k_max). Las cartas y el HUD
 * se comprueban por separado: el velo de la oferta tapa el HUD y no cuenta como solape.
 */
export function fitsAt(width: number, height: number, k: number): boolean {
  const frame: ScreenFrame = { width, height, uiScale: k };
  const cards = cardLayout(frame, OFFER_CARDS).map((c) => ({
    x: c.x - c.width / 2,
    y: c.y - c.height / 2,
    width: c.width,
    height: c.height,
  }));
  const hud = Object.values(hudBoxes(hudLayout(frame), HUD_RESERVE_TEXTS));
  return laidOut(cards, width, height) && laidOut(hud, width, height);
}

/**
 * Mayor k en [1, 8] con el que todo cabe (`fitsAt`), por bisección con tolerancia 1e-4: el layout
 * es lineal en k con anclajes a los bordes, así que el predicado es monótono. Si ni a ×1 cabe
 * (ventana a 0), 1.
 */
export function maxUiScale(width: number, height: number): number {
  if (!fitsAt(width, height, K_LOW)) return K_LOW;
  if (fitsAt(width, height, K_HIGH)) return K_HIGH;
  let lo = K_LOW;
  let hi = K_HIGH;
  while (hi - lo > K_TOLERANCE) {
    const mid = (lo + hi) / 2;
    if (fitsAt(width, height, mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Factor de la UI del lienzo en modo móvil: k_min = minTextPx / (14 · s) hace que el texto base
 * mida `minTextPx` px CSS; k_max = `maxUiScale`. Si k_min > k_max gana que todo quepa. Con s ≤ 0 o
 * no finito, k = 1.
 */
export function mobileUiScale(
  width: number,
  height: number,
  cssPerUnit: number,
  minTextPx: number,
): number {
  if (!(Number.isFinite(cssPerUnit) && cssPerUnit > 0)) return 1;
  const kMin = minTextPx / (HUD_BASE.fontSize * cssPerUnit);
  return Math.min(maxUiScale(width, height), Math.max(1, kMin));
}

/**
 * Regla del frame en modo móvil: el mismo `ScreenFrame` (tamaño lógico hacia abajo) con el k
 * fraccionario de `mobileUiScale`.
 */
export function mobileFrameRule(minTextPx: number): FrameRule {
  return (game, display) => {
    const { width, height } = screenFrame(game.width, game.height);
    const uiScale = mobileUiScale(width, height, displayScale(game, display), minTextPx);
    return { width, height, uiScale };
  };
}
