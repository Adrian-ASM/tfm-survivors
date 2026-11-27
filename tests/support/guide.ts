// Guía del menú (0028) para los tests de Node: la del repositorio interpolada con el contenido por
// defecto, iconos de prueba y lectura de lo que se ve en el modal falso.
import guideJson from '../../content/guide.json';
import type { Guide } from '../../src/infrastructure/content/guideSchema';
import { parseGuide } from '../../src/infrastructure/content/loadGuide';
import { parseContent } from '../../src/infrastructure/content/loadRunConfig';
import type { ResourceIcons } from '../../src/infrastructure/dom/resourceIcons';
import { rawContent } from './builders';
import type { FakeElement } from './fakeDom';

export function defaultGuide(): Guide {
  const content = parseContent(rawContent());
  if (!content.ok) throw new Error(content.error.message);
  const guide = parseGuide(guideJson, content.value.config);
  if (!guide.ok) throw new Error(`${guide.error.field}: ${guide.error.message}`);
  return guide.value;
}

export const TEST_ICONS: ResourceIcons = {
  xp: 'data:image/svg+xml,gem',
  gold: '/a/G_Idle.png',
  wood: '/a/W_Idle.png',
  meat: '/a/M_Idle.png',
  stone: '/a/Deco/05.png',
};

/** Visible: ni él ni ningún antecesor tiene `hidden`. */
export const isShown = (e: FakeElement | null): boolean => {
  for (let n = e; n; n = n.parent) if (n.hidden) return false;
  return true;
};

/** Lo que ve el jugador del modal falso de la guía (por clases y etiquetas, no por internos). */
export class GuideReader {
  constructor(private readonly container: FakeElement) {}

  get root(): FakeElement {
    const r = this.container.byClass('guide-modal')[0];
    if (!r) throw new Error('sin guía');
    return r;
  }

  get visible(): boolean {
    return isShown(this.root);
  }

  get indicator(): string {
    return this.root.byClass('guide-modal__page')[0]?.textContent ?? '';
  }

  get titles(): FakeElement[] {
    return this.root.findAll((e) => e.tagName === 'h2' && isShown(e));
  }

  get title(): string {
    return this.titles[0]?.textContent ?? '';
  }

  get paragraphs(): string[] {
    const body = this.root.byClass('guide-modal__body')[0];
    return (body?.children ?? [])
      .filter((e) => e.tagName === 'p' && e.className === '')
      .map((e) => e.textContent);
  }

  get icons(): FakeElement[] {
    return this.root.findAll((e) => e.tagName === 'img' && isShown(e));
  }

  /**
   * Nombres accesibles de los botones visibles del modal, en orden del DOM (0036: la × se nombra
   * `Cerrar` por su `aria-label` y va la última).
   */
  get controls(): string[] {
    return this.root
      .findAll((e) => e.tagName === 'button' && isShown(e))
      .map((b) => b.accessibleName);
  }

  /** Texto visible de los botones visibles del modal, en orden (0036: la × es `×`). */
  get labels(): string[] {
    return this.root.findAll((e) => e.tagName === 'button' && isShown(e)).map((b) => b.textContent);
  }

  /** Botón por nombre accesible (`Cerrar` es la ×). */
  control(label: string): FakeElement {
    const b = this.root.findAll((e) => e.tagName === 'button' && e.accessibleName === label)[0];
    if (!b) throw new Error(`sin botón ${label}`);
    return b;
  }

  /** ¿El foco del documento está dentro del modal? */
  get focused(): boolean {
    return this.root.contains(this.root.ownerDocument.activeElement);
  }
}
