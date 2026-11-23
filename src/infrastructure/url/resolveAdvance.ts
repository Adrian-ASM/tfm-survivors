import { resolveManual } from './resolveManual';
import { resolveSpeed } from './resolveSpeed';

export interface ResolvedAdvance {
  readonly manual: boolean;
  /** Velocidad de simulación en tiempo real; 1 con el modo manual. */
  readonly speed: number;
  /** Avisos de `manual` y de `speed`, como mucho uno de cada. Para consola, nunca para HTML. */
  readonly warnings: readonly string[];
}

/**
 * Cómo avanza la partida en esta carga (spec simulation-loop, "Velocidad de simulación en modo
 * E2E"): manual > speed. Con el modo manual activo `speed` no se valida (ni avisa) y vale 1; si
 * no, sale de `resolveSpeed` sin cambios. No escribe en consola: decide la composición.
 */
export function resolveAdvance(search: string): ResolvedAdvance {
  const manual = resolveManual(search);
  if (manual.manual) return { manual: true, speed: 1, warnings: [] };
  const speed = resolveSpeed(search);
  const warnings = [manual.warning, speed.warning].filter((w): w is string => w !== undefined);
  return { manual: false, speed: speed.speed, warnings };
}
