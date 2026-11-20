/**
 * Botón DOM que suelta el foco tras pulsarlo, para que Espacio o Intro no lo vuelvan a activar y
 * las teclas del juego (R, Esc) sigan yendo al juego (design 0009, "Foco del teclado"). Solo
 * `textContent` y `addEventListener` (CSP estricta).
 */
export function button(doc: Document, label: string, onClick: () => void): HTMLButtonElement {
  const b = doc.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', () => {
    onClick();
    b.blur();
  });
  return b;
}

/** Oculta un panel soltando antes el foco que contenga (un panel oculto no retiene el foco). */
export function setPanelHidden(panel: HTMLElement, hidden: boolean): void {
  if (panel.hidden === hidden) return;
  if (hidden) {
    const focused = panel.ownerDocument.activeElement;
    if (focused instanceof HTMLElement && panel.contains(focused)) focused.blur();
  }
  panel.hidden = hidden;
}
