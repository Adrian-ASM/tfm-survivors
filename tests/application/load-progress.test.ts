import { describe, expect, it } from 'vitest';
import { LoadProgress } from '../../src/application/LoadProgress';
import { normalizeHistory } from '../../src/domain/progress/history';
import { EMPTY_PROGRESS } from '../../src/domain/progress/Progress';
import { InMemoryProgressRepository } from '../support/InMemoryProgressRepository';
import { aProgress, anEntry, records } from '../support/progress';

describe('LoadProgress (spec progress-persistence, "Carga del progreso guardado")', () => {
  it('Scenario: Progreso vacío (nada guardado ⇒ vacío, sin aviso)', () => {
    const loaded = new LoadProgress(new InMemoryProgressRepository()).execute();

    expect(loaded.issue).toBeNull();
    expect(loaded.session).toStrictEqual({
      progress: EMPTY_PROGRESS,
      persistent: true,
      corruptPending: false,
    });
  });

  it('Scenario: Recarga tras una partida (válido ⇒ ese progreso)', () => {
    const saved = aProgress(records(20, 3, 41), normalizeHistory([anEntry()]));

    const loaded = new LoadProgress(InMemoryProgressRepository.with(saved)).execute();

    expect(loaded.issue).toBeNull();
    expect(loaded.session.progress).toStrictEqual(saved);
  });

  it('Scenario: Datos guardados dañados (vacío, aviso y sin escribir nada)', () => {
    const repo = new InMemoryProgressRepository();
    repo.loadError = { code: 'corrupt', reason: 'JSON truncado' };

    const loaded = new LoadProgress(repo).execute();

    expect(loaded.issue).toBe('corrupt');
    expect(loaded.session).toStrictEqual({
      progress: EMPTY_PROGRESS,
      persistent: true,
      corruptPending: true,
    });
    expect(repo.saveAttempts).toBe(0);
  });

  it('Scenario: Versión futura guardada (se trata como dañado: vacío y sin escribir)', () => {
    const repo = new InMemoryProgressRepository();
    repo.loadError = { code: 'corrupt', reason: 'schemaVersion 2' };

    const loaded = new LoadProgress(repo).execute();

    expect([loaded.issue, loaded.session.progress, repo.saveAttempts]).toStrictEqual([
      'corrupt',
      EMPTY_PROGRESS,
      0,
    ]);
  });

  it('Scenario: Almacenamiento bloqueado (unavailable ⇒ vacío y sin persistencia)', () => {
    const repo = new InMemoryProgressRepository();
    repo.loadError = { code: 'unavailable' };

    const loaded = new LoadProgress(repo).execute();

    expect(loaded.issue).toBe('unavailable');
    expect(loaded.session).toStrictEqual({
      progress: EMPTY_PROGRESS,
      persistent: false,
      corruptPending: false,
    });
  });
});
