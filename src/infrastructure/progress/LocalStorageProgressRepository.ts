import type {
  ProgressLoadError,
  ProgressRepository,
  ProgressSaveError,
} from '../../application/ProgressRepository';
import type { Progress } from '../../domain/progress/Progress';
import { err, ok, type Result } from '../../domain/shared/Result';
import { decodeProgress, encodeProgress } from './progressCodec';

/** Clave con espacio de nombres: GitHub Pages comparte el origen entre repos (ADR-0010). */
export const PROGRESS_STORAGE_KEY = 'sprint-survivors/progress';

export type ProgressStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Adaptador de `ProgressRepository` sobre `localStorage`. Recibe una función porque acceder a
 * `window.localStorage` ya puede lanzar `SecurityError`.
 */
export class LocalStorageProgressRepository implements ProgressRepository {
  constructor(
    private readonly storage: () => ProgressStorage,
    private readonly key: string = PROGRESS_STORAGE_KEY,
  ) {}

  /** Nunca lanza: excepción al acceder o leer ⇒ `unavailable`; valor dañado ⇒ `corrupt`, intacto. */
  load(): Result<Progress | null, ProgressLoadError> {
    let text: string | null;
    try {
      text = this.storage().getItem(this.key);
    } catch {
      return err({ code: 'unavailable' });
    }
    if (text === null) return ok(null);
    const decoded = decodeProgress(text);
    return decoded.ok ? decoded : err({ code: 'corrupt', reason: decoded.error.message });
  }

  /** Nunca lanza: cuota superada ⇒ `quota-exceeded`; cualquier otra excepción ⇒ `unavailable`. */
  save(progress: Progress): Result<void, ProgressSaveError> {
    try {
      this.storage().setItem(this.key, encodeProgress(progress));
      return ok(undefined);
    } catch (e) {
      return err({ code: isQuotaExceeded(e) ? 'quota-exceeded' : 'unavailable' });
    }
  }
}

/** Nombres de la excepción de cuota (estándar y el antiguo de Firefox). */
const QUOTA_NAMES = new Set(['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED']);

const isQuotaExceeded = (e: unknown): boolean =>
  e instanceof DOMException && QUOTA_NAMES.has(e.name);
