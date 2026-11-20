import type {
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
 * Fake del puerto `ProgressRepository` (design 0007): guarda en memoria, cuenta escrituras
 * correctas e intentos, y permite programar fallos de lectura y de escritura.
 */
export class InMemoryProgressRepository implements ProgressRepository {
  writes = 0;
  saveAttempts = 0;
  loadError: ProgressLoadError | null = null;
  saveError: ProgressSaveError | null = null;

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
}
