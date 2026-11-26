// DOM mínimo para probar los paneles DOM en Node (Vitest sin jsdom; no se añaden dependencias):
// solo lo que usan `button`, `setPanelHidden` y los paneles (createElement, atributos, clases,
// hijos, textContent, dataset, clics y foco) y, desde 0028, la guía del menú (`focus`, `scrollTop`
// y escuchas de teclado en el documento con recuento por tipo).

type Listener = (event?: unknown) => void;

export class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  private readonly attributes = new Map<string, string>();
  private readonly listeners = new Map<string, Listener[]>();
  private text = '';
  className = '';
  hidden = false;
  type = '';
  disabled = false;
  scrollTop = 0;
  /** Valor de un `<input>` (0035: deslizadores del panel Sonido) y estado de una casilla. */
  value = '';
  checked = false;
  parent: FakeElement | null = null;

  constructor(
    readonly tagName: string,
    readonly ownerDocument: FakeDocument,
  ) {}

  get textContent(): string {
    return this.text + this.children.map((c) => c.textContent).join('');
  }

  set textContent(value: string) {
    this.text = value;
    this.children.length = 0;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  append(...nodes: FakeElement[]): void {
    for (const n of nodes) {
      n.parent = this;
      this.children.push(n);
    }
  }

  replaceChildren(...nodes: FakeElement[]): void {
    this.children.length = 0;
    this.append(...nodes);
  }

  addEventListener(type: string, fn: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }

  /** Escuchas registradas de un tipo (p. ej. 0 de `error` en los iconos de la guía). */
  listenerCount(type: string): number {
    return this.listeners.get(type)?.length ?? 0;
  }

  /** Como un clic de ratón real: un botón `disabled` no lo recibe y uno activo toma el foco. */
  click(): void {
    if (this.disabled) return;
    if (this.tagName === 'button') this.focus();
    for (const fn of this.listeners.get('click') ?? []) fn();
  }

  /**
   * Clic sobre un hijo que sube por los ancestros (0034: el `<img>` de una fila de la tienda): como
   * en el DOM, un botón `disabled` en el camino no lo recibe ni lo deja pasar.
   */
  clickBubbling(): void {
    if (this.disabled) return;
    for (const fn of this.listeners.get('click') ?? []) fn();
    this.parent?.clickBubbling();
  }

  /** Lanza las escuchas de un tipo (`input`, `change`…), como un evento sin burbujeo. */
  dispatch(type: string): void {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn({ type, target: this });
  }

  focus(): void {
    this.ownerDocument.activeElement = this;
  }

  blur(): void {
    if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = null;
  }

  contains(other: FakeElement | null): boolean {
    for (let n = other; n; n = n.parent) if (n === this) return true;
    return false;
  }

  /** Descendientes (en profundidad) que cumplen `ok`. */
  findAll(ok: (e: FakeElement) => boolean): FakeElement[] {
    return this.children.flatMap((c) => [...(ok(c) ? [c] : []), ...c.findAll(ok)]);
  }

  /** Descendientes con esa clase. */
  byClass(cls: string): FakeElement[] {
    return this.findAll((e) => e.className.split(' ').includes(cls));
  }
}

/** Opciones de una tecla de `dispatchKey` (las de `KeyboardEvent` que mira la guía). */
export interface FakeKeyOptions {
  /** `KeyboardEvent.code` (0035: la tecla M); por defecto, `Key` + la tecla en mayúscula. */
  readonly code?: string;
  readonly repeat?: boolean;
  readonly altKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
}

export class FakeDocument {
  activeElement: FakeElement | null = null;
  private readonly listeners = new Map<string, Listener[]>();

  createElement(tag: string): FakeElement {
    return new FakeElement(tag, this);
  }

  addEventListener(type: string, fn: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }

  /** Quita la escucha con la misma referencia (como el DOM: si no está, no hace nada). */
  removeEventListener(type: string, fn: Listener): void {
    const list = this.listeners.get(type) ?? [];
    const i = list.indexOf(fn);
    if (i >= 0) this.listeners.set(type, [...list.slice(0, i), ...list.slice(i + 1)]);
  }

  /** Escuchas registradas en el documento de un tipo. */
  listenerCount(type: string): number {
    return this.listeners.get(type)?.length ?? 0;
  }

  /**
   * Un `keydown` en el documento con esa tecla; informa de si alguna escucha llamó a
   * `preventDefault`. Recorre una copia: una escucha que se quita no corta el evento en curso.
   */
  dispatchKey(key: string, options: FakeKeyOptions = {}): { defaultPrevented: boolean } {
    let defaultPrevented = false;
    const event = {
      key,
      code: options.code ?? `Key${key.toUpperCase()}`,
      repeat: options.repeat ?? false,
      altKey: options.altKey ?? false,
      ctrlKey: options.ctrlKey ?? false,
      metaKey: options.metaKey ?? false,
      preventDefault: () => {
        defaultPrevented = true;
      },
    };
    for (const fn of [...(this.listeners.get('keydown') ?? [])]) fn(event);
    return { defaultPrevented };
  }
}

/** Documento y contenedor falsos con `HTMLElement` global (lo usa `setPanelHidden`). */
export function fakeDom(): {
  doc: Document;
  root: HTMLElement;
  fake: FakeElement;
  fakeDoc: FakeDocument;
} {
  (globalThis as { HTMLElement?: unknown }).HTMLElement ??= FakeElement;
  const fakeDoc = new FakeDocument();
  const fake = fakeDoc.createElement('div');
  return {
    doc: fakeDoc as unknown as Document,
    root: fake as unknown as HTMLElement,
    fake,
    fakeDoc,
  };
}
