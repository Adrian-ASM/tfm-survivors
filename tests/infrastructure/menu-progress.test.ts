import { describe, expect, it } from 'vitest';
import { ClearProgress } from '../../src/application/ClearProgress';
import { ImportProgress } from '../../src/application/ImportProgress';
import type { ProgressSession } from '../../src/application/ProgressSession';
import { RecordRun } from '../../src/application/RecordRun';
import { normalizeHistory } from '../../src/domain/progress/history';
import { EMPTY_PROGRESS, type Progress } from '../../src/domain/progress/Progress';
import { MENU_MESSAGES } from '../../src/infrastructure/dom/menuText';
import { PANEL_MESSAGES } from '../../src/infrastructure/dom/resultsPanelText';
import { MenuProgress } from '../../src/infrastructure/progress/MenuProgress';
import { decodeProgress, encodeProgress } from '../../src/infrastructure/progress/progressCodec';
import { ResultsProgress } from '../../src/infrastructure/progress/ResultsProgress';
import { FixedClock } from '../support/FixedClock';
import { InMemoryProgressRepository } from '../support/InMemoryProgressRepository';
import { aRunSource, overAt } from '../support/finishedRuns';
import { aProgress, anEntry, entriesAt, records } from '../support/progress';

const G = (): Progress => aProgress(records(300, 8, 120), normalizeHistory(entriesAt(1, 2, 3)));

function presenters(progress: Progress = G()) {
  const repo = InMemoryProgressRepository.with(progress);
  const session: ProgressSession = { progress, persistent: true, corruptPending: false };
  const importer = new ImportProgress(session, repo);
  const menu = new MenuProgress(session, importer, new ClearProgress(session, repo));
  const results = new ResultsProgress(
    session,
    new RecordRun(session, repo, new FixedClock(), () => 42),
    importer,
  );
  return { menu, results, repo, session };
}

const fileOf = (text: string): File => new File([text], 'progress.json');
const fileRecords = (r: Progress['records']) =>
  fileOf(encodeProgress(aProgress(r, normalizeHistory([anEntry({ playedAt: 7 })]))));

describe('MenuProgress (spec main-menu y progress-persistence)', () => {
  it('sin acciones no muestra mensaje', () => {
    expect(presenters().menu.view).toStrictEqual({ message: null });
  });

  it('Scenario: Importar desde el menú ((300, 8, 120) + (250, 10, 90) ⇒ importado y fusión)', async () => {
    const { menu, session, repo } = presenters();

    const view = await menu.importFile(fileRecords(records(250, 10, 90)));

    expect(view.message).toContain('importado');
    expect([session.progress.records, repo.stored?.records]).toStrictEqual([
      records(300, 10, 120),
      records(300, 10, 120),
    ]);
  });

  it('Scenario: Import rechazado desde el menú (hola ⇒ no válido; 65.537 B ⇒ 64 KiB; sin cambios)', async () => {
    const { menu, session, repo } = presenters();

    const invalid = await menu.importFile(fileOf('hola'));
    const tooLarge = await menu.importFile(fileOf(' '.repeat(65_537)));

    expect(invalid.message).toContain('no válido');
    expect(tooLarge.message).toContain('64 KiB');
    expect([session.progress, repo.stored, repo.writes]).toStrictEqual([G(), G(), 0]);
  });

  it('usa los mismos textos de import que el overlay de resultados', () => {
    expect([MENU_MESSAGES.imported, MENU_MESSAGES.invalid, MENU_MESSAGES['too-large']]).toEqual([
      PANEL_MESSAGES.imported,
      PANEL_MESSAGES.invalid,
      PANEL_MESSAGES['too-large'],
    ]);
  });

  it('Scenario: Confirmar borra (mensaje con borrado y export vacío)', () => {
    const { menu } = presenters();

    const view = menu.clear();

    expect(view.message).toContain('borrado');
    expect(decodeProgress(menu.exportText())).toStrictEqual({ ok: true, value: EMPTY_PROGRESS });
  });

  it('Scenario: Fallo al borrar (mensaje con no se ha podido borrar y sin borrado)', () => {
    const { menu, repo } = presenters();
    repo.clearError = { code: 'failed' };

    const view = menu.clear();

    expect(view.message).toContain('no se ha podido borrar');
    expect(view.message).not.toContain('borrado');
  });

  it('Scenario: Exportar desde el menú (exportText es el progreso en uso)', () => {
    const { menu } = presenters();

    expect(decodeProgress(menu.exportText())).toStrictEqual({ ok: true, value: G() });
  });

  it('Scenario: Importar tras borrar (en uso y guardado = F normalizado)', async () => {
    const { menu, session, repo } = presenters();
    const F = aProgress(records(250, 10, 90), normalizeHistory([anEntry({ playedAt: 7 })]));
    menu.clear();

    await menu.importFile(fileOf(encodeProgress(F)));

    expect([session.progress, repo.stored]).toStrictEqual([F, F]);
  });

  it('reset() borra el mensaje', async () => {
    const { menu } = presenters();
    await menu.importFile(fileOf('hola'));

    menu.reset();

    expect(menu.view).toStrictEqual({ message: null });
  });

  it('Scenario: Mensajes del menú que no pasan al overlay', async () => {
    const { menu, results } = presenters();
    await menu.importFile(fileRecords(records(250, 10, 90)));
    await menu.importFile(fileOf('hola'));
    menu.clear();
    const over = overAt(1259, 3, 41);

    const view = results.sync(over, aRunSource(over));

    expect(view?.message).toBeNull();
  });

  it('Scenario: Mensajes del overlay que no pasan al menú', async () => {
    const { menu, results } = presenters();
    const over = overAt(1259, 3, 41);
    results.sync(over, aRunSource(over));
    await results.importFile(fileOf('hola'));

    expect(menu.view).toStrictEqual({ message: null });
  });
});
