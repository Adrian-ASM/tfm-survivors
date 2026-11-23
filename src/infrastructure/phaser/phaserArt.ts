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

/**
 * Pintado del mapa (change 0015, incidente de fps del PR #36): un `Layer` creado en este punto del
 * orden de pintado (encima del suelo, debajo del resto) con un `Rectangle` relleno por tramo de
 * celdas no-hierba. Solo se rellena el área de esas celdas; la hierba no añade nada. Los
 * rectángulos se reutilizan entre partidas (R): `clear` los oculta y `rect` coloca el siguiente.
 */
export function terrainCanvas(scene: Phaser.Scene): TerrainCanvas {
  const layer = scene.add.layer();
  const pool: Phaser.GameObjects.Rectangle[] = [];
  let used = 0;
  return {
    clear: () => {
      for (const r of pool) r.setVisible(false);
      used = 0;
    },
    rect: (x, y, width, height, color) => {
      let r = pool[used];
      if (!r) {
        r = scene.add.rectangle(0, 0, 1, 1, color).setOrigin(0, 0);
        layer.add(r);
        pool.push(r);
      }
      r.setPosition(x, y).setSize(width, height).setFillStyle(color).setVisible(true);
      used += 1;
    },
  };
}
