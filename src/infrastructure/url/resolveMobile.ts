import { z } from 'zod';

/** Longitud máxima del valor que se repite en el aviso (entrada externa, solo para consola). */
const MAX_ECHO = 32;

/** Valores admitidos de `?mobile`: `1` fuerza el modo móvil y `0` lo apaga (lista cerrada). */
const MobileParamSchema = z.enum(['1', '0']);

export interface ResolvedMobile {
  readonly on: boolean;
  /** Solo si `?mobile` venía con un valor no admitido. Para consola, nunca para HTML. */
  readonly warning?: string;
}

/**
 * Modo móvil de la carga (spec mobile-display, "Activación del modo móvil"; ADR-0029), en orden:
 * `?mobile=1|0` gana siempre; cualquier otro valor da 1 aviso y se sigue; `?e2e` apaga la
 * autodetección; si no, `coarse()` (la composición lo implementa con `(pointer: coarse)`). Se llama
 * una sola vez al cargar y `coarse` se lee como mucho una vez: un cambio posterior no cuenta.
 */
export function resolveMobile(search: string, coarse: () => boolean): ResolvedMobile {
  const params = new URLSearchParams(search);
  const raw = params.get('mobile');
  let warning: string | undefined;
  if (raw !== null) {
    const forced = MobileParamSchema.safeParse(raw);
    if (forced.success) return { on: forced.data === '1' };
    const echo = JSON.stringify(raw.slice(0, MAX_ECHO));
    warning = `Parámetro mobile inválido (${echo}): se usa la detección del puntero.`;
  }
  const on = params.has('e2e') ? false : coarse();
  return warning === undefined ? { on } : { on, warning };
}
