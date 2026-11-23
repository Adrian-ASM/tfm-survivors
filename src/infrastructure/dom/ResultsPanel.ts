import { button, setPanelHidden } from './button';
import { DomResultsLines } from './DomResultsLines';
import { pickedFile } from './pickedFile';
import type { ResultsPanelView } from './resultsPanelText';

/** Lo que hace el panel al pulsar sus botones (la composición lo conecta al presentador). */
export interface ResultsPanelActions {
  onExport(): void;
  onImport(file: File): void;
}

/**
 * Panel DOM del progreso sobre el canvas (design 0007): récords, avisos, mensaje del import y
 * botones Exportar / Importar. Se crea una vez; `render` solo toca el DOM si la vista cambia. Solo
 * `textContent`: ningún valor se interpreta como HTML.
 */
export class ResultsPanel {
  private readonly root: HTMLElement;
  private readonly records: HTMLElement;
  private readonly notices: HTMLElement;
  private readonly message: HTMLElement;
  private shown: ResultsPanelView | null = null;
  /** Las 5 líneas del resultado (título, tiempo, nivel, bajas, R), en la cabecera (0017, D11). */
  readonly lines: DomResultsLines;

  constructor(doc: Document, parent: HTMLElement, actions: ResultsPanelActions) {
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
      const node = doc.createElement(tag);
      node.className = className;
      return node;
    };
    this.root = el('section', 'results-panel');
    this.root.setAttribute('aria-label', 'Progreso');
    this.root.hidden = true;
    this.records = el('div', 'results-panel__records');
    this.notices = el('div', 'results-panel__notices');
    this.message = el('p', 'results-panel__message');
    this.message.setAttribute('role', 'status');
    const header = el('header', 'results-panel__header');
    const line = (tag: 'h2' | 'p', className: string): HTMLElement => {
      const node = el(tag, className);
      node.hidden = true;
      header.append(node);
      return node;
    };
    this.lines = new DomResultsLines({
      title: line('h2', 'results-panel__title'),
      time: line('p', 'results-panel__line'),
      level: line('p', 'results-panel__line'),
      kills: line('p', 'results-panel__line'),
      hint: line('p', 'results-panel__hint'),
    });

    const file = el('input', 'results-panel__file');
    file.type = 'file';
    file.accept = '.json,application/json';
    file.hidden = true;
    const exportButton = button(doc, 'Exportar', () => {
      actions.onExport();
    });
    const importButton = button(doc, 'Importar', () => {
      file.click();
    });
    file.addEventListener('change', () => {
      const chosen = pickedFile(file.files);
      file.value = '';
      if (chosen) actions.onImport(chosen);
    });

    const buttons = el('div', 'results-panel__actions');
    buttons.append(exportButton, importButton, file);
    this.root.append(header, this.records, this.notices, this.message, buttons);
    parent.append(this.root);
  }

  render(view: ResultsPanelView | null): void {
    if (view === this.shown) return;
    this.shown = view;
    setPanelHidden(this.root, view === null);
    if (!view) return;
    this.records.replaceChildren(...view.records.map((line) => this.line(line)));
    this.notices.replaceChildren(...view.notices.map((line) => this.line(line)));
    this.message.textContent = view.message ?? '';
    this.message.hidden = view.message === null;
  }

  private line(text: string): HTMLElement {
    const p = this.root.ownerDocument.createElement('p');
    p.textContent = text;
    return p;
  }
}
