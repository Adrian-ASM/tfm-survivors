import type { OfferSnapshot } from '../../domain/run/RunSnapshot';
import type { IconChoice, IconState } from '../icons/upgradeIcons';
import {
  CARD_FONT_SIZE,
  cardContentLayout,
  cardLayout,
  cardTextLayout,
  wrapLines,
  type CardMargins,
  type CardRect,
} from './cardLayout';
import type { ScreenFrame } from './ui/screenFrame';
import type { UiPanelPart } from './ui/uiPanel';
import { MONO_CHAR_RATIO, veilLayout } from './ui/uiLayout';

/**
 * Lo mínimo que el overlay necesita del motor (`Rectangle` y `Text` de Phaser, con un adaptador
 * para el puntero): costuras de testabilidad dentro de infraestructura, no puertos de dominio.
 */
export interface OverlayPart {
  setVisible(visible: boolean): unknown;
  setPosition(x: number, y: number): unknown;
}
/** Velo: también cambia de tamaño al redimensionar (0017). */
export interface VeilPart extends OverlayPart {
  setSize(width: number, height: number): unknown;
}
/**
 * Texto de una carta. 0032: el nombre se ancla por arriba, la descripción por arriba bajo el nombre
 * y el nivel por abajo (orígenes fijados por la fábrica: (0,5, 0), (0,5, 0) y (0,5, 1)).
 */
export interface CardText extends OverlayPart {
  setText(text: string): unknown;
  /** Tamaño final del texto (se pinta a su tamaño, no se reescala el objeto; design 0017 D5). */
  setFontSize(size: number): unknown;
  setWordWrapWidth(width: number): unknown;
}
export interface CardBox extends OverlayPart {
  setSize(width: number, height: number): unknown;
  onPointerDown(handler: () => void): void;
}
/**
 * Icono de una carta (0034, design D4): un `Image` preasignado con origen (0,5, 0) y sin zona de
 * clic propia (el clic llega a la zona de la carta). Solo cambia de textura cuando cambia la oferta.
 */
export interface CardIcon extends OverlayPart {
  setTexture(key: string): unknown;
  setDisplaySize(width: number, height: number): unknown;
}
export interface CardParts {
  /** Marco de la carta (0032): `NineSlice` de `button` o `NO_PANEL` en reserva. */
  readonly frame: UiPanelPart;
  /** Zona de clic: el rectángulo entero de la carta (transparente si hay marco). */
  readonly box: CardBox;
  readonly name: CardText;
  readonly description: CardText;
  readonly level: CardText;
  /** Icono de la mejora en el hueco del layout (0034). */
  readonly icon: CardIcon;
}

/** Icono de cada carta visible con el id de su opción (sonda `offerIcons`, 0034 D7). */
export interface OfferIconView {
  readonly id: string;
  readonly icon: IconState;
}

const NO_ICON: IconChoice = Object.freeze({ state: 'none', key: null, file: null });
/** Sin catálogo de iconos: ningún icono (hueco vacío). */
export const noIcons = (): IconChoice => NO_ICON;

/** Márgenes de texto sin pieza: los 16 px de siempre por lado. */
export const PLAIN_CARD_MARGINS: CardMargins = { left: 16, top: 16, right: 16, bottom: 16 };

const keyOf = (offer: readonly OfferSnapshot[]): string =>
  offer.map((o) => `${o.id}:${String(o.level)}`).join('|');

/** Texto de la cabecera de una carta (índice 0 → `[1]`). */
export const cardName = (i: number, option: OfferSnapshot): string =>
  `[${String(i + 1)}] ${option.name}`;
export const cardLevel = (option: OfferSnapshot): string =>
  `Nv ${String(option.level)} → ${String(option.nextLevel)}`;

/**
 * Overlay de elección (spec upgrades): velo y una carta por opción, en el orden de la oferta.
 * Las cartas se crean una vez fuera (preasignadas); aquí solo se colocan, se muestran u ocultan y
 * se rellenan sus textos cuando cambia la oferta. Un clic en una carta visible guarda su índice
 * para que la escena lo lea con `takeClicked`. No elige nada por sí mismo. `relayout` las vuelve a
 * colocar con el frame nuevo sin tocar la oferta (0017) ni crear piezas (0032).
 */
export class UpgradeOverlay {
  private key = '';
  private shown = 0;
  private clicked = -1;
  private frame: ScreenFrame;
  private names: string[] = [];
  private icons: OfferIconView[] = [];

  constructor(
    private readonly veil: VeilPart,
    private readonly cards: readonly CardParts[],
    frame: ScreenFrame,
    /** Márgenes de la pieza `button` (0032): fijan el área útil del texto, con o sin pieza. */
    private readonly margins: CardMargins = PLAIN_CARD_MARGINS,
    /** Resolución del icono de un id (0034, `IconBook.resolve`); sin catálogo, ninguno. */
    private readonly iconFor: (id: string) => IconChoice = noIcons,
  ) {
    this.frame = frame;
    veil.setVisible(false);
    cards.forEach((card, i) => {
      card.box.onPointerDown(() => {
        if (i < this.shown) this.clicked = i;
      });
      this.setCardVisible(card, false);
    });
    this.placeVeil();
    this.applyScale();
  }

  get visible(): boolean {
    return this.shown > 0;
  }

  /** Estado del icono de cada carta visible, en el orden de la oferta (vacío sin oferta). */
  get iconStates(): readonly OfferIconView[] {
    return this.icons;
  }

  sync(offer: readonly OfferSnapshot[]): void {
    const key = keyOf(offer);
    if (key === this.key) return;
    this.key = key;
    this.shown = Math.min(offer.length, this.cards.length);
    this.clicked = -1;
    this.veil.setVisible(this.shown > 0);
    const shownOffer = offer.slice(0, this.shown);
    this.names = shownOffer.map((o, i) => cardName(i, o));
    const choices = shownOffer.map((o) => this.iconFor(o.id));
    this.icons = shownOffer.map((o, i) => ({ id: o.id, icon: choices[i]?.state ?? 'none' }));
    const rects = cardLayout(this.frame, this.shown);
    this.cards.forEach((card, i) => {
      const option = offer[i];
      const rect = rects[i];
      if (!option || !rect) {
        this.setCardVisible(card, false);
        return;
      }
      // La textura solo cambia aquí, con la oferta (0034): RESIZE solo recoloca.
      const key = choices[i]?.key ?? null;
      if (key !== null) card.icon.setTexture(key);
      this.placeCard(card, rect, i);
      card.name.setText(cardName(i, option));
      card.description.setText(option.description);
      card.level.setText(cardLevel(option));
      this.setCardVisible(card, true);
      card.icon.setVisible(key !== null);
    });
  }

  /** Recoloca velo y cartas visibles con el frame nuevo; no cambia la oferta ni el clic pendiente. */
  relayout(frame: ScreenFrame): void {
    const rescale = frame.uiScale !== this.frame.uiScale;
    this.frame = frame;
    this.placeVeil();
    if (rescale) this.applyScale();
    const rects = cardLayout(frame, this.shown);
    rects.forEach((rect, i) => {
      const card = this.cards[i];
      if (card) this.placeCard(card, rect, i);
    });
  }

  /** Índice de la carta clicada desde la última lectura (−1 si ninguna); lo consume. */
  takeClicked(): number {
    const i = this.clicked;
    this.clicked = -1;
    return i;
  }

  private placeVeil(): void {
    const v = veilLayout(this.frame);
    this.veil.setPosition(v.x, v.y);
    this.veil.setSize(v.width, v.height);
  }

  private applyScale(): void {
    const k = this.frame.uiScale;
    for (const card of this.cards) {
      for (const t of [card.name, card.description, card.level]) t.setFontSize(CARD_FONT_SIZE * k);
    }
  }

  private placeCard(card: CardParts, rect: CardRect, i: number): void {
    const k = this.frame.uiScale;
    const font = CARD_FONT_SIZE * k;
    const { wrapWidth } = cardTextLayout(rect, this.margins, k);
    const nameLines = wrapLines(this.names[i] ?? '', wrapWidth / (font * MONO_CHAR_RATIO));
    const t = cardContentLayout(rect, this.margins, k, nameLines);
    card.frame.place(rect, k);
    card.box.setPosition(rect.x, rect.y);
    card.box.setSize(rect.width, rect.height);
    for (const text of [card.name, card.description, card.level]) {
      text.setWordWrapWidth(t.wrapWidth);
    }
    card.icon.setPosition(t.icon.x, t.icon.top);
    card.icon.setDisplaySize(t.icon.size, t.icon.size);
    card.name.setPosition(t.x, t.nameTop);
    card.description.setPosition(t.x, t.descriptionTop);
    card.level.setPosition(t.x, t.levelBottom);
  }

  private setCardVisible(card: CardParts, visible: boolean): void {
    card.frame.setVisible(visible);
    card.box.setVisible(visible);
    card.name.setVisible(visible);
    card.description.setVisible(visible);
    card.level.setVisible(visible);
    // El icono lo enciende `sync` solo si hay textura; ocultar la carta siempre lo apaga.
    if (!visible) card.icon.setVisible(false);
  }
}
