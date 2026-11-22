import type { SpriteKit, SpriteLike, TintModes } from '../../src/infrastructure/phaser/SpriteLike';

/** Modos de tinte de prueba (en el motor, `Phaser.TintModes`). */
export const FAKE_TINT: TintModes = { multiply: 0, fill: 1 };

/** Doble de un sprite del motor: guarda su último estado y cuenta las llamadas que cambian algo. */
export class FakeSprite implements SpriteLike {
  x = 0;
  y = 0;
  visible = true;
  texture = '';
  frame = -1;
  scale = 1;
  originX = 0.5;
  originY = 0.5;
  flipX = false;
  rotation = 0;
  tint = 0xffffff;
  tintMode = FAKE_TINT.multiply;
  frameSets = 0;
  tintSets = 0;

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }
  setTexture(key: string, frame?: number): this {
    this.texture = key;
    if (frame !== undefined) this.frame = frame;
    return this;
  }
  setFrame(frame: number): this {
    this.frame = frame;
    this.frameSets += 1;
    return this;
  }
  setScale(scale: number): this {
    this.scale = scale;
    return this;
  }
  setOrigin(x: number, y: number): this {
    this.originX = x;
    this.originY = y;
    return this;
  }
  setFlipX(flip: boolean): this {
    this.flipX = flip;
    return this;
  }
  setRotation(rotation: number): this {
    this.rotation = rotation;
    return this;
  }
  setTint(color: number): this {
    this.tint = color;
    this.tintSets += 1;
    return this;
  }
  setTintMode(mode: number): this {
    this.tintMode = mode;
    return this;
  }

  /** Esquina superior izquierda del sprite en pantalla para un frame de `w` × `h` px. */
  topLeft(w: number, h: number): { x: number; y: number } {
    return { x: this.x - this.originX * w * this.scale, y: this.y - this.originY * h * this.scale };
  }
}

/** Kit de prueba: crea `FakeSprite` y los guarda en orden de creación. */
export function fakeKit(): SpriteKit & { readonly created: FakeSprite[] } {
  const created: FakeSprite[] = [];
  return {
    created,
    tint: FAKE_TINT,
    create: () => {
      const s = new FakeSprite();
      created.push(s);
      return s;
    },
  };
}
