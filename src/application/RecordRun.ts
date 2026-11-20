import type { HistoryEntry, Progress } from '../domain/progress/Progress';
import { recordEntry } from '../domain/progress/recordEntry';
import type { Clock } from '../domain/shared/Clock';
import { err, ok, type Result } from '../domain/shared/Result';
import { survivedSeconds } from '../domain/shared/Tick';
import type { ProgressRepository } from './ProgressRepository';
import type { ProgressSession } from './ProgressSession';
import type { TickRun } from './TickRun';

/** Lo que `RecordRun` lee de una partida: `TickRun` lo cumple; los tests pasan un doble. */
export type FinishedRunSource = Pick<TickRun, 'status' | 'snapshot'>;

/** Partida registrada: progreso en uso, si se pudo guardar y si hay que avisar de datos dañados. */
export interface RecordedRun {
  readonly progress: Progress;
  readonly saved: boolean;
  readonly corrupt: boolean;
}

/** La partida no ha terminado, o esa misma partida ya se registró. */
export interface RecordRunError {
  readonly code: 'not-over' | 'already-recorded';
}

/**
 * Caso de uso: registrar y guardar una partida terminada exactamente una vez (spec
 * progress-persistence). Se llama en cada frame; solo la primera llamada en `over` de cada partida
 * lee su snapshot y escribe. La sesión se actualiza siempre, aunque el guardado falle (el progreso
 * sigue en memoria). La composición decide la semilla de la partida actual con `seedOf`.
 */
export class RecordRun {
  private last: FinishedRunSource | null = null;

  constructor(
    private readonly session: ProgressSession,
    private readonly repository: ProgressRepository,
    private readonly clock: Clock,
    private readonly seedOf: () => number,
  ) {}

  execute(run: FinishedRunSource): Result<RecordedRun, RecordRunError> {
    if (run.status !== 'over') return err({ code: 'not-over' });
    if (run === this.last) return err({ code: 'already-recorded' });
    const snapshot = run.snapshot();
    if (snapshot.status !== 'over') return err({ code: 'not-over' });
    this.last = run;

    const entry: HistoryEntry = {
      playedAt: this.clock.nowMs(),
      seed: this.seedOf(),
      outcome: snapshot.outcome,
      timeSeconds: survivedSeconds(snapshot.tick),
      level: snapshot.progression.level,
      kills: snapshot.kills,
    };
    const progress = recordEntry(this.session.progress, entry);
    const saved = this.repository.save(progress).ok;
    const corrupt = this.session.corruptPending;
    this.session.progress = progress;
    this.session.persistent = saved;
    this.session.corruptPending = false;
    return ok({ progress, saved, corrupt });
  }
}
