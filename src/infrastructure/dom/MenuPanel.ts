import type { MenuController } from '../menu/MenuController';
import { button, setPanelHidden } from './button';
import type { GuideModal } from './GuideModal';
import { MENU_LABELS } from './menuText';
import { pickedFile } from './pickedFile';
import type { SoundPanel } from './SoundPanel';

/** Acciones de progreso del menú (la composición las conecta a `MenuProgress`). */
export interface MenuPanelActions {
  onExport(): void;
  onImport(file: File): void;
  /** Borrar datos: el controlador ya ha abierto el diálogo de confirmación. */
  onOpenConfirm(): void;
}

/**
 * Panel DOM del menú de inicio (ADR-0011): Jugar, Cómo jugar, Sonido, Exportar, Importar y Borrar
 * datos, en ese orden, el selector de fichero oculto y el mensaje (`role="status"`). Cada clic pasa
 * por `MenuController`, que decide si tiene efecto. Cómo jugar abre la guía (0028) y Sonido el panel
 * de audio (0035), que recibe ya creados. Solo `textContent` y `addEventListener` (CSP).
 */
export class MenuPanel {
  private readonly root: HTMLElement;
  private readonly message: HTMLElement;
  private readonly buttons: HTMLButtonElement[];

  constructor(
    doc: Document,
    parent: HTMLElement,
    private readonly controller: MenuController,
    actions: MenuPanelActions,
    private readonly guide: GuideModal,
    private readonly sound: SoundPanel,
  ) {
    this.root = doc.createElement('section');
    this.root.className = 'menu-panel';
    this.root.setAttribute('aria-label', 'Menú de inicio');
    this.root.hidden = true;
    // Título en el mismo bloque que las opciones: centrados juntos por la rejilla CSS (0017, D11).
    const title = doc.createElement('h1');
    title.textContent = MENU_LABELS.title;
    this.message = doc.createElement('p');
    this.message.className = 'menu-panel__message';
    this.message.setAttribute('role', 'status');
    this.message.hidden = true;

    const file = doc.createElement('input');
    file.className = 'menu-panel__file';
    file.type = 'file';
    file.accept = '.json,application/json';
    file.hidden = true;
    file.addEventListener('change', () => {
      const chosen = pickedFile(file.files);
      file.value = '';
      if (chosen) actions.onImport(chosen);
    });

    // Al cerrar la guía: menú operativo y, el último paso, foco en Cómo jugar (un botón
    // `disabled` no recibe el foco).
    const guideButton = button(doc, MENU_LABELS.guide, () => {
      if (!controller.openGuide()) return;
      this.setLocked(true);
      guide.open(() => {
        controller.closeGuide();
        this.setLocked(false);
        guideButton.focus();
      });
    });
    // Sonido (0035): el panel cierra con Esc o Cerrar y el foco vuelve a este botón.
    const soundButton = button(doc, MENU_LABELS.sound, () => {
      if (!controller.openSound()) return;
      this.setLocked(true);
      sound.show(
        () => {
          controller.closeSound();
          this.setLocked(false);
          soundButton.focus();
        },
        { escCloses: true },
      );
    });
    this.buttons = [
      button(doc, MENU_LABELS.play, () => {
        if (controller.requestPlay()) this.hide();
      }),
      guideButton,
      soundButton,
      button(doc, MENU_LABELS.export, () => {
        if (controller.requestExport()) actions.onExport();
      }),
      button(doc, MENU_LABELS.import, () => {
        if (controller.requestImport()) file.click();
      }),
      button(doc, MENU_LABELS.clear, () => {
        if (controller.openConfirm()) actions.onOpenConfirm();
      }),
    ];
    const list = doc.createElement('div');
    list.className = 'menu-panel__actions';
    list.append(...this.buttons, file);
    this.root.append(title, list, this.message);
    parent.append(this.root);
  }

  /** Menú operativo, con la guía y el panel Sonido cerrados y sin mensajes heredados. */
  show(): void {
    this.guide.close();
    this.sound.close();
    this.controller.show();
    this.setMessage(null);
    this.setLocked(false);
    setPanelHidden(this.root, false);
  }

  hide(): void {
    this.setLocked(true);
    setPanelHidden(this.root, true);
  }

  setMessage(text: string | null): void {
    this.message.textContent = text ?? '';
    this.message.hidden = text === null;
  }

  /** Con el diálogo, la guía o el panel Sonido abiertos (o al salir) no se pueden pulsar. */
  setLocked(locked: boolean): void {
    for (const b of this.buttons) b.disabled = locked;
  }
}
