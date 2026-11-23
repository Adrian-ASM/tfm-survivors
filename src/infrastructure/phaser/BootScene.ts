import Phaser from 'phaser';
import type { Appearance } from '../content/appearanceSchema';
import {
  addBridgeFrames,
  imagesToLoad,
  nextSceneKey,
  sheetsToLoad,
  type TextureBook,
} from './bootPlan';
import { ensurePlaceholderTexture } from './phaserArt';
import { BOOT_SCENE_KEY } from './sceneKeys';

export interface BootSceneDeps {
  readonly appearance: Appearance;
  /** URL de una hoja (`BASE_URL` + `assets/tiny-swords/` + `file`), la compone la composición. */
  readonly assetUrl: (file: string) => string;
  readonly e2e: boolean;
}

/**
 * Escena técnica previa (design D3, ADR-0011 sin cambios de modo): carga cada hoja una vez, genera
 * el disco de reserva y arranca el menú o, con `?e2e`, la partida. Una hoja que no carga solo se
 * anota en `failed`: su aspecto usará la reserva. Volver al menú no pasa por aquí.
 */
export class BootScene extends Phaser.Scene {
  /** Claves de las hojas que no han cargado (para diagnóstico; no lanza). */
  readonly failed: string[] = [];

  constructor(private readonly deps: BootSceneDeps) {
    super(BOOT_SCENE_KEY);
  }

  preload(): void {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      this.failed.push(file.key);
    });
    for (const sheet of sheetsToLoad(this.deps.appearance)) {
      this.load.spritesheet(sheet.key, this.deps.assetUrl(sheet.file), {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
    }
    for (const image of imagesToLoad(this.deps.appearance)) {
      this.load.image(image.key, this.deps.assetUrl(image.file));
    }
  }

  create(): void {
    ensurePlaceholderTexture(this);
    // Marcos con nombre del puente (0016): una vez, en la textura global, si caben en la imagen.
    addBridgeFrames(textureBook(this), this.deps.appearance);
    this.scene.start(nextSceneKey(this.deps.e2e));
  }
}

/** Las texturas del motor como `TextureBook` (`Texture.add` devuelve null si el nombre existe). */
function textureBook(scene: Phaser.Scene): TextureBook {
  const textures = scene.textures;
  return {
    size: (key) => {
      if (!textures.exists(key)) return null;
      const source = textures.get(key).source[0];
      return source ? { width: source.width, height: source.height } : null;
    },
    add: (key, name, r) => {
      textures.get(key).add(name, 0, r.x, r.y, r.width, r.height);
    },
  };
}
