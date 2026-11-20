import type { RunOutcome } from '../../domain/run/RunPhase';
import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import { survivedSeconds } from '../../domain/shared/Tick';
import { formatClock } from './hudFormat';

/** Indicación de reinicio del overlay (spec run-results). */
export const RESTART_HINT = 'Pulsa R para jugar otra vez';

const TITLES: Readonly<Record<RunOutcome, string>> = { won: 'Victoria', lost: 'Derrota' };

/** Lo que muestra el overlay de resultados (y lo que el probe de E2E expone). */
export interface ResultsView {
  readonly title: string;
  /** Tiempo sobrevivido, `mm:ss`. */
  readonly time: string;
  readonly level: number;
  readonly kills: number;
  readonly hint: string;
}

/** Tiempo sobrevivido (spec run-results): segundos completos ⌊tick / 60⌋ en `mm:ss`. */
export const survivedClock = (tick: number): string =>
  formatClock(survivedSeconds(tick));

/** Contenido del overlay, o `null` si la partida no ha terminado. */
export function resultsView(s: RunSnapshot): ResultsView | null {
  if (s.status !== 'over') return null;
  return {
    title: TITLES[s.outcome],
    time: survivedClock(s.tick),
    level: s.progression.level,
    kills: s.kills,
    hint: RESTART_HINT,
  };
}
