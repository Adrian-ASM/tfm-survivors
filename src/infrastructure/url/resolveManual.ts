import { z } from 'zod';

/** Longitud máxima del valor que se repite en el aviso (entrada externa, solo para consola). */
const MAX_ECHO = 32;

/** `?e2e&manual`, `?e2e&manual=`, `?e2e&manual=1` y `?e2e&manual=true` activan el modo manual. */
const ManualSchema = z.enum(['', '1', 'true']);

export interface ResolvedManual {
  readonly manual: boolean;
  /** Solo si `?e2e&manual` venía con un valor no admitido. Para consola, nunca para HTML. */
  readonly warning?: string;
}

/**
 * Resuelve el modo de avance manual desde la query string (entrada externa validada con zod).
 * Sin `?e2e`, `manual` se ignora por completo y sin avisos: el jugador nunca lo activa.
 * No escribe en consola: la composición decide qué hacer con el aviso.
 */
export function resolveManual(search: string): ResolvedManual {
  const params = new URLSearchParams(search);
  if (!params.has('e2e')) return { manual: false };
  const raw = params.get('manual');
  if (raw === null) return { manual: false };
  if (ManualSchema.safeParse(raw).success) return { manual: true };
  const echo = JSON.stringify(raw.slice(0, MAX_ECHO));
  return {
    manual: false,
    warning: `Parámetro manual inválido (${echo}): la partida avanza en tiempo real.`,
  };
}
