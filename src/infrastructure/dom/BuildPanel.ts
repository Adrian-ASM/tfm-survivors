import type { BuildOptionSnapshot, RunSnapshot } from '../../domain/run/RunSnapshot';
import type { BuildAction } from '../phaser/BuildGate';
import { button, closeButton, setPanelHidden } from './button';
import { MENU_LABELS, buildMissing } from './menuText';
import type { BuildingIcon, ResourceIcons } from './resourceIcons';

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
 * Imagen y explicación de cada edificio del panel (0036, design D6): la imagen del frame de su hoja
 * (`buildingIcons`) y el texto ya interpolado de `guide.json` (`Guide.build`).
 */
export interface BuildAbout {
  readonly icons: Readonly<Record<'house' | 'tower', BuildingIcon>>;
  readonly texts: Readonly<Record<'house' | 'tower', string>>;
}

const NO_BUILDING_ICON: BuildingIcon = Object.freeze({ url: '', width: 0, height: 0 });
/** Sin imagen ni explicación: la imagen va oculta y sin `src`, y el texto vacío. */
export const NO_BUILD_ABOUT: BuildAbout = Object.freeze({
  icons: Object.freeze({ house: NO_BUILDING_ICON, tower: NO_BUILDING_ICON }),
  texts: Object.freeze({ house: '', tower: '' }),
});

/**
 * Panel DOM de obra (spec build-sites 0027, "Panel de obra"; patrón `ShopPanel`): saldo de madera y
 * piedra con sus iconos, siempre las dos filas (casa y torre) con imagen, nombre, explicación y
 * coste en elementos distintos (un coste 0 no se pinta; 0036) y la × (`Salir`). Una fila no asequible va atenuada y desactivada, con
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
    private readonly icons: Pick<ResourceIcons, 'wood' | 'stone'>,
    /** Imagen y explicación de cada edificio (0036); sin ellas, imagen oculta y texto vacío. */
    private readonly about: BuildAbout = NO_BUILD_ABOUT,
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
    // 0036: la × de la esquina (nombre accesible `Salir`), último hijo del recuadro.
    const leave = closeButton(doc, MENU_LABELS.buildLeave, () => {
      this.action = { kind: 'leave' };
    });
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
    // 0036: explicación del edificio, con un espacio delante (el texto no queda «Casa+1»).
    const about = this.doc.createElement('span');
    about.className = 'build-panel__about';
    about.textContent = ` ${this.about.texts[o.kind]}`;
    const cost = this.doc.createElement('span');
    cost.className = 'build-panel__cost';
    // Un espacio de texto antes de las cifras: el texto de la fila no queda «Casa15».
    cost.textContent = ' ';
    for (const r of RESOURCES) if (o[r] > 0) cost.append(this.amount(r, o[r], o.missing[r]));
    b.append(this.building(o.kind), name, about, cost);
    item.append(b);
    return item;
  }

  /**
   * Imagen decorativa del edificio (0036, design D6): `alt` vacío, `width`/`height` del frame (la
   * proporción antes de cargar), sin `style`. Sin URL, o si no carga, queda `hidden`.
   */
  private building(kind: 'house' | 'tower'): HTMLImageElement {
    const { url, width, height } = this.about.icons[kind];
    const img = this.doc.createElement('img');
    img.className = 'build-panel__icon';
    img.alt = '';
    img.setAttribute('width', String(width));
    img.setAttribute('height', String(height));
    if (url === '') {
      img.hidden = true;
      return img;
    }
    img.addEventListener('error', () => {
      img.hidden = true;
    });
    img.setAttribute('src', url);
    return img;
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
