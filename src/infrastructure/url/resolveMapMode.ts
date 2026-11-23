import { z } from 'zod';

/** Longitud máxima del valor que se repite en el aviso (entrada externa, solo para consola). */
const MAX_ECHO = 32;

/** Único valor admitido: `?e2e&map=empty` fuerza el mapa vacío. */
const MapSchema = z.literal('empty');

export interface ResolvedMapMode {
  readonly emptyForced: boolean;
  /** Solo si `?e2e&map` venía con un valor no admitido. Para consola, nunca para HTML. */
  readonly warning?: string;
}

/**
 * Resuelve si se fuerza el mapa vacío desde la query string (spec procedural-map, "Mapa vacío en
 * modo E2E"; entrada externa validada con zod). Sin `?e2e`, `map` se ignora sin avisos. No escribe
 * en consola: la composición decide qué hacer con el aviso.
 */
export function resolveMapMode(search: string): ResolvedMapMode {
  const params = new URLSearchParams(search);
  if (!params.has('e2e')) return { emptyForced: false };
  const raw = params.get('map');
  if (raw === null) return { emptyForced: false };
  if (MapSchema.safeParse(raw).success) return { emptyForced: true };
  const echo = JSON.stringify(raw.slice(0, MAX_ECHO));
  return {
    emptyForced: false,
    warning: `Parámetro map inválido (${echo}): la partida usa el mapa generado por la semilla.`,
  };
}
