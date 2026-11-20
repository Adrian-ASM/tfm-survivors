import { EMPTY_PROGRESS } from '../domain/progress/Progress';
import type { ProgressRepository } from './ProgressRepository';
import type { ProgressSession } from './ProgressSession';

/** Problema al cargar, para que la composición avise (solo `corrupt` va a la consola). */
export type LoadIssue = 'corrupt' | 'unavailable' | null;

export interface LoadedProgress {
  readonly session: ProgressSession;
  readonly issue: LoadIssue;
}

/**
 * Caso de uso: leer el progreso guardado al cargar la página (spec progress-persistence). Nada
 * guardado ⇒ vacío sin aviso; dañado ⇒ vacío y aviso pendiente, sin escribir nada (se sobrescribe
 * en el siguiente guardado); almacenamiento no disponible ⇒ vacío y sin persistencia.
 */
export class LoadProgress {
  constructor(private readonly repository: ProgressRepository) {}

  execute(): LoadedProgress {
    const loaded = this.repository.load();
    if (loaded.ok) {
      const progress = loaded.value ?? EMPTY_PROGRESS;
      return { session: { progress, persistent: true, corruptPending: false }, issue: null };
    }
    const corrupt = loaded.error.code === 'corrupt';
    return {
      session: { progress: EMPTY_PROGRESS, persistent: corrupt, corruptPending: corrupt },
      issue: loaded.error.code,
    };
  }
}
