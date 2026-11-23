import type { ResultsTexts, ShowableText } from '../phaser/ResultsOverlay';

/** Lo que se usa de un elemento DOM (`HTMLElement` lo cumple): costura sin jsdom. */
export interface TextElement {
  textContent: string | null;
  hidden: boolean | string;
}

/** Elementos de las 5 líneas de resultados, en la cabecera del panel (design 0017 D11). */
export interface ResultsLineElements {
  readonly title: TextElement;
  readonly time: TextElement;
  readonly level: TextElement;
  readonly kills: TextElement;
  readonly hint: TextElement;
}

/** `setText` → `textContent` (nunca HTML) y `setVisible` → `hidden`. */
function textOf(el: TextElement): ShowableText {
  return {
    setText: (text) => {
      el.textContent = text;
    },
    setVisible: (visible) => {
      el.hidden = !visible;
    },
  };
}

/**
 * Las 5 líneas del overlay de resultados como DOM (0017, D11): así forman un único bloque centrado
 * con el panel de resultados. La lógica de `ResultsOverlay` no cambia: solo recibe otros textos.
 */
export class DomResultsLines {
  readonly texts: ResultsTexts;

  constructor(elements: ResultsLineElements) {
    this.texts = {
      title: textOf(elements.title),
      time: textOf(elements.time),
      level: textOf(elements.level),
      kills: textOf(elements.kills),
      hint: textOf(elements.hint),
    };
  }
}
