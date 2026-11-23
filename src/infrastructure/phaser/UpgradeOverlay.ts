import type { OfferSnapshot } from '../../domain/run/RunSnapshot';
import { CARD_FONT_SIZE, CARD_TEXT_WRAP, cardLayout, type CardRect } from './cardLayout';
import type { ScreenFrame } from './ui/screenFrame';
import { veilLayout } from './ui/uiLayout';

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
export interface CardParts {
  readonly box: CardBox;
  readonly name: CardText;
  readonly description: CardText;
  readonly level: CardText;
}

/** Separación vertical de los textos dentro de la carta a ×1 (presentación). */
const NAME_DY = -55;
const DESCRIPTION_DY = -20;
const LEVEL_DY = 55;

const keyOf = (offer: readonly OfferSnapshot[]): string =>
  offer.map((o) => `${o.id}:${String(o.level)}`).join('|');

/**
 * Overlay de elección (spec upgrades): velo y una carta por opción, en el orden de la oferta.
 * Las cartas se crean una vez fuera (preasignadas); aquí solo se colocan, se muestran u ocultan y
 * se rellenan sus textos cuando cambia la oferta. Un clic en una carta visible guarda su índice
 * para que la escena lo lea con `takeClicked`. No elige nada por sí mismo. `relayout` las vuelve a
 * colocar con el frame nuevo sin tocar la oferta (0017).
 */
export class UpgradeOverlay {
  private key = '';
  private shown = 0;
  private clicked = -1;
  private frame: ScreenFrame;

  constructor(
    private readonly veil: VeilPart,
    private readonly cards: readonly CardParts[],
    frame: ScreenFrame,
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

  sync(offer: readonly OfferSnapshot[]): void {
    const key = keyOf(offer);
    if (key === this.key) return;
    this.key = key;
    this.shown = Math.min(offer.length, this.cards.length);
    this.clicked = -1;
    this.veil.setVisible(this.shown > 0);
    const rects = cardLayout(this.frame, this.shown);
    this.cards.forEach((card, i) => {
      const option = offer[i];
      const rect = rects[i];
      if (!option || !rect) {
        this.setCardVisible(card, false);
        return;
      }
      this.placeCard(card, rect);
      card.name.setText(`[${String(i + 1)}] ${option.name}`);
      card.description.setText(option.description);
      card.level.setText(`Nv ${String(option.level)} → ${String(option.nextLevel)}`);
      this.setCardVisible(card, true);
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
      if (card) this.placeCard(card, rect);
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
      for (const t of [card.name, card.description, card.level]) {
        t.setFontSize(CARD_FONT_SIZE * k);
        t.setWordWrapWidth(CARD_TEXT_WRAP * k);
      }
    }
  }

  private placeCard(card: CardParts, rect: CardRect): void {
    const k = this.frame.uiScale;
    card.box.setPosition(rect.x, rect.y);
    card.box.setSize(rect.width, rect.height);
    card.name.setPosition(rect.x, rect.y + NAME_DY * k);
    card.description.setPosition(rect.x, rect.y + DESCRIPTION_DY * k);
    card.level.setPosition(rect.x, rect.y + LEVEL_DY * k);
  }

  private setCardVisible(card: CardParts, visible: boolean): void {
    card.box.setVisible(visible);
    card.name.setVisible(visible);
    card.description.setVisible(visible);
    card.level.setVisible(visible);
  }
}
