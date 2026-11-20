import type { Progress } from '../../domain/progress/Progress';
import { err, type Result } from '../../domain/shared/Result';
import { decodeProgress, type ProgressDecodeError } from './progressCodec';

/** Tamaño máximo del fichero importado: 64 KiB (spec progress-persistence). */
export const MAX_IMPORT_BYTES = 64 * 1024;

/** Fichero rechazado: demasiado grande (sin leerlo) o contenido no válido. */
export type ImportFileError = { readonly code: 'too-large' } | ProgressDecodeError;

/**
 * Lee y valida un fichero elegido por el jugador (entrada no confiable, ADR-0004): el tamaño se
 * comprueba antes de leer el contenido; después, `decodeProgress`.
 */
export async function readProgressFile(
  file: Pick<Blob, 'size' | 'text'>,
): Promise<Result<Progress, ImportFileError>> {
  if (file.size > MAX_IMPORT_BYTES) return err({ code: 'too-large' });
  return decodeProgress(await file.text());
}
