import type { PauseAction } from '../phaser/PauseGate';
import { button, setPanelHidden } from './button';
import { MENU_LABELS } from './menuText';

/**
 * Overlay DOM de la pausa (ADR-0011): texto `Pausa`, `Reanudar` y `Volver al menú`. Los clics
 * solo dejan una acción que la escena consume en su `update` con `takeAction`; las reglas están en
 * `PauseGate`. Se crea una vez y se muestra u oculta con `setVisible`.
 */
export class PausePanel {
  private readonly root: HTMLElement;
  private action: PauseAction = null;

  constructor(doc: Document, parent: HTMLElement) {
    this.root = doc.createElement('section');
    this.root.className = 'pause-panel';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', MENU_LABELS.pause);
    this.root.hidden = true;
    const title = doc.createElement('h2');
    title.textContent = MENU_LABELS.pause;
    const actions = doc.createElement('div');
    actions.className = 'pause-panel__actions';
    actions.append(
      button(doc, MENU_LABELS.resume, () => {
        this.action = 'resume';
      }),
      button(doc, MENU_LABELS.toMenu, () => {
        this.action = 'menu';
      }),
    );
    this.root.append(title, actions);
    parent.append(this.root);
  }

  /** Botón pulsado desde la última lectura (la consume). */
  takeAction(): PauseAction {
    const action = this.action;
    this.action = null;
    return action;
  }

  setVisible(visible: boolean): void {
    if (!visible) this.action = null;
    setPanelHidden(this.root, !visible);
  }
}
