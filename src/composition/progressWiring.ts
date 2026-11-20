import { ClearProgress } from '../application/ClearProgress';
import { ImportProgress } from '../application/ImportProgress';
import { LoadProgress } from '../application/LoadProgress';
import { RecordRun } from '../application/RecordRun';
import type { HistoryEntry, Records } from '../domain/progress/Progress';
import { downloadProgress } from '../infrastructure/dom/downloadProgress';
import { MenuPanel } from '../infrastructure/dom/MenuPanel';
import { ResultsPanel } from '../infrastructure/dom/ResultsPanel';
import { PROGRESS_CORRUPT_WARNING } from '../infrastructure/dom/resultsPanelText';
import { MenuController } from '../infrastructure/menu/MenuController';
import type { SceneProgress } from '../infrastructure/phaser/GameScene';
import type { MenuView } from '../infrastructure/phaser/MenuScene';
import { LocalStorageProgressRepository } from '../infrastructure/progress/LocalStorageProgressRepository';
import { MenuProgress } from '../infrastructure/progress/MenuProgress';
import { ResultsProgress } from '../infrastructure/progress/ResultsProgress';
import { SystemClock } from '../infrastructure/time/SystemClock';

/** Progreso en uso y lo que muestra el panel (probe de E2E; `shown` null si está oculto). */
export interface ProgressProbe {
  readonly records: Records;
  readonly history: readonly HistoryEntry[];
  readonly shown: readonly string[] | null;
  readonly message: string | null;
  readonly notices: readonly string[];
}

export interface ProgressWiring {
  readonly scene: SceneProgress;
  readonly menu: MenuView;
  probe(): ProgressProbe;
}

/**
 * Guardado local y export/import (design 0007): carga el progreso antes de crear el juego (nunca
 * lanza), avisa una vez por consola si los datos guardados estaban dañados y crea el panel DOM
 * sobre el canvas. `seedOf` da la semilla de la partida actual.
 */
export function wireProgress(root: HTMLElement, seedOf: () => number): ProgressWiring {
  const repository = new LocalStorageProgressRepository(() => window.localStorage);
  const { session, issue } = new LoadProgress(repository).execute();
  if (issue === 'corrupt') console.warn(PROGRESS_CORRUPT_WARNING);

  // Resultados y menú comparten sesión, repositorio e import; cada uno tiene su propio mensaje.
  const importProgress = new ImportProgress(session, repository);
  const results = new ResultsProgress(
    session,
    new RecordRun(session, repository, new SystemClock(), seedOf),
    importProgress,
  );
  const menuProgress = new MenuProgress(
    session,
    importProgress,
    new ClearProgress(session, repository),
  );
  const panel = new ResultsPanel(document, root, {
    onExport: () => {
      downloadProgress(results.exportText());
    },
    onImport: (file) => {
      void results.importFile(file).then((view) => {
        panel.render(view);
      });
    },
  });

  const controller = new MenuController();
  const menuPanel = new MenuPanel(document, root, controller, {
    onExport: () => {
      downloadProgress(menuProgress.exportText());
    },
    onImport: (file) => {
      void menuProgress.importFile(file).then((view) => {
        menuPanel.setMessage(view.message);
      });
    },
    onOpenConfirm: () => undefined,
  });

  return {
    menu: {
      show: () => {
        menuProgress.reset();
        menuPanel.show();
      },
      hide: () => {
        menuPanel.hide();
      },
      takePlay: () => controller.takePlay(),
    },
    scene: {
      sync: (snapshot, run) => {
        panel.render(results.sync(snapshot, run));
      },
      leave: () => {
        panel.render(null);
      },
    },
    probe: () => {
      const view = results.view;
      return {
        records: session.progress.records,
        history: session.progress.history,
        shown: view?.records ?? null,
        message: view?.message ?? null,
        notices: view?.notices ?? [],
      };
    },
  };
}
