import type {
  ProgressClearError,
  ProgressLoadError,
  ProgressRepository,
  ProgressSaveError,
} from '../../src/application/ProgressRepository';
import type { Progress } from '../../src/domain/progress/Progress';
import { err, ok, type Result } from '../../src/domain/shared/Result';

/** Almacenamiento compartido por varias instancias del fake (simula recargar la página). */
export interface ProgressCell {
  value: Progress | null;
}

/**
 * Fake del puerto `ProgressRepository` (design 0007 y 0009): guarda en memoria, cuenta escrituras
 * y borrados correctos e intentos, y permite programar fallos de lectura, escritura y borrado.
 */
export class InMemoryProgressRepository implements ProgressRepository {
  writes = 0;
  saveAttempts = 0;
  clears = 0;
  clearAttempts = 0;
  loadError: ProgressLoadError | null = null;
  saveError: ProgressSaveError | null = null;
  clearError: ProgressClearError | null = null;

  constructor(readonly cell: ProgressCell = { value: null }) {}

  static with(value: Progress): InMemoryProgressRepository {
    return new InMemoryProgressRepository({ value });
  }

  get stored(): Progress | null {
    return this.cell.value;
  }

  load(): Result<Progress | null, ProgressLoadError> {
    return this.loadError ? err(this.loadError) : ok(this.cell.value);
  }

  save(progress: Progress): Result<void, ProgressSaveError> {
    this.saveAttempts += 1;
    if (this.saveError) return err(this.saveError);
    this.cell.value = progress;
    this.writes += 1;
    return ok(undefined);
  }

  clear(): Result<void, ProgressClearError> {
    this.clearAttempts += 1;
    if (this.clearError) return err(this.clearError);
    this.cell.value = null;
    this.clears += 1;
    return ok(undefined);
  }
}
