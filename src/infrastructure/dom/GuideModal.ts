import type { Guide } from '../content/guideSchema';
import { button, closeButton, setPanelHidden } from './button';
import { GUIDE_ICON_ALT, MENU_LABELS, guidePage } from './menuText';
import type { ResourceIcons } from './resourceIcons';

/** Estado observable del modal para los tests de Node (no es una sonda E2E). */
export interface GuideModalView {
  readonly open: boolean;
  /** Página visible, de 1 a `total`. */
  readonly page: number;
  readonly total: number;
  /** Si su escucha de `keydown` está registrada en el documento. */
  readonly listening: boolean;
}

const TITLE_ID = 'guide-modal-title';

/** Teclas con efecto en la guía (design 0028 §5); cualquier otra sale sin tocar nada. */
const KEYS = new Set(['Escape', 'ArrowRight', 'ArrowLeft']);

/**
 * Guía «Cómo jugar» del menú (change 0028, design §3 y §5): una página a la vez con título,
 * indicador «n de total», iconos de recurso y párrafos; `Anterior`, `Siguiente` y la × (`Cerrar`), y
 * Esc y flechas solo entre `open()` y `close()` (una escucha en el documento). Solo
 * `createElement`, `textContent`, atributos, clases y `hidden` (CSP estricta). El foco va al
 * recuadro (`tabindex="-1"`) al abrir y tras cambiar de página; sin focus trap.
 */
export class GuideModal {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly indicator: HTMLElement;
  private readonly body: HTMLElement;
  private readonly prevButton: HTMLButtonElement;
  private readonly nextButton: HTMLButtonElement;
  private index = 0;
  private onClosed: (() => void) | null = null;
  private listening = false;

  constructor(
    private readonly doc: Document,
    parent: HTMLElement,
    private readonly guide: Guide,
    private readonly icons: ResourceIcons,
  ) {
    this.root = doc.createElement('div');
    this.root.className = 'guide-modal';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', TITLE_ID);
    this.root.setAttribute('tabindex', '-1');
    this.root.hidden = true;

    const header = doc.createElement('header');
    header.className = 'guide-modal__header';
    this.title = doc.createElement('h2');
    this.title.setAttribute('id', TITLE_ID);
    this.indicator = doc.createElement('p');
    this.indicator.className = 'guide-modal__page';
    header.append(this.title, this.indicator);

    this.body = doc.createElement('div');
    this.body.className = 'guide-modal__body';

    this.prevButton = button(doc, MENU_LABELS.guidePrev, () => {
      this.turn(-1);
      this.root.focus();
    });
    this.nextButton = button(doc, MENU_LABELS.guideNext, () => {
      this.turn(1);
      this.root.focus();
    });
    const actions = doc.createElement('div');
    actions.className = 'guide-modal__actions';
    actions.append(this.prevButton, this.nextButton);
    // 0036: la × de la esquina (nombre accesible `Cerrar`), último hijo del recuadro.
    const close = closeButton(doc, MENU_LABELS.guideClose, () => {
      this.close();
    });

    this.root.append(header, this.body, actions, close);
    parent.append(this.root);
  }

  get view(): GuideModalView {
    return {
      open: this.onClosed !== null,
      page: this.index + 1,
      total: this.guide.pages.length,
      listening: this.listening,
    };
  }

  /** Abre en la página 1 y avisa con `onClosed` al cerrarse; abierto ya, no hace nada. */
  open(onClosed: () => void): void {
    if (this.onClosed !== null) return;
    this.onClosed = onClosed;
    this.index = 0;
    this.render();
    setPanelHidden(this.root, false);
    this.doc.addEventListener('keydown', this.onKey);
    this.listening = true;
    this.root.focus();
  }

  /** Idempotente: solo si estaba abierto quita la escucha, oculta y llama a `onClosed` una vez. */
  close(): void {
    const onClosed = this.onClosed;
    if (onClosed === null) return;
    this.onClosed = null;
    this.doc.removeEventListener('keydown', this.onKey);
    this.listening = false;
    setPanelHidden(this.root, true);
    onClosed();
  }

  /** Misma referencia en el alta y en la baja (propiedad flecha fija). */
  private readonly onKey = (e: KeyboardEvent): void => {
    if (!KEYS.has(e.key)) return;
    // Alt + ← es «atrás» en el navegador: no se bloquea ni actúa.
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    // Una tecla mantenida es una sola pulsación.
    if (e.repeat) return;
    if (e.key === 'Escape') this.close();
    else this.turn(e.key === 'ArrowRight' ? 1 : -1);
  };

  /** Pasa a la página vecina; en los topes no hace nada. */
  private turn(step: 1 | -1): void {
    const next = this.index + step;
    if (next < 0 || next >= this.guide.pages.length) return;
    this.index = next;
    this.render();
  }

  private render(): void {
    const page = this.guide.pages[this.index];
    if (!page) return;
    const total = this.guide.pages.length;
    this.title.textContent = page.title;
    this.indicator.textContent = guidePage(this.index + 1, total);
    const nodes: HTMLElement[] = [];
    if (page.icons.length > 0) {
      const row = this.doc.createElement('p');
      row.className = 'guide-modal__icons';
      for (const id of page.icons) {
        // Sin escuchar `error`: si la hoja no carga se ve su `alt` y el resto se pinta igual.
        const img = this.doc.createElement('img');
        img.className = `resource-icon resource-icon--${id}`;
        img.setAttribute('src', this.icons[id]);
        img.setAttribute('alt', GUIDE_ICON_ALT[id]);
        row.append(img);
      }
      nodes.push(row);
    }
    for (const text of page.paragraphs) {
      const p = this.doc.createElement('p');
      p.textContent = text;
      nodes.push(p);
    }
    this.body.replaceChildren(...nodes);
    this.body.scrollTop = 0;
    this.prevButton.hidden = this.index === 0;
    this.nextButton.hidden = this.index === total - 1;
  }
}
