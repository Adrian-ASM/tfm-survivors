/** Círculo que puede hacer daño por contacto (`Enemy` lo cumple de forma estructural). */
export interface ContactTarget {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly damage: number;
}

/**
 * ¿Se solapan dos círculos? Estricto (spec player-health): la tangencia no es contacto. Compara con
 * cuadrados, sin raíz, así que la frontera es exacta.
 */
export function circlesOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const reach = ar + br;
  return dx * dx + dy * dy < reach * reach;
}

/**
 * Mayor `damage` entre los objetivos que solapan el círculo (px, py, pr); 0 si ninguno.
 * Fuerza bruta O(n), sin asignaciones y sin salida anticipada: el máximo no depende del orden.
 * Una rejilla espacial (0004) podrá ofrecer la misma firma sobre los candidatos de una celda.
 */
export function contactDamage(
  px: number,
  py: number,
  pr: number,
  targets: readonly ContactTarget[],
): number {
  let max = 0;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (t && t.damage > max && circlesOverlap(px, py, pr, t.x, t.y, t.radius)) max = t.damage;
  }
  return max;
}
