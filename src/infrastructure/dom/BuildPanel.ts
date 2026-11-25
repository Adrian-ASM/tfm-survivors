import type { BuildOptionSnapshot, RunSnapshot } from '../../domain/run/RunSnapshot';
import type { BuildAction } from '../phaser/BuildGate';
import { button, setPanelHidden } from './button';
import { MENU_LABELS, buildMissing } from './menuText';
import type { ResourceIcons } from './resourceIcons';

/** Opción del panel (sonda E2E): tipo, coste, si es asequible y lo que falta (0027). */
export interface BuildOptionView {
  readonly kind: 'house' | 'tower';
  readonly wood: number;
  readonly stone: number;
  readonly affordable: boolean;
  readonly missing: { readonly wood: number; readonly stone: number };
}

/** Estado visible del panel de obra para la sonda `window.__sprint.sites` (0026). */
export interface BuildPanelView {
  readonly visible: boolean;
  readonly siteId: number | null;
  readonly wood: number;
  readonly stone: number;
  readonly options: readonly BuildOptionView[];
}

type Resource = 'wood' | 'stone';

const NAMES = { house: MENU_LABELS.buildHouse, tower: MENU_LABELS.buildTower } as const;
const ALT: Readonly<Record<Resource, string>> = {
  wood: MENU_LABELS.buildWood,
  stone: MENU_LABELS.buildStone,
};
const RESOURCES: readonly Resource[] = ['wood', 'stone'];

/**
 * Panel DOM de obra (spec build-sites 0027, "Panel de obra"; patrón `ShopPanel`): saldo de madera y
 * piedra con sus iconos, siempre las dos filas (casa y torre) con nombre y coste en elementos
 * distintos (un coste 0 no se pinta) y `Salir`. Una fila no asequible va atenuada y desactivada, con
 * el recurso que no alcanza en rojo y «faltan N»; un clic en ella no deja acción. Los clics dejan una
 * acción que la escena consume con `takeAction`; las reglas (Esc, construir, salir) están en
 * `BuildGate` y en los casos de uso. Se reconstruye solo al cambiar la oferta o los recursos. Solo
 * `textContent`, atributos y clases (CSP estricta: sin atributo `style`).
 */
export class BuildPanel {
  private readonly root: HTMLElement;
  private readonly stock: HTMLElement;
  private readonly list: HTMLElement;
  private action: BuildAction = null;
  private key = '';
  private shown: BuildPanelView = { visible: false, siteId: null, wood: 0, stone: 0, options: [] };

  constructor(
    private readonly doc: Document,
    parent: HTMLElement,
    private readonly icons: ResourceIcons,
  ) {
    this.root = doc.createElement('section');
    this.root.className = 'build-panel';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', MENU_LABELS.build);
    this.root.hidden = true;
    const title = doc.createElement('h2');
    title.textContent = MENU_LABELS.build;
    this.stock = doc.createElement('p');
    this.stock.className = 'build-panel__stock';
    this.list = doc.createElement('ul');
    this.list.className = 'build-panel__options';
    const leave = button(doc, MENU_LABELS.buildLeave, () => {
      this.action = { kind: 'leave' };
    });
    leave.className = 'build-panel__leave';
    this.root.append(title, this.stock, this.list, leave);
    parent.append(this.root);
  }

  /** Pinta la oferta del snapshot; sin cambios de clave no toca el DOM. */
  sync(snapshot: RunSnapshot): void {
    const { build, resources } = snapshot;
    const key = JSON.stringify([build, resources.wood, resources.stone]);
    if (key === this.key) return;
    this.key = key;
    const { wood, stone } = resources;
    this.stock.replaceChildren(this.amount('wood', wood), this.amount('stone', stone));
    this.list.replaceChildren(...build.options.map((o) => this.row(o)));
    this.shown = {
      visible: this.shown.visible,
      siteId: build.siteId,
      wood,
      stone,
      options: build.options.map((o) => ({
        kind: o.kind,
        wood: o.wood,
        stone: o.stone,
        affordable: o.affordable,
        missing: { wood: o.missing.wood, stone: o.missing.stone },
      })),
    };
  }

  /** Fila de una opción: botón con nombre y coste; desactivado si no es asequible. */
  private row(o: BuildOptionSnapshot): HTMLElement {
    const item = this.doc.createElement('li');
    const b = button(this.doc, '', () => {
      if (o.affordable) this.action = { kind: 'build', building: o.kind };
    });
    b.className = o.affordable ? 'build-panel__option' : 'build-panel__option is-unavailable';
    b.dataset.building = o.kind;
    if (!o.affordable) {
      b.setAttribute('disabled', '');
      b.setAttribute('aria-disabled', 'true');
    }
    const name = this.doc.createElement('span');
    name.className = 'build-panel__name';
    name.textContent = NAMES[o.kind];
    const cost = this.doc.createElement('span');
    cost.className = 'build-panel__cost';
    // Un espacio de texto antes de las cifras: el texto de la fila no queda «Casa15».
    cost.textContent = ' ';
    for (const r of RESOURCES) if (o[r] > 0) cost.append(this.amount(r, o[r], o.missing[r]));
    b.append(name, cost);
    item.append(b);
    return item;
  }

  /** Icono y cifra de un recurso; con `missing` > 0, en rojo (`.is-short`) y «faltan N». */
  private amount(resource: Resource, value: number, missing = 0): HTMLElement {
    const span = this.doc.createElement('span');
    span.className = missing > 0 ? 'build-panel__amount is-short' : 'build-panel__amount';
    span.textContent = ' ';
    const icon = this.doc.createElement('img');
    icon.className = `resource-icon resource-icon--${resource}`;
    icon.setAttribute('src', this.icons[resource]);
    icon.setAttribute('alt', ALT[resource]);
    const number = this.doc.createElement('span');
    number.className = 'build-panel__value';
    number.textContent = String(value);
    span.append(icon, number);
    if (missing > 0) {
      const note = this.doc.createElement('span');
      note.className = 'build-panel__missing';
      note.textContent = buildMissing(missing);
      span.append(note);
    }
    return span;
  }

  /** Acción pulsada desde la última lectura (la consume). */
  takeAction(): BuildAction {
    const action = this.action;
    this.action = null;
    return action;
  }

  setVisible(visible: boolean): void {
    if (!visible) this.action = null;
    this.shown = { ...this.shown, visible };
    setPanelHidden(this.root, !visible);
  }

  /** Lo que el panel muestra (sonda E2E). */
  get view(): BuildPanelView {
    return this.shown;
  }
}
