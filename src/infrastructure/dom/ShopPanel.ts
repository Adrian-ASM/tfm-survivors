import type { ShopProductSnapshot, ShopSnapshot } from '../../domain/run/RunSnapshot';
import type { IconChoice, IconState } from '../icons/upgradeIcons';
import type { ShopAction } from '../phaser/ShopGate';
import { button, closeButton, setPanelHidden } from './button';
import { MENU_LABELS } from './menuText';

/** Lo que muestra el panel de un producto (sonda E2E, spec castle-shop "Tienda observable"). */
export interface ShopProductView {
  readonly id: string;
  readonly level: number | null;
  readonly price: number | null;
  readonly buyable: boolean;
  /** Estado del icono de la fila (0034, design D7). */
  readonly icon: IconState;
}

/**
 * Iconos de las filas (0034, design D6): la resolución del `IconBook` de la composición y la URL
 * de un fichero de icono bajo la base (`iconUrl`, mismo origen).
 */
export interface ShopIcons {
  resolve(id: string): IconChoice;
  url(file: string): string;
}

const NO_ICON: IconChoice = Object.freeze({ state: 'none', key: null, file: null });
/** Sin iconos: cada fila lleva su `<img>` oculto, sin `src`. */
export const NO_SHOP_ICONS: ShopIcons = { resolve: () => NO_ICON, url: () => '' };

/** Lado del icono en los atributos del `<img>` (su tamaño nativo; el CSS fija el de pantalla). */
const ICON_ATTR_SIZE = '64';

/** Estado visible del panel para la sonda `window.__sprint.shop`. */
export interface ShopPanelView {
  readonly visible: boolean;
  readonly gold: number;
  readonly products: readonly ShopProductView[];
}

/**
 * Textos de una fila (spec castle-shop, "Overlay de la tienda"): nivel `n/máx` (la curación, su
 * porción), precio o `Máximo`, y el aviso de no comprable (`Vida llena` u `Oro insuficiente`).
 */
export function productTexts(
  p: ShopProductSnapshot,
  fullHealth: boolean,
): { level: string; price: string; notice: string } {
  const level =
    p.kind === 'upgrade' ? `${String(p.level)}/${String(p.maxLevel)}` : `+${String(p.amount)}`;
  const price =
    p.price === null ? MENU_LABELS.shopMax : `${String(p.price)} ${MENU_LABELS.shopGold}`;
  let notice = '';
  if (p.kind === 'heal' && fullHealth) notice = MENU_LABELS.shopFullHealth;
  else if (!p.affordable && p.price !== null) notice = MENU_LABELS.shopNoGold;
  return { level, price, notice };
}

/**
 * Overlay DOM de la tienda (ADR-0011, spec castle-shop 0024): oro, una fila por producto en el orden
 * de la tienda y la × (`Salir`). Los clics dejan una acción que la escena consume con `takeAction`; las
 * reglas (Esc, compra, salida) están en `ShopGate` y en los casos de uso. Se reconstruye solo cuando
 * cambia la clave del `ShopSnapshot`, no por frame. Solo `textContent` y clases (CSP estricta).
 */
export class ShopPanel {
  private readonly root: HTMLElement;
  private readonly gold: HTMLElement;
  private readonly list: HTMLElement;
  private action: ShopAction = null;
  private key = '';
  private shown: ShopPanelView = { visible: false, gold: 0, products: [] };

  constructor(
    private readonly doc: Document,
    parent: HTMLElement,
    /** Iconos de las filas (0034); sin ellos, ocultos. */
    private readonly icons: ShopIcons = NO_SHOP_ICONS,
  ) {
    this.root = doc.createElement('section');
    this.root.className = 'shop-panel';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', MENU_LABELS.shop);
    this.root.hidden = true;
    const title = doc.createElement('h2');
    title.textContent = MENU_LABELS.shop;
    this.gold = doc.createElement('p');
    this.gold.className = 'shop-panel__gold';
    this.list = doc.createElement('ul');
    this.list.className = 'shop-panel__products';
    // 0036: la × de la esquina (nombre accesible `Salir`), último hijo del recuadro.
    const leave = closeButton(doc, MENU_LABELS.shopLeave, () => {
      this.action = { kind: 'leave' };
    });
    this.root.append(title, this.gold, this.list, leave);
    parent.append(this.root);
  }

  /** Pinta la tienda del snapshot; sin cambios de clave no toca el DOM. */
  sync(shop: ShopSnapshot, health: { current: number; max: number }): void {
    const key = JSON.stringify([shop.gold, health.current, health.max, shop.products]);
    if (key === this.key) return;
    this.key = key;
    this.gold.textContent = `${MENU_LABELS.shopGoldLabel}: ${String(shop.gold)}`;
    const full = health.current >= health.max;
    const choices = shop.products.map((p) => this.icons.resolve(p.id));
    this.list.replaceChildren(...shop.products.map((p, i) => this.row(p, full, choices[i])));
    this.shown = {
      visible: this.shown.visible,
      gold: shop.gold,
      products: shop.products.map((p, i) => ({
        id: p.id,
        level: p.kind === 'upgrade' ? p.level : null,
        price: p.price,
        buyable: p.affordable,
        icon: choices[i]?.state ?? 'none',
      })),
    };
  }

  /**
   * Icono decorativo de la fila (0034, D6): `alt` vacío, sin `style`, URL del mismo origen. Con
   * `none` sigue en la fila (1 imagen por fila) con `hidden` y sin `src`, nunca `data:` ni `blob:`.
   */
  private icon(choice: IconChoice | undefined): HTMLImageElement {
    const img = this.doc.createElement('img');
    img.className = 'shop-panel__icon';
    img.alt = '';
    img.setAttribute('width', ICON_ATTR_SIZE);
    img.setAttribute('height', ICON_ATTR_SIZE);
    if (choice?.file) img.src = this.icons.url(choice.file);
    else img.hidden = true;
    return img;
  }

  private row(p: ShopProductSnapshot, fullHealth: boolean, choice?: IconChoice): HTMLElement {
    const { doc } = this;
    const item = doc.createElement('li');
    const b = button(doc, '', () => {
      this.action = { kind: 'buy', id: p.id };
    });
    b.className = p.affordable ? 'shop-panel__product' : 'shop-panel__product is-unavailable';
    b.dataset.product = p.id;
    if (!p.affordable) b.setAttribute('aria-disabled', 'true');
    b.append(this.icon(choice));
    const texts = productTexts(p, fullHealth);
    const parts: [string, string][] = [
      ['name', p.name],
      ['description', p.description],
      ['level', texts.level],
      ['price', texts.price],
      ['notice', texts.notice],
    ];
    for (const [cls, text] of parts) {
      const span = doc.createElement('span');
      span.className = `shop-panel__${cls}`;
      span.textContent = text;
      b.append(span);
    }
    item.append(b);
    return item;
  }

  /** Acción pulsada desde la última lectura (la consume). */
  takeAction(): ShopAction {
    const action = this.action;
    this.action = null;
    return action;
  }

  setVisible(visible: boolean): void {
    if (!visible) this.action = null;
    this.shown = { ...this.shown, visible };
    setPanelHidden(this.root, !visible);
  }

  /** Lo que el panel muestra (sonda E2E); 0034: con la tienda cerrada, sin filas. */
  get view(): ShopPanelView {
    return this.shown.visible ? this.shown : { ...this.shown, products: [] };
  }
}
