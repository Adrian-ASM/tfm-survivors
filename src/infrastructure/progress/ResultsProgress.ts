import type { ImportProgress } from '../../application/ImportProgress';
import type { ProgressSession } from '../../application/ProgressSession';
import type { FinishedRunSource, RecordRun } from '../../application/RecordRun';
import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import {
  resultsPanelView,
  type PanelMessage,
  type ResultsPanelView,
} from '../dom/resultsPanelText';
import { encodeProgress } from './progressCodec';
import { readProgressFile } from './readProgressFile';

/**
 * Presentador del panel de progreso del overlay de resultados (design 0007, sin DOM). En cada
 * frame `sync` registra la partida terminada (idempotente) y da la vista; al empezar a mostrar una
 * partida nueva borra el mensaje del import anterior. Fuera de `over` la vista es `null`.
 */
export class ResultsProgress {
  private current: ResultsPanelView | null = null;
  private corrupt = false;
  private message: PanelMessage | null = null;

  constructor(
    private readonly session: ProgressSession,
    private readonly recordRun: RecordRun,
    private readonly importProgress: ImportProgress,
  ) {}

  get view(): ResultsPanelView | null {
    return this.current;
  }

  /** Vista del frame: la misma referencia mientras no cambie (el panel solo repinta si cambia). */
  sync(snapshot: RunSnapshot, run: FinishedRunSource): ResultsPanelView | null {
    if (snapshot.status !== 'over') {
      this.current = null;
      return null;
    }
    const recorded = this.recordRun.execute(run);
    if (recorded.ok) {
      this.corrupt = recorded.value.corrupt;
      this.message = null;
      this.refresh();
    } else if (this.current === null) {
      this.refresh();
    }
    return this.current;
  }

  /** Import desde el panel. Un fichero rechazado solo cambia el mensaje. */
  async importFile(file: Pick<Blob, 'size' | 'text'>): Promise<ResultsPanelView | null> {
    const read = await readProgressFile(file);
    if (read.ok) this.importProgress.execute(read.value);
    this.message = read.ok ? 'imported' : read.error.code === 'too-large' ? 'too-large' : 'invalid';
    if (this.current !== null) this.refresh();
    return this.current;
  }

  /** Documento v1 del progreso en uso (solo lectura). */
  exportText(): string {
    return encodeProgress(this.session.progress);
  }

  private refresh(): void {
    const flags = { persistent: this.session.persistent, corrupt: this.corrupt };
    this.current = resultsPanelView(this.session.progress, flags, this.message);
  }
}
