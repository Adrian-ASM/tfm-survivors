// DOM mínimo para probar los paneles DOM en Node (Vitest sin jsdom; no se añaden dependencias):
// solo lo que usan `button`, `setPanelHidden` y los paneles (createElement, atributos, clases,
// hijos, textContent, dataset, clics y foco).

export class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  private readonly attributes = new Map<string, string>();
  private readonly listeners = new Map<string, (() => void)[]>();
  private text = '';
  className = '';
  hidden = false;
  type = '';
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

  addEventListener(type: string, fn: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }

  click(): void {
    for (const fn of this.listeners.get('click') ?? []) fn();
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

export class FakeDocument {
  activeElement: FakeElement | null = null;

  createElement(tag: string): FakeElement {
    return new FakeElement(tag, this);
  }
}

/** Documento y contenedor falsos con `HTMLElement` global (lo usa `setPanelHidden`). */
export function fakeDom(): { doc: Document; root: HTMLElement; fake: FakeElement } {
  (globalThis as { HTMLElement?: unknown }).HTMLElement ??= FakeElement;
  const fakeDoc = new FakeDocument();
  const fake = fakeDoc.createElement('div');
  return {
    doc: fakeDoc as unknown as Document,
    root: fake as unknown as HTMLElement,
    fake,
  };
}
