import { mergeProgress } from '../domain/progress/mergeProgress';
import type { Progress } from '../domain/progress/Progress';
import type { ProgressRepository } from './ProgressRepository';
import type { ProgressSession } from './ProgressSession';

/** Resultado del import: progreso fusionado en uso y si se pudo guardar. */
export interface ImportedProgress {
  readonly progress: Progress;
  readonly saved: boolean;
}

/**
 * Caso de uso: fusionar un progreso importado ya validado con el que está en uso (spec
 * progress-persistence, "Import con fusión"), usarlo y guardarlo (sobrescribe datos dañados). Un
 * fichero rechazado no llega aquí, así que lo guardado no cambia por construcción.
 */
export class ImportProgress {
  constructor(
    private readonly session: ProgressSession,
    private readonly repository: ProgressRepository,
  ) {}

  execute(imported: Progress): ImportedProgress {
    const progress = mergeProgress(this.session.progress, imported);
    const saved = this.repository.save(progress).ok;
    this.session.progress = progress;
    this.session.persistent = saved;
    this.session.corruptPending = false;
    return { progress, saved };
  }
}
