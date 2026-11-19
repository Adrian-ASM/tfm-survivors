import type { BarSprite, LabelSprite } from '../../src/infrastructure/phaser/XpBar';

/** Doble de barra: guarda el último tamaño y cuenta los cambios. */
export class FakeBar implements BarSprite {
  width = -1;
  height = -1;
  resizes = 0;
  setSize(width: number, height: number): this {
    this.width = width;
    this.height = height;
    this.resizes += 1;
    return this;
  }
}

/** Doble de texto: guarda el último texto y cuenta las escrituras. */
export class FakeLabel implements LabelSprite {
  text = '';
  writes = 0;
  setText(text: string): this {
    this.text = text;
    this.writes += 1;
    return this;
  }
}

/** Doble de objeto que se muestra u oculta (velo y textos de un overlay). */
export class FakeVisible {
  visible = false;
  toggles = 0;
  setVisible(visible: boolean): this {
    this.visible = visible;
    this.toggles += 1;
    return this;
  }
}
