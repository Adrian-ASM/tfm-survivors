import { z } from 'zod';

/** Mayor semilla admitida: entero sin signo de 32 bits (spec simulation-loop). */
export const MAX_SEED = 4294967295;

/** Longitud máxima del valor crudo que se repite en el aviso (entrada externa, solo para consola). */
const MAX_ECHO = 32;

const SeedSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(0).max(MAX_SEED));

export interface ResolvedSeed {
  readonly seed: number;
  /** Presente solo si `?seed` venía pero no era válido. Mensaje para consola, nunca para HTML. */
  readonly warning?: string;
}

/**
 * Resuelve la semilla de la partida desde la query string (entrada externa validada con zod).
 * `fallback` da una semilla aleatoria y solo se invoca si `?seed` falta o es inválido.
 * No escribe en consola: la composición decide qué hacer con el aviso.
 */
export function resolveSeed(search: string, fallback: () => number): ResolvedSeed {
  const raw = new URLSearchParams(search).get('seed');
  if (raw === null) return { seed: fallback() >>> 0 };
  const parsed = SeedSchema.safeParse(raw);
  if (parsed.success) return { seed: parsed.data };
  const echo = JSON.stringify(raw.slice(0, MAX_ECHO));
  return {
    seed: fallback() >>> 0,
    warning: `Parámetro seed inválido (${echo}): se usa una semilla aleatoria.`,
  };
}
