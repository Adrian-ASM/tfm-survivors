// Números de daño y barras de vida por reloj de render (change 0031, design D7 y D8). Puro: sin
// motor, sin azar y sin reloj del sistema; el resultado depende solo de los argumentos.
import type { HitSnapshot, StructureSnapshot } from '../../../domain/run/RunSnapshot';

/** Movimiento del número: duración L (ms), ascenso H (px) y elevación inicial E (px). */
export interface NumberMotion {
  readonly durationMs: number;
  readonly risePx: number;
  readonly liftPx: number;
}

/** Pose de un número de edad `a`: si se ve, su desplazamiento en y y su opacidad. */
export interface NumberPose {
  visible: boolean;
  dy: number;
  alpha: number;
}

/**
 * Pose de un número con edad a = R − R_b (ms): se ve si y solo si 0 ≤ a < L, con centro en
 * (x, y − E − H·a/L) y opacidad 1 − a/L. Escribe en `out` (sin asignar por frame) y lo devuelve.
 */
export function numberPose(
  age: number,
  m: NumberMotion,
  out: NumberPose = { visible: false, dy: 0, alpha: 0 },
): NumberPose {
  const t = age / m.durationMs;
  out.visible = age >= 0 && age < m.durationMs;
  out.dy = -m.liftPx - m.risePx * t;
  out.alpha = 1 - t;
  return out;
}

/**
 * Índice del primer golpe que crea número en este frame: los de id > `lastId` (la lista va por id)
 * y, si son más que el pool, solo los `pool` de id más alto. `hits.length` si no hay ninguno nuevo.
 */
export function newHits(hits: readonly HitSnapshot[], lastId: number, pool: number): number {
  let from = hits.length;
  while (from > 0 && (hits[from - 1]?.id ?? -1) > lastId) from--;
  return Math.max(from, hits.length - pool);
}

/** Texto del número: el daño en cifras decimales, sin signo, decimales ni separador de miles. */
export const damageText = (amount: number): string => String(amount);

/** Medidas de la barra de vida de los datos de aspecto. */
export interface BarSpec {
  readonly width: number;
  readonly height: number;
  readonly gap: number;
}

/** Rectángulo en coordenadas de mundo (esquina superior izquierda, ancho y alto). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Fondo y relleno de la barra de una estructura: centrada en x en su posición, con el borde
 * inferior `gap` px sobre el borde superior de su huella (fila × lado de celda), y el relleno
 * alineado a la izquierda con ancho = ancho × vida / vida máxima, sin redondeo.
 */
export function barRects(
  s: StructureSnapshot,
  bar: BarSpec,
  cellSize: number,
  out: { back: Rect; fill: Rect } = {
    back: { x: 0, y: 0, w: 0, h: 0 },
    fill: { x: 0, y: 0, w: 0, h: 0 },
  },
): { back: Rect; fill: Rect } {
  const x = s.x - bar.width / 2;
  const y = s.row * cellSize - bar.gap - bar.height;
  const { back, fill } = out;
  back.x = fill.x = x;
  back.y = fill.y = y;
  back.h = fill.h = bar.height;
  back.w = bar.width;
  fill.w = (bar.width * s.health) / s.maxHealth;
  return out;
}
