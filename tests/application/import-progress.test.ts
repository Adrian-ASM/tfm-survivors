import { describe, expect, it } from 'vitest';
import { ImportProgress } from '../../src/application/ImportProgress';
import type { ProgressSession } from '../../src/application/ProgressSession';
import { normalizeHistory } from '../../src/domain/progress/history';
import { EMPTY_PROGRESS, type Progress } from '../../src/domain/progress/Progress';
import { InMemoryProgressRepository } from '../support/InMemoryProgressRepository';
import { aProgress, entriesAt, records } from '../support/progress';

const session = (progress: Progress, corruptPending = false): ProgressSession => ({
  progress,
  persistent: true,
  corruptPending,
});

const inUse = (): Progress => aProgress(records(300, 8, 120), normalizeHistory(entriesAt(1, 3)));
const file = (): Progress => aProgress(records(250, 10, 90), normalizeHistory(entriesAt(3, 2)));

describe('ImportProgress (spec progress-persistence, "Import con fusión")', () => {
  it('Scenario: Récords máximos ((300, 8, 120) + fichero (250, 10, 90) ⇒ (300, 10, 120))', () => {
    const s = session(inUse());
    const repo = new InMemoryProgressRepository();

    const imported = new ImportProgress(s, repo).execute(file());

    expect(imported.saved).toBe(true);
    expect(imported.progress.records).toStrictEqual(records(300, 10, 120));
    expect([s.progress, repo.stored]).toStrictEqual([imported.progress, imported.progress]);
  });

  it('Scenario: Importar dos veces el mismo fichero (el 2.º no cambia nada)', () => {
    const importer = new ImportProgress(session(inUse()), new InMemoryProgressRepository());

    const first = importer.execute(file());
    const second = importer.execute(file());

    expect(second.progress).toStrictEqual(first.progress);
  });

  it('Scenario: Import sobre datos guardados dañados (en uso y guardado = F normalizado)', () => {
    const s = session(EMPTY_PROGRESS, true);
    const repo = new InMemoryProgressRepository();
    const f = file();

    new ImportProgress(s, repo).execute(f);

    expect([s.progress, repo.stored]).toStrictEqual([f, f]);
    expect(s.corruptPending).toBe(false);
  });

  it('Scenario: Almacenamiento bloqueado (save falla ⇒ sesión fusionada, saved false)', () => {
    const s = session(inUse());
    const repo = new InMemoryProgressRepository();
    repo.saveError = { code: 'unavailable' };

    const imported = new ImportProgress(s, repo).execute(file());

    expect(imported.saved).toBe(false);
    expect(s.progress.records).toStrictEqual(records(300, 10, 120));
    expect([s.persistent, repo.stored]).toStrictEqual([false, null]);
  });
});
