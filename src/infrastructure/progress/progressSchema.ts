import { z } from 'zod';
import { HISTORY_LIMIT } from '../../domain/progress/Progress';

/** Única versión del documento de progreso (ADR-0010). */
export const PROGRESS_SCHEMA_VERSION = 1;

/** Mayor semilla de 32 bits sin signo. */
const MAX_SEED = 4_294_967_295;

/** Entero finito en [0, 2⁵³ − 1]: `z.int()` rechaza decimales e `Infinity` (p. ej. de `1e400`). */
const count = () => z.int().min(0).max(Number.MAX_SAFE_INTEGER);

const RecordsSchema = z.strictObject({
  bestTimeSeconds: count(),
  bestLevel: count(),
  maxKills: count(),
});

const HistoryEntrySchema = z.strictObject({
  playedAt: count(),
  seed: z.int().min(0).max(MAX_SEED),
  outcome: z.enum(['victory', 'defeat']),
  timeSeconds: count(),
  level: count().min(1),
  kills: count(),
});

/**
 * Documento v1 del progreso (spec progress-persistence, "Validación del progreso"): mismo formato
 * para el valor guardado y el fichero exportado. Estricto en todos los niveles: un campo extra,
 * también un `__proto__` propio de `JSON.parse`, lo invalida.
 */
export const ProgressDocumentSchema = z.strictObject({
  schemaVersion: z.literal(PROGRESS_SCHEMA_VERSION),
  records: RecordsSchema,
  history: z.array(HistoryEntrySchema).max(HISTORY_LIMIT),
});

export type ProgressDocument = z.infer<typeof ProgressDocumentSchema>;
