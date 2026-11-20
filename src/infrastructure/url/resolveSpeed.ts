import { z } from 'zod';

/**
 * Mayor velocidad de simulación admitida en modo E2E (spec simulation-loop). Configuración de
 * pruebas, no contenido de juego: acota el coste por frame (15 avances del bucle de paso fijo).
 */
export const MAX_SIM_SPEED = 15;

/** Longitud máxima del valor crudo que se repite en el aviso (entrada externa, solo para consola). */
const MAX_ECHO = 32;

const SpeedSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(MAX_SIM_SPEED));

export interface ResolvedSpeed {
  readonly speed: number;
  /** Presente solo si `?e2e&speed` venía pero no era válido. Mensaje para consola, nunca para HTML. */
  readonly warning?: string;
}

/**
 * Resuelve la velocidad de simulación desde la query string (entrada externa validada con zod).
 * Sin `?e2e`, `speed` se ignora por completo y sin avisos: el jugador siempre juega a velocidad 1.
 * No escribe en consola: la composición decide qué hacer con el aviso.
 */
export function resolveSpeed(search: string): ResolvedSpeed {
  const params = new URLSearchParams(search);
  if (!params.has('e2e')) return { speed: 1 };
  const raw = params.get('speed');
  if (raw === null) return { speed: 1 };
  const parsed = SpeedSchema.safeParse(raw);
  if (parsed.success) return { speed: parsed.data };
  const echo = JSON.stringify(raw.slice(0, MAX_ECHO));
  return {
    speed: 1,
    warning: `Parámetro speed inválido (${echo}): se usa la velocidad 1.`,
  };
}
