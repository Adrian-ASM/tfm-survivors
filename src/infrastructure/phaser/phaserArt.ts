import Phaser from 'phaser';
import { PLACEHOLDER_SIZE, PLACEHOLDER_TEXTURE, type FrameCount } from './art/looks';
import type { SpriteKit } from './SpriteLike';

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
