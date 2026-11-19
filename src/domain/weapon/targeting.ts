import { circlesOverlap } from '../collision/contact';
import { assertNever } from '../shared/assertNever';
import type { TargetingConfig } from './WeaponType';
import type { WeaponTarget } from './WeaponTarget';

/**
 * Índice del vivo más cercano a (px, py) con distancia entre centros ≤ range (inclusiva), o −1.
 * Empate: el primero de la lista (comparación estricta). O(n), sin raíces ni asignaciones.
 */
export function nearestInRange(
  px: number,
  py: number,
  range: number,
  targets: readonly WeaponTarget[],
): number {
  let best = -1;
  let bestD2 = range * range;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (!t?.alive) continue;
    const dx = t.x - px;
    const dy = t.y - py;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2 || (best === -1 && d2 === bestD2)) {
      best = i;
      bestD2 = d2;
    }
  }
  return best;
}

/** Índice del primer vivo cuyo círculo solapa (estricto) el de radio `radius` en (px, py), o −1. */
export function firstInRadius(
  px: number,
  py: number,
  radius: number,
  targets: readonly WeaponTarget[],
): number {
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (t?.alive && circlesOverlap(px, py, radius, t.x, t.y, t.radius)) return i;
  }
  return -1;
}

/**
 * Índice del enemigo que activa el disparo según el criterio, o −1 (ADR-0007: todos los criterios
 * tienen esta firma; el ataque decide qué hacer con él). Ignora los muertos aún no compactados.
 */
export function selectTarget(
  t: TargetingConfig,
  px: number,
  py: number,
  targets: readonly WeaponTarget[],
): number {
  switch (t.mode) {
    case 'nearest-in-range':
      return nearestInRange(px, py, t.range, targets);
    case 'any-in-radius':
      return firstInRadius(px, py, t.radius, targets);
    default:
      return assertNever(t);
  }
}
