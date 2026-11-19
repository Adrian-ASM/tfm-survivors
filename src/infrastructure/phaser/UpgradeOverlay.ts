import type { OfferSnapshot } from '../../domain/run/RunSnapshot';
import { cardLayout } from './cardLayout';

/**
 * Lo mínimo que el overlay necesita del motor (`Rectangle` y `Text` de Phaser, con un adaptador
 * para el puntero): costuras de testabilidad dentro de infraestructura, no puertos de dominio.
 */
export interface OverlayPart {
  setVisible(visible: boolean): unknown;
  setPosition(x: number, y: number): unknown;
}
export interface CardText extends OverlayPart {
  setText(text: string): unknown;
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

/** Separación vertical de los textos dentro de la carta (presentación). */
const NAME_DY = -55;
const DESCRIPTION_DY = -20;
const LEVEL_DY = 55;

const keyOf = (offer: readonly OfferSnapshot[]): string =>
  offer.map((o) => `${o.id}:${String(o.level)}`).join('|');

/**
 * Overlay de elección (spec upgrades): velo y una carta por opción, en el orden de la oferta.
 * Las cartas se crean una vez fuera (preasignadas); aquí solo se colocan, se muestran u ocultan y
 * se rellenan sus textos cuando cambia la oferta. Un clic en una carta visible guarda su índice
 * para que la escena lo lea con `takeClicked`. No elige nada por sí mismo.
 */
export class UpgradeOverlay {
  private key = '';
  private shown = 0;
  private clicked = -1;

  constructor(
    private readonly veil: OverlayPart,
    private readonly cards: readonly CardParts[],
    private readonly view: { readonly width: number; readonly height: number },
  ) {
    veil.setVisible(false);
    cards.forEach((card, i) => {
      card.box.onPointerDown(() => {
        if (i < this.shown) this.clicked = i;
      });
      this.setCardVisible(card, false);
    });
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
    const rects = cardLayout(this.view, this.shown);
    this.cards.forEach((card, i) => {
      const option = offer[i];
      const rect = rects[i];
      if (!option || !rect) {
        this.setCardVisible(card, false);
        return;
      }
      card.box.setPosition(rect.x, rect.y);
      card.box.setSize(rect.width, rect.height);
      card.name.setPosition(rect.x, rect.y + NAME_DY);
      card.description.setPosition(rect.x, rect.y + DESCRIPTION_DY);
      card.level.setPosition(rect.x, rect.y + LEVEL_DY);
      card.name.setText(`[${String(i + 1)}] ${option.name}`);
      card.description.setText(option.description);
      card.level.setText(`Nv ${String(option.level)} → ${String(option.nextLevel)}`);
      this.setCardVisible(card, true);
    });
  }

  /** Índice de la carta clicada desde la última lectura (−1 si ninguna); lo consume. */
  takeClicked(): number {
    const i = this.clicked;
    this.clicked = -1;
    return i;
  }

  private setCardVisible(card: CardParts, visible: boolean): void {
    card.box.setVisible(visible);
    card.name.setVisible(visible);
    card.description.setVisible(visible);
    card.level.setVisible(visible);
  }
}
