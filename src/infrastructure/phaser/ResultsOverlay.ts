import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import { resultsView, type ResultsView } from './resultsText';

/** Lo mínimo que el overlay necesita del motor (`Rectangle` y `Text` de Phaser lo cumplen). */
export interface Showable {
  setVisible(visible: boolean): unknown;
}
export interface ShowableText extends Showable {
  setText(text: string): unknown;
}
export interface ResultsTexts {
  readonly title: ShowableText;
  readonly time: ShowableText;
  readonly level: ShowableText;
  readonly kills: ShowableText;
  readonly hint: ShowableText;
}

const keyOf = (s: RunSnapshot): string =>
  s.status === 'over' ? `${s.outcome}:${String(s.tick)}` : '';

/**
 * Overlay de resultados (spec run-results): visible si y solo si el último snapshot pintado está
 * terminado. Los objetos se crean una vez fuera; aquí solo se muestran, ocultan y rellenan cuando
 * cambia la clave (resultado + tick), no por frame.
 */
export class ResultsOverlay {
  private key: string | null = null;
  private shown: ResultsView | null = null;

  constructor(
    private readonly veil: Showable,
    private readonly texts: ResultsTexts,
  ) {
    this.setVisible(false);
  }

  /** Lo que se está mostrando (`null` si está oculto). */
  get view(): ResultsView | null {
    return this.shown;
  }

  sync(s: RunSnapshot): void {
    const key = keyOf(s);
    if (key === this.key) return;
    this.key = key;
    this.shown = resultsView(s);
    if (this.shown) {
      const { title, time, level, kills, hint } = this.shown;
      this.texts.title.setText(title);
      this.texts.time.setText(`Tiempo: ${time}`);
      this.texts.level.setText(`Nivel: ${String(level)}`);
      this.texts.kills.setText(`Bajas: ${String(kills)}`);
      this.texts.hint.setText(hint);
    }
    this.setVisible(this.shown !== null);
  }

  private setVisible(visible: boolean): void {
    this.veil.setVisible(visible);
    const { title, time, level, kills, hint } = this.texts;
    for (const t of [title, time, level, kills, hint]) t.setVisible(visible);
  }
}
