import { lookOrigin, lookScale, type LookBase } from './art/looks';

/**
 * Lo mínimo que las capas necesitan de un sprite del motor (`Phaser.GameObjects.Sprite` lo cumple).
 * Costura de testabilidad dentro de infraestructura, no un puerto de dominio (sustituye a
 * `CircleSprite`, change 0012).
 */
export interface SpriteLike {
  setPosition(x: number, y: number): unknown;
  setVisible(visible: boolean): unknown;
  setTexture(key: string, frame?: number): unknown;
  setFrame(frame: number): unknown;
  setScale(scale: number): unknown;
  setOrigin(x: number, y: number): unknown;
  setFlipX(flip: boolean): unknown;
  setRotation(rotation: number): unknown;
  setTint(color: number): unknown;
  setTintMode(mode: number): unknown;
}

/** Valores de `Phaser.TintModes` que usan las capas, inyectados para probar sin motor. */
export interface TintModes {
  readonly multiply: number;
  readonly fill: number;
}

/** Fábrica de sprites del motor (ocultos) y sus modos de tinte. */
export interface SpriteKit {
  create(): SpriteLike;
  readonly tint: TintModes;
}

/** Tinte neutro: con `MULTIPLY` deja el arte como está; con `FILL`, silueta blanca (destello). */
export const WHITE = 0xffffff;

/**
 * Sprite con su último estado aplicado: cada `set*` del motor solo se llama cuando cambia
 * (design "Rendimiento"). Sin asignaciones por frame.
 */
export class PaintedSprite {
  private texture = '';
  private frame = -1;
  private scale = Number.NaN;
  private originX = Number.NaN;
  private originY = Number.NaN;
  private flip = false;
  private rotation = 0;
  private tint = -1;
  private tintMode = -1;
  private shown = false;

  constructor(
    readonly sprite: SpriteLike,
    private readonly modes: TintModes,
  ) {
    sprite.setVisible(false);
  }

  get visible(): boolean {
    return this.shown;
  }

  /** Hoja, escala y origen del aspecto (en reserva, escala por radio y sin volteo). */
  look(look: LookBase, radius: number): this {
    if (this.texture !== look.texture) {
      this.texture = look.texture;
      this.frame = -1;
      this.sprite.setTexture(look.texture);
    }
    const scale = lookScale(look, radius);
    if (scale !== this.scale) this.sprite.setScale((this.scale = scale));
    const origin = lookOrigin(look);
    if (origin.x !== this.originX || origin.y !== this.originY) {
      this.originX = origin.x;
      this.originY = origin.y;
      this.sprite.setOrigin(origin.x, origin.y);
    }
    return this;
  }

  /** Frame de hoja (no aplica a la reserva, que tiene un solo frame). */
  setFrame(look: LookBase, frame: number): this {
    if (look.placeholder || frame === this.frame) return this;
    this.frame = frame;
    this.sprite.setFrame(frame);
    return this;
  }

  setFlip(flip: boolean): this {
    if (flip !== this.flip) this.sprite.setFlipX((this.flip = flip));
    return this;
  }

  setRotation(rotation: number): this {
    if (rotation !== this.rotation) this.sprite.setRotation((this.rotation = rotation));
    return this;
  }

  /** Normal (`MULTIPLY`, blanco o el color de reserva) o destello (`FILL` blanco). */
  paint(look: LookBase, flash: boolean): this {
    const color = flash || !look.placeholder ? WHITE : look.color;
    const mode = flash ? this.modes.fill : this.modes.multiply;
    if (color !== this.tint) this.sprite.setTint((this.tint = color));
    if (mode !== this.tintMode) this.sprite.setTintMode((this.tintMode = mode));
    return this;
  }

  at(x: number, y: number): this {
    this.sprite.setPosition(x, y);
    return this;
  }

  show(visible: boolean): this {
    if (visible !== this.shown) this.sprite.setVisible((this.shown = visible));
    return this;
  }
}
