import { describe, expect, it } from 'vitest';
import { ClearProgress } from '../../src/application/ClearProgress';
import type { ProgressSession } from '../../src/application/ProgressSession';
import { normalizeHistory } from '../../src/domain/progress/history';
import { EMPTY_PROGRESS, type Progress } from '../../src/domain/progress/Progress';
import { InMemoryProgressRepository } from '../support/InMemoryProgressRepository';
import { aProgress, entriesAt, records } from '../support/progress';

const G = (): Progress => aProgress(records(300, 8, 120), normalizeHistory(entriesAt(1, 2, 3)));

const session = (progress: Progress, corruptPending = false): ProgressSession => ({
  progress,
  persistent: true,
  corruptPending,
});

describe('ClearProgress (spec progress-persistence, "Borrado del progreso")', () => {
  it('Scenario: Borrado confirmado ((300, 8, 120) y 3 entradas ⇒ vacío, persistente, cleared)', () => {
    const s = session(G());
    const repo = InMemoryProgressRepository.with(G());

    const result = new ClearProgress(s, repo).execute();

    expect(result).toStrictEqual({ outcome: 'cleared' });
    expect(s).toStrictEqual({ progress: EMPTY_PROGRESS, persistent: true, corruptPending: false });
    expect([repo.stored, repo.clears, repo.writes]).toStrictEqual([null, 1, 0]);
  });

  it('Scenario: Borrar datos dañados (corruptPending pasa a false)', () => {
    const s = session(EMPTY_PROGRESS, true);

    new ClearProgress(s, new InMemoryProgressRepository()).execute();

    expect(s.corruptPending).toBe(false);
  });

  it('Scenario: Borrar sin almacenamiento (unavailable ⇒ sesión vacía, no persistente, cleared)', () => {
    const s = session(G());
    const repo = new InMemoryProgressRepository();
    repo.clearError = { code: 'unavailable' };

    const result = new ClearProgress(s, repo).execute();

    expect(result).toStrictEqual({ outcome: 'cleared' });
    expect(s).toStrictEqual({ progress: EMPTY_PROGRESS, persistent: false, corruptPending: false });
  });

  it('Scenario: Fallo al borrar (failed ⇒ sesión vacía, guardado intacto, failed)', () => {
    const s = session(G(), true);
    const repo = InMemoryProgressRepository.with(G());
    repo.clearError = { code: 'failed' };

    const result = new ClearProgress(s, repo).execute();

    expect(result).toStrictEqual({ outcome: 'failed' });
    expect(s).toStrictEqual({ progress: EMPTY_PROGRESS, persistent: false, corruptPending: false });
    expect(repo.stored).toStrictEqual(G());
  });

  it('Scenario: Borrar el progreso vacío (dos execute seguidos dan cleared las dos veces)', () => {
    const s = session(EMPTY_PROGRESS);
    const clear = new ClearProgress(s, new InMemoryProgressRepository());

    expect([clear.execute(), clear.execute()]).toStrictEqual([
      { outcome: 'cleared' },
      { outcome: 'cleared' },
    ]);
    expect(s.progress).toStrictEqual(EMPTY_PROGRESS);
  });
});
