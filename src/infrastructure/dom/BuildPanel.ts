import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import type { BuildAction } from '../phaser/BuildGate';
import { button, setPanelHidden } from './button';
import { MENU_LABELS } from './menuText';

/** Opción del panel (sonda E2E): tipo y coste. */
export interface BuildOptionView {
  readonly kind: 'house' | 'tower';
  readonly wood: number;
  readonly stone: number;
}

/** Estado visible del panel de obra para la sonda `window.__sprint.sites` (0026). */
export interface BuildPanelView {
  readonly visible: boolean;
  readonly siteId: number | null;
  readonly wood: number;
  readonly stone: number;
  readonly options: readonly BuildOptionView[];
}

const NAMES = { house: MENU_LABELS.buildHouse, tower: MENU_LABELS.buildTower } as const;

/**
 * Panel DOM de obra (spec build-sites 0026, "Panel de obra"; patrón `ShopPanel`): madera y piedra,
 * una fila por opción de la oferta en su orden (nombre y coste) y `Salir`. Los clics dejan una
 * acción que la escena consume con `takeAction`; las reglas (Esc, construir, salir) están en
 * `BuildGate` y en los casos de uso. Se reconstruye solo al cambiar la oferta o los recursos. Solo
 * `textContent` y clases (CSP estricta).
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
    this.stock.textContent = `${MENU_LABELS.buildWood}: ${String(wood)} · ${MENU_LABELS.buildStone}: ${String(stone)}`;
    this.list.replaceChildren(
      ...build.options.map((o) => {
        const item = this.doc.createElement('li');
        const b = button(this.doc, '', () => {
          this.action = { kind: 'build', building: o.kind };
        });
        b.className = 'build-panel__option';
        b.dataset.building = o.kind;
        const name = this.doc.createElement('span');
        name.className = 'build-panel__name';
        name.textContent = NAMES[o.kind];
        const cost = this.doc.createElement('span');
        cost.className = 'build-panel__cost';
        cost.textContent = `${String(o.wood)} ${MENU_LABELS.buildWood} · ${String(o.stone)} ${MENU_LABELS.buildStone}`;
        b.append(name, cost);
        item.append(b);
        return item;
      }),
    );
    this.shown = {
      visible: this.shown.visible,
      siteId: build.siteId,
      wood,
      stone,
      options: build.options.map((o) => ({ kind: o.kind, wood: o.wood, stone: o.stone })),
    };
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
