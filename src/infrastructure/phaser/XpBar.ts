import type { ProgressionSnapshot } from '../../domain/run/RunSnapshot';
import { xpBarFill } from './xpBarFill';

/**
 * Lo mínimo que la barra necesita del motor (`Phaser.GameObjects.Rectangle` y `Text` lo cumplen):
 * costuras de testabilidad dentro de infraestructura, no puertos de dominio.
 */
export interface BarSprite {
  setSize(width: number, height: number): unknown;
}
export interface LabelSprite {
  setText(text: string): unknown;
}

/** Texto del nivel en la vista. */
export const levelLabel = (level: number): string => `Nv ${String(level)}`;

/**
 * Barra de XP y nivel (spec leveling): solo depende del último snapshot. Los objetos del motor se
 * crean una vez fuera; aquí solo se redimensiona el relleno y se cambia el texto si los valores
 * cambian (nada por frame en régimen).
 */
export class XpBar {
  private fillWidth = -1;
  private level = -1;
  private last: ProgressionSnapshot | null = null;

  constructor(
    private readonly fill: BarSprite,
    private readonly label: LabelSprite,
    private width: number,
    private height: number,
  ) {}

  /** Nuevo tamaño de barra (0017, RESIZE): invalida la caché del relleno y lo vuelve a pintar. */
  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.fillWidth = -1;
    if (this.last) this.sync(this.last);
  }

  sync(p: ProgressionSnapshot): void {
    this.last = p;
    const w = this.width * xpBarFill(p.xp, p.xpToNext);
    if (w !== this.fillWidth) {
      this.fillWidth = w;
      this.fill.setSize(w, this.height);
    }
    if (p.level !== this.level) {
      this.level = p.level;
      this.label.setText(levelLabel(p.level));
    }
  }
}
