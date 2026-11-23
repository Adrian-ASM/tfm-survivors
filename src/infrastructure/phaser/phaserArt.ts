import Phaser from 'phaser';
import { PLACEHOLDER_SIZE, PLACEHOLDER_TEXTURE, type FrameCount } from './art/looks';
import type { SpriteKit } from './SpriteLike';
import type { TerrainCanvas } from './TerrainView';

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

/** Clave de la textura del mapa (una sola en el TextureManager global, change 0015). */
export const TERRAIN_TEXTURE = '__terrain';

/**
 * Textura del mapa (design 0015 §5): una CanvasTexture de `cols × rows` px (una celda = un píxel)
 * con filtro NEAREST, creada una vez en el TextureManager y reutilizada en cada entrada, y un
 * `Image` en (0, 0) escalado × `cellSize`, creado en este punto del orden de pintado. El motor
 * no la repinta por frame: solo `refresh()` sube los cambios, una vez por partida.
 */
export function terrainCanvas(
  scene: Phaser.Scene,
  cols: number,
  rows: number,
  cellSize: number,
): TerrainCanvas {
  const existing = scene.textures.exists(TERRAIN_TEXTURE)
    ? scene.textures.get(TERRAIN_TEXTURE)
    : null;
  const texture =
    existing instanceof Phaser.Textures.CanvasTexture
      ? existing
      : scene.textures.createCanvas(TERRAIN_TEXTURE, cols, rows);
  if (!texture) throw new Error('No se pudo crear la textura del mapa.');
  if (texture.width !== cols || texture.height !== rows) texture.setSize(cols, rows);
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  scene.add.image(0, 0, TERRAIN_TEXTURE).setOrigin(0, 0).setScale(cellSize);
  const ctx = texture.context;
  return {
    clear: () => {
      ctx.clearRect(0, 0, cols, rows);
    },
    fill: (col, row, color) => {
      ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
      ctx.fillRect(col, row, 1, 1);
    },
    refresh: () => {
      texture.refresh();
      // En 4.2.1 `refresh` vuelve a subir el canvas con el filtro del renderer (LINEAR con
      // antialias: WebGLRenderer.canvasToTexture), así que NEAREST se reaplica tras cada subida.
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    },
  };
}
