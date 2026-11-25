import { circlesOverlap } from '../collision/contact';
import type { WeaponTarget } from './WeaponTarget';

/**
 * Primer objetivo vivo de la lista que solapa el círculo (x, y, r), o `undefined`: el impacto de un
 * proyectil del jugador o de una flecha de torre (los muertos aún sin retirar no cuentan). Sin
 * asignar.
 */
export function firstOverlapping(
  x: number,
  y: number,
  r: number,
  targets: readonly WeaponTarget[],
): WeaponTarget | undefined {
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (t?.alive && circlesOverlap(x, y, r, t.x, t.y, t.radius)) return t;
  }
  return undefined;
}
