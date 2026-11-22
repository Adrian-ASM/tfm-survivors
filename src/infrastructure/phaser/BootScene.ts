import Phaser from 'phaser';
import type { Appearance } from '../content/appearanceSchema';
import { nextSceneKey, sheetsToLoad } from './bootPlan';
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
  }

  create(): void {
    ensurePlaceholderTexture(this);
    this.scene.start(nextSceneKey(this.deps.e2e));
  }
}
