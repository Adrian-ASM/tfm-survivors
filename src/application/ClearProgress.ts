import { EMPTY_PROGRESS } from '../domain/progress/Progress';
import type { ProgressRepository } from './ProgressRepository';
import type { ProgressSession } from './ProgressSession';

/** Resultado del borrado: `failed` si el almacenamiento lanzó al borrar (lo guardado no cambia). */
export interface ClearedProgress {
  readonly outcome: 'cleared' | 'failed';
}

/**
 * Caso de uso: borrar el progreso tras confirmar `Borrar datos` (spec progress-persistence,
 * "Borrado del progreso"). El progreso en uso queda vacío siempre y el aviso de datos dañados se
 * descarta. Sin almacenamiento (`unavailable`) no queda nada del jugador: cuenta como borrado.
 * Cancelar no llega aquí, así que no hay escrituras ni borrados por construcción.
 */
export class ClearProgress {
  constructor(
    private readonly session: ProgressSession,
    private readonly repository: ProgressRepository,
  ) {}

  execute(): ClearedProgress {
    const cleared = this.repository.clear();
    this.session.progress = EMPTY_PROGRESS;
    this.session.persistent = cleared.ok;
    this.session.corruptPending = false;
    const failed = !cleared.ok && cleared.error.code === 'failed';
    return { outcome: failed ? 'failed' : 'cleared' };
  }
}
