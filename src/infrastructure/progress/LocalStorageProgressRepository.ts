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

  load(): Result<Progress | null, ProgressLoadError> {
    const text = this.storage().getItem(this.key);
    if (text === null) return ok(null);
    const decoded = decodeProgress(text);
    return decoded.ok ? decoded : err({ code: 'corrupt', reason: decoded.error.message });
  }

  save(progress: Progress): Result<void, ProgressSaveError> {
    this.storage().setItem(this.key, encodeProgress(progress));
    return ok(undefined);
  }
}
