import Phaser from 'phaser';
import { PLACEHOLDER_SIZE, PLACEHOLDER_TEXTURE, type FrameCount } from './art/looks';
import type { MapArtLayers } from './GroundView';
import type { HasFrame } from './map/mapLooks';
import type { SpriteKit } from './SpriteLike';
import type { MapArtCanvas } from './TerrainView';

/**
 * Disco blanco de reserva generado con la Canvas API del motor (sin ficheros ni `blob:`). Idempotente:
 * lo crea `BootScene` y, si una escena arranca sin ella, la propia escena.
 */
export function ensurePlaceholderTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(PLACEHOLDER_TEXTURE)) return;
  const half = PLACEHOLDER_SIZE / 2;
  const g = scene.make.graphics({}, false);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(half, half, half);
  g.generateTexture(PLACEHOLDER_TEXTURE, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE);
  g.destroy();
}

/** Frames de una hoja cargada (sin el `__BASE` que añade el motor) o `null` si no está. */
export function textureFrames(scene: Phaser.Scene): FrameCount {
  return (key) => (scene.textures.exists(key) ? scene.textures.get(key).frameTotal - 1 : null);
}

/** Sprites del motor, ocultos, en el orden de creación (= orden de pintado). */
export function spriteKit(scene: Phaser.Scene): SpriteKit {
  return {
    create: () => scene.add.sprite(0, 0, PLACEHOLDER_TEXTURE).setVisible(false),
    tint: { multiply: Phaser.TintModes.MULTIPLY, fill: Phaser.TintModes.FILL },
  };
}

/** Marcos con nombre de una textura cargada (marcos del puente, change 0016). */
export function textureHasFrame(scene: Phaser.Scene): HasFrame {
  return (key, name) => scene.textures.exists(key) && scene.textures.get(key).has(name);
}

/**
 * Objetos de un tipo dentro de un `Layer`, reutilizados entre partidas (R): `hide` los oculta y
 * `next` da el siguiente y lo lleva al final de la capa, de modo que el orden de pintado de lo
 * visible es el del plan aunque el objeto venga de una partida anterior.
 */
class LayerPool<T extends Phaser.GameObjects.GameObject & { setVisible(v: boolean): unknown }> {
  private readonly items: T[] = [];
  private used = 0;

  constructor(
    private readonly layer: Phaser.GameObjects.Layer,
    private readonly make: () => T,
  ) {}

  next(): T {
    let item = this.items[this.used];
    if (!item) {
      item = this.make();
      this.layer.add(item);
      this.items.push(item);
    }
    this.used += 1;
    this.layer.bringToTop(item);
    return item;
  }

  hide(): void {
    for (const item of this.items) item.setVisible(false);
    this.used = 0;
  }
}

/**
 * Pintado del mapa con arte (change 0016, design §5.4): un `Layer` bajo las entidades y otro sobre
 * ellas, creados en dos llamadas para rodear el orden de creación de `RenderLayers`. Solo objetos
 * del tamaño de lo que pintan (nada a pantalla completa: lección del PR #36), reutilizados entre
 * partidas. La espuma cambia de frame en tiempo de render y conserva su recorte.
 */
export function mapArtLayers(scene: Phaser.Scene): MapArtLayers {
  let low: Phaser.GameObjects.Layer | null = null;
  return {
    low: () => {
      low = scene.add.layer();
    },
    high: () => {
      const lowLayer = low ?? scene.add.layer();
      return mapArtCanvas(scene, lowLayer, scene.add.layer());
    },
  };
}

function mapArtCanvas(
  scene: Phaser.Scene,
  low: Phaser.GameObjects.Layer,
  high: Phaser.GameObjects.Layer,
): MapArtCanvas {
  const sprite = () => scene.add.sprite(0, 0, PLACEHOLDER_TEXTURE).setVisible(false);
  const tiles = new LayerPool(low, () =>
    scene.add.tileSprite(0, 0, 1, 1, PLACEHOLDER_TEXTURE).setOrigin(0, 0).setVisible(false),
  );
  const rects = new LayerPool(low, () =>
    scene.add.rectangle(0, 0, 1, 1, 0).setOrigin(0, 0).setVisible(false),
  );
  // 0022: círculos de reserva de las vetas (`Phaser.GameObjects.Arc`, `scene.add.circle`).
  const circles = new LayerPool(low, () => scene.add.circle(0, 0, 1, 0).setVisible(false));
  const sprites = { low: new LayerPool(low, sprite), high: new LayerPool(high, sprite) };
  /** Todas las espumas pintadas, visibles u ocultas por el recorte: siempre con el frame vigente. */
  const foams: Phaser.GameObjects.Sprite[] = [];
  /** Objetos del mapa pintado en orden de llamada: el índice de `show` (0018). */
  const painted: { setVisible(value: boolean): unknown }[] = [];
  return {
    clear: () => {
      tiles.hide();
      rects.hide();
      circles.hide();
      sprites.low.hide();
      sprites.high.hide();
      foams.length = 0;
      painted.length = 0;
    },
    tiles: (t) => {
      const obj = tiles
        .next()
        .setTexture(t.texture, t.frame)
        .setPosition(t.x, t.y)
        .setSize(t.width, t.height)
        .setTileScale(t.scale)
        .setTilePosition(0, 0)
        .setVisible(true);
      painted.push(obj);
    },
    sprite: (layer, s) => {
      const obj = sprites[layer]
        .next()
        .setTexture(s.texture, s.frame)
        .setPosition(s.x, s.y)
        .setScale(s.scale)
        .setOrigin(s.origin.x, s.origin.y)
        .setFlipX(s.flipX)
        .setVisible(true);
      if (s.crop) obj.setCrop(s.crop.x, s.crop.y, s.crop.width, s.crop.height);
      else obj.setCrop();
      if (s.role === 'foam') foams.push(obj);
      painted.push(obj);
    },
    rect: (r) => {
      const obj = rects
        .next()
        .setPosition(r.x, r.y)
        .setSize(r.width, r.height)
        .setFillStyle(r.color)
        .setVisible(true);
      painted.push(obj);
    },
    circle: (c) => {
      const obj = circles
        .next()
        .setPosition(c.x, c.y)
        .setRadius(c.radius)
        .setFillStyle(c.color)
        .setVisible(true);
      painted.push(obj);
    },
    foam: (frame) => {
      for (const f of foams) f.setFrame(frame);
    },
    show: (index, visible) => {
      painted[index]?.setVisible(visible);
    },
  };
}
