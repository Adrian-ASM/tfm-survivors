/** Punto o vector en px CSS. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export const STICK_REST: Point = { x: 0, y: 0 };

const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);

/**
 * Vector del joystick (spec touch-controls 0033, design §4.1), en px CSS: con d = point − origin,
 * dirección d / |d| y módulo m = clamp((|d| − z·R) / (R − z·R), 0, 1). m = 0 dentro de la zona
 * muerta (|d| ≤ z·R) y m = 1 desde el radio. Pura, sin motor ni azar.
 */
export function stickVector(origin: Point, point: Point, radius: number, deadZone: number): Point {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const length = Math.hypot(dx, dy);
  const dead = deadZone * radius;
  if (length === 0 || !(radius > dead)) return STICK_REST;
  const m = clamp01((length - dead) / (radius - dead));
  if (m === 0) return STICK_REST;
  return { x: (dx / length) * m, y: (dy / length) * m };
}
