import Phaser from 'phaser';
import type { Appearance } from '../content/appearanceSchema';
import {
  addBridgeFrames,
  applyNearest,
  finishBoot,
  iconImagesOf,
  imagesToLoad,
  uiImagesOf,
  nextSceneKey,
  sheetsToLoad,
  type FilterBook,
  type TextureBook,
} from './bootPlan';
import { launchAudioLoad } from './AudioLoadScene';
import { ensurePlaceholderTexture } from './phaserArt';
import { BOOT_SCENE_KEY } from './sceneKeys';

export interface BootSceneDeps {
  readonly appearance: Appearance;
  /** URL de una hoja (`BASE_URL` + `assets/tiny-swords/` + `file`), la compone la composición. */
  readonly assetUrl: (file: string) => string;
  readonly e2e: boolean;
  /**
   * Fuente de la interfaz (0032): `true` si cargó, ya con su plazo de `FONT_WAIT_MS`. Sin ella (los
   * tests de antes) se arranca como siempre, sin esperar.
   */
  readonly fontReady?: Promise<boolean>;
  /** Avisa de las piezas de UI cuya textura existe (la composición publica las variables CSS). */
  readonly onUiLoaded?: (loaded: ReadonlySet<string>) => void;
  /**
   * URL de un icono de mejora (0034: BASE_URL + assets/icons/ + file). Sin ella no se piden iconos
   * (todos quedan en none).
   */
  readonly iconUrl?: (file: string) => string;
  /** Avisa de las claves de icono cuya textura existe (rellena el IconBook de la composición). */
  readonly onIconsLoaded?: (loaded: ReadonlySet<string>) => void;
  /**
   * Lanza `AudioLoadScene` en paralelo antes del menú (0035, design D8): solo sin `?e2e` y con Web
   * Audio. El menú no la espera.
   */
  readonly launchAudio?: boolean;
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
    // Iconos de mejora (0034): un fallo solo se anota en failed; no es reserva de ningún sprite.
    const iconUrl = this.deps.iconUrl;
    if (iconUrl) {
      for (const icon of iconImagesOf(this.deps.appearance)) {
        this.load.image(icon.key, iconUrl(icon.file));
      }
    }
  }

  create(): void {
    ensurePlaceholderTexture(this);
    // Marcos con nombre del puente (0016): una vez, en la textura global, si caben en la imagen.
    addBridgeFrames(textureBook(this), this.deps.appearance);
    // Piezas de UI (0032) e iconos (0034): pixel art sin suavizar a cualquier escala.
    const filters = filterBook(this);
    const uiKeys = uiImagesOf(this.deps.appearance).map((i) => i.key);
    applyNearest(filters, uiKeys);
    if (this.deps.iconUrl) {
      const iconKeys = iconImagesOf(this.deps.appearance).map((i) => i.key);
      this.deps.onIconsLoaded?.(applyNearest(filters, iconKeys));
    }
    // Audio (0035): carga aparte y en paralelo; no retrasa el menú ni Jugar.
    launchAudioLoad(this.scene, this.deps.launchAudio ?? false);
    // El menú (o la partida) nace tras la fuente o su plazo: los Text de cartas y HUD ya la usan.
    void finishBoot({
      fontReady: this.deps.fontReady ?? Promise.resolve(true),
      fontFamily: this.deps.appearance.ui.font.family,
      uiKeys,
      exists: (key) => this.textures.exists(key),
      fail: (key) => {
        this.failed.push(key);
      },
      onUiLoaded: (loaded) => {
        this.deps.onUiLoaded?.(loaded);
      },
      start: () => {
        this.scene.start(nextSceneKey(this.deps.e2e));
      },
    });
  }
}

/** Las texturas del motor como `FilterBook` (filtro NEAREST de toda la textura). */
function filterBook(scene: Phaser.Scene): FilterBook {
  const textures = scene.textures;
  return {
    exists: (key) => textures.exists(key),
    setNearest: (key) => {
      textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    },
  };
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
