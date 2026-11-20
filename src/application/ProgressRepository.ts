import type { Progress } from '../domain/progress/Progress';
import type { Result } from '../domain/shared/Result';

/** Fallo al leer: almacenamiento no disponible o valor guardado dañado (no JSON, esquema, versión). */
export type ProgressLoadError =
  { readonly code: 'unavailable' } | { readonly code: 'corrupt'; readonly reason: string };

/** Fallo al escribir: almacenamiento no disponible o lleno. */
export interface ProgressSaveError {
  readonly code: 'unavailable' | 'quota-exceeded';
}

/**
 * Puerto de persistencia del progreso (ADR-0010: síncrono). Nunca lanza: todo fallo es un
 * `Result`. `load` da `ok(null)` si no hay nada guardado. Implementaciones:
 * `LocalStorageProgressRepository` (infraestructura) y el fake de los tests.
 */
export interface ProgressRepository {
  load(): Result<Progress | null, ProgressLoadError>;
  save(progress: Progress): Result<void, ProgressSaveError>;
}
