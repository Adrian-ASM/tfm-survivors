import type { ScreenFrame } from './screenFrame';

// Layout puro del HUD (design 0017 D5): medidas de ×1 multiplicadas por el escalón de UI y anclajes
// a los bordes del lienzo. Sin motor: se prueba en Node y lo aplican los widgets en cada RESIZE.

/**
 * Medidas del HUD a ×1. 0032: margen y filas desplazadas 8 y 12 px para que el contenido quede a
 * ≥ `panelInset` + margen de la pieza `panel` (16) del borde de la ventana; el anclaje no cambia.
 */
export const HUD_BASE = {
  margin: 24,
  barWidth: 240,
  barHeight: 10,
  healthY: 28,
  xpY: 46,
  labelGap: 8,
  fontSize: 14,
  /** 0022: contadores de oro (fila de la XP) y madera bajo las bajas, a la derecha. */
  woodY: 64,
  /** 0025: contador de piedra, tercera fila de contadores bajo la madera. */
  stoneY: 82,
  iconSize: 16,
  iconGap: 4,
  /** 0032: separación mínima entre un panel del HUD y el borde de la ventana. */
  panelInset: 4,
} as const;

/**
 * Ancho de un carácter de la fuente monoespaciada del HUD, en múltiplos del tamaño de fuente. 0032:
 * 0,64 ≥ el avance de Departure Mono (350/550 = 0,636 em); `monospace` es más estrecha.
 */
export const MONO_CHAR_RATIO = 0.64;

/** Punto de anclaje de un texto: x, y (centro vertical) y origen horizontal (0, 0,5 o 1). */
export interface TextAnchor {
  readonly x: number;
  readonly y: number;
  readonly originX: number;
}

/** Barra con origen a la izquierda y centrada en `y`. */
export interface BarAnchor {
  readonly x: number;
  readonly y: number;
}

export interface HudLayout {
  readonly uiScale: number;
  readonly margin: number;
  readonly barWidth: number;
  readonly barHeight: number;
  readonly fontSize: number;
  readonly health: { readonly bar: BarAnchor; readonly label: TextAnchor };
  readonly xp: { readonly bar: BarAnchor; readonly label: TextAnchor };
  readonly clock: TextAnchor;
  readonly kills: TextAnchor;
  /** Contadores de oro, de madera (0022) y de piedra (0025): icono + número, un solo elemento. */
  readonly gold: CounterAnchor;
  readonly wood: CounterAnchor;
  readonly stone: CounterAnchor;
}

/** Icono cuadrado centrado en (x, y), de lado `size`. */
export interface IconAnchor {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

/** Contador del HUD: icono fijo junto al margen y número alineado a la derecha a su izquierda. */
export interface CounterAnchor {
  readonly icon: IconAnchor;
  readonly label: TextAnchor;
}

/** Contador anclado al borde derecho en la fila `y` (todo ×uiScale). */
function counterAt(frame: ScreenFrame, y: number): CounterAnchor {
  const k = frame.uiScale;
  const size = HUD_BASE.iconSize * k;
  const right = frame.width - HUD_BASE.margin * k;
  return {
    icon: { x: right - size / 2, y, size },
    label: { x: right - size - HUD_BASE.iconGap * k, y, originX: 1 },
  };
}

/** Vida y XP arriba a la izquierda, reloj arriba en el centro y bajas arriba a la derecha. */
export function hudLayout(frame: ScreenFrame): HudLayout {
  const k = frame.uiScale;
  const margin = HUD_BASE.margin * k;
  const barWidth = HUD_BASE.barWidth * k;
  const healthY = HUD_BASE.healthY * k;
  const xpY = HUD_BASE.xpY * k;
  const labelX = margin + barWidth + HUD_BASE.labelGap * k;
  return {
    uiScale: k,
    margin,
    barWidth,
    barHeight: HUD_BASE.barHeight * k,
    fontSize: HUD_BASE.fontSize * k,
    health: { bar: { x: margin, y: healthY }, label: { x: labelX, y: healthY, originX: 0 } },
    xp: { bar: { x: margin, y: xpY }, label: { x: labelX, y: xpY, originX: 0 } },
    clock: { x: frame.width / 2, y: healthY, originX: 0.5 },
    kills: { x: frame.width - margin, y: healthY, originX: 1 },
    gold: counterAt(frame, xpY),
    wood: counterAt(frame, HUD_BASE.woodY * k),
    stone: counterAt(frame, HUD_BASE.stoneY * k),
  };
}

/** Rectángulo en píxeles del lienzo (esquina superior izquierda y tamaño). */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Caja reservada de un texto de una línea con la fuente del HUD. */
export function textBox(anchor: TextAnchor, text: string, fontSize: number): Box {
  const width = text.length * fontSize * MONO_CHAR_RATIO;
  return {
    x: anchor.x - anchor.originX * width,
    y: anchor.y - fontSize / 2,
    width,
    height: fontSize,
  };
}

const barBox = (bar: BarAnchor, l: HudLayout): Box => ({
  x: bar.x,
  y: bar.y - l.barHeight / 2,
  width: l.barWidth,
  height: l.barHeight,
});

/** Caja de un contador: la unión del icono y del texto (un solo elemento, spec hud 0022). */
function counterBox(c: CounterAnchor, text: string, fontSize: number): Box {
  const t = textBox(c.label, text, fontSize);
  const half = c.icon.size / 2;
  const x0 = Math.min(t.x, c.icon.x - half);
  const y0 = Math.min(t.y, c.icon.y - half);
  const x1 = Math.max(t.x + t.width, c.icon.x + half);
  const y1 = Math.max(t.y + t.height, c.icon.y + half);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Textos del HUD con los que se reservan las cajas. */
export interface HudTexts {
  readonly health: string;
  readonly clock: string;
  readonly level: string;
  readonly kills: string;
  readonly gold: string;
  readonly wood: string;
  readonly stone: string;
}

/** Cajas de los elementos del HUD con los textos dados (comprobación de solapes y contención). */
export function hudBoxes(l: HudLayout, texts: HudTexts): Record<string, Box> {
  return {
    healthBar: barBox(l.health.bar, l),
    healthLabel: textBox(l.health.label, texts.health, l.fontSize),
    xpBar: barBox(l.xp.bar, l),
    xpLabel: textBox(l.xp.label, texts.level, l.fontSize),
    clock: textBox(l.clock, texts.clock, l.fontSize),
    kills: textBox(l.kills, texts.kills, l.fontSize),
    gold: counterBox(l.gold, texts.gold, l.fontSize),
    wood: counterBox(l.wood, texts.wood, l.fontSize),
    stone: counterBox(l.stone, texts.stone, l.fontSize),
  };
}

/** Rectángulo centrado en (x, y) (origen 0,5 de Phaser). */
export interface CenteredRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Velo de la oferta y de los resultados: todo el lienzo, centrado. */
export function veilLayout(frame: ScreenFrame): CenteredRect {
  return { x: frame.width / 2, y: frame.height / 2, width: frame.width, height: frame.height };
}

/**
 * Textos de reserva de los paneles del HUD (spec hud 0032): vida `120/120`, nivel 99, 12.345 bajas,
 * oro 123.456, madera y piedra 12.345. Los paneles se miden con ellos, nunca con el texto vivo.
 */
export const HUD_RESERVE_TEXTS: HudTexts = {
  health: '120/120',
  clock: '00:00',
  level: 'Nv 99',
  kills: 'Bajas: 12345',
  gold: '123456',
  wood: '12345',
  stone: '12345',
};

/** Márgenes de la pieza del panel (l, t, r, b) en px de la hoja. */
export interface PanelMargins {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Los 3 paneles del HUD (0032): izquierda (vida y XP), centro (tiempo) y derecha (bajas y recursos). */
export interface HudPanels {
  readonly left: CenteredRect;
  readonly center: CenteredRect;
  readonly right: CenteredRect;
}

/** Unión de cajas ampliada con los márgenes × k, como rectángulo centrado. */
function panelAround(boxes: readonly Box[], m: PanelMargins, k: number): CenteredRect {
  const x0 = Math.min(...boxes.map((b) => b.x)) - m.left * k;
  const y0 = Math.min(...boxes.map((b) => b.y)) - m.top * k;
  const x1 = Math.max(...boxes.map((b) => b.x + b.width)) + m.right * k;
  const y1 = Math.max(...boxes.map((b) => b.y + b.height)) + m.bottom * k;
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, width: x1 - x0, height: y1 - y0 };
}

/**
 * Paneles del HUD (0032, design §5): cada uno rodea sus elementos, medidos con los textos de
 * reserva, con un margen de (margen de la pieza × k) por lado. Dependen solo de la ventana y de k;
 * no entran en `hudBoxes` (el panel no es un elemento del HUD en las comprobaciones de solape).
 */
export function hudPanels(l: HudLayout, m: PanelMargins): HudPanels {
  const b = hudBoxes(l, HUD_RESERVE_TEXTS);
  const pick = (...keys: string[]): Box[] =>
    keys.flatMap((key) => {
      const box = b[key];
      return box ? [box] : [];
    });
  const k = l.uiScale;
  return {
    left: panelAround(pick('healthBar', 'healthLabel', 'xpBar', 'xpLabel'), m, k),
    center: panelAround(pick('clock'), m, k),
    right: panelAround(pick('kills', 'gold', 'wood', 'stone'), m, k),
  };
}
