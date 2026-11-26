/** Texto del aviso de orientación (spec touch-controls 0033). */
export const ROTATE_TEXT = 'Gira el móvil';

/** Vertical estricta: más alta que ancha (una ventana cuadrada no muestra el aviso). */
export const isPortrait = (size: { readonly width: number; readonly height: number }): boolean =>
  size.height > size.width;

/**
 * Aviso «Gira el móvil» (spec touch-controls 0033, design §5): un `<div role="alert">` a pantalla
 * completa por encima de todo (z-index en `styles.css`). Solo alterna `hidden`; la retención de la
 * partida la lleva `PauseGate`.
 */
export class RotateNotice {
  private readonly root: HTMLElement;

  constructor(doc: Document, parent: HTMLElement) {
    this.root = doc.createElement('div');
    this.root.className = 'rotate-notice';
    this.root.setAttribute('role', 'alert');
    this.root.textContent = ROTATE_TEXT;
    this.root.hidden = true;
    parent.append(this.root);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }
}
