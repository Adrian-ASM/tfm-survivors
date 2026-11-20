import type { ClearProgress } from '../../application/ClearProgress';
import type { ImportProgress } from '../../application/ImportProgress';
import type { ProgressSession } from '../../application/ProgressSession';
import { MENU_MESSAGES, type MenuMessage } from '../dom/menuText';
import { importFromFile } from './importFromFile';
import { encodeProgress } from './progressCodec';

/** Lo que muestra el menú del progreso: solo el mensaje de la última acción. */
export interface MenuProgressView {
  readonly message: string | null;
}

/**
 * Presentador del progreso en el menú de inicio (design 0009, sin DOM). Comparte la sesión con
 * `ResultsProgress`, pero su mensaje es propio: los mensajes no pasan del menú al overlay ni al
 * revés (spec run-results). `reset` lo borra cada vez que se muestra el menú.
 */
export class MenuProgress {
  private current: MenuProgressView = { message: null };

  constructor(
    private readonly session: ProgressSession,
    private readonly importProgress: ImportProgress,
    private readonly clearProgress: ClearProgress,
  ) {}

  get view(): MenuProgressView {
    return this.current;
  }

  /** Documento v1 del progreso en uso (solo lectura). */
  exportText(): string {
    return encodeProgress(this.session.progress);
  }

  async importFile(file: Pick<Blob, 'size' | 'text'>): Promise<MenuProgressView> {
    return this.show(await importFromFile(file, this.importProgress));
  }

  /** Borrado ya confirmado en el diálogo. */
  clear(): MenuProgressView {
    const { outcome } = this.clearProgress.execute();
    return this.show(outcome === 'cleared' ? 'cleared' : 'clear-failed');
  }

  reset(): void {
    this.current = { message: null };
  }

  private show(message: MenuMessage): MenuProgressView {
    this.current = { message: MENU_MESSAGES[message] };
    return this.current;
  }
}
