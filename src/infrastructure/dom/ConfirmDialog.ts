import { button, setPanelHidden } from './button';
import { MENU_LABELS } from './menuText';

/** Lo que hace el diálogo con cada botón (la composición pasa por `MenuController`). */
export interface ConfirmDialogActions {
  onConfirm(): void;
  onCancel(): void;
}

/**
 * Diálogo de confirmación de Borrar datos, dentro del juego (spec main-menu: nunca
 * `window.confirm`). No usa `<dialog>` nativo, que se cierra con Esc: solo se cierra con
 * `Confirmar` o `Cancelar`, y no escucha el teclado. Al abrirse pone el foco en `Cancelar`.
 */
export class ConfirmDialog {
  private readonly root: HTMLElement;
  private readonly cancel: HTMLButtonElement;

  constructor(doc: Document, parent: HTMLElement, actions: ConfirmDialogActions) {
    this.root = doc.createElement('div');
    this.root.className = 'confirm-dialog';
    this.root.setAttribute('role', 'alertdialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', MENU_LABELS.clear);
    this.root.hidden = true;
    const question = doc.createElement('p');
    question.textContent = MENU_LABELS.confirmQuestion;
    this.cancel = button(doc, MENU_LABELS.cancel, () => {
      actions.onCancel();
    });
    const confirm = button(doc, MENU_LABELS.confirm, () => {
      actions.onConfirm();
    });
    const row = doc.createElement('div');
    row.className = 'confirm-dialog__actions';
    row.append(confirm, this.cancel);
    this.root.append(question, row);
    parent.append(this.root);
  }

  open(): void {
    setPanelHidden(this.root, false);
    this.cancel.focus();
  }

  close(): void {
    setPanelHidden(this.root, true);
  }
}
