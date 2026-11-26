import Phaser from 'phaser';
import type { AudioLoadStatus } from '../audio/audioPlan';
import { AUDIO_LOAD_SCENE_KEY } from './sceneKeys';

export interface AudioLoadSceneDeps {
  /** Ficheros a pedir (clave de caché y URL), ya sin repetir. */
  readonly files: readonly { readonly key: string; readonly url: string }[];
  /** Pedidos y fallidos: lo leen la salida de audio y la sonda. */
  readonly status: AudioLoadStatus;
}

/**
 * Carga del audio en paralelo (design 0035 D8): escena técnica sin render que `BootScene` lanza
 * solo sin `?e2e` y con Web Audio, antes de arrancar el menú, que no la espera. Encola
 * `load.audio` (XHR + `decodeAudioData`, sin `blob:`: la CSP no cambia) y anota los ficheros que
 * fallan al cargar o decodificar, sin lanzar: ese sonido queda con `canPlay` falso.
 */
export class AudioLoadScene extends Phaser.Scene {
  constructor(private readonly deps: AudioLoadSceneDeps) {
    super({ key: AUDIO_LOAD_SCENE_KEY });
  }

  preload(): void {
    const { files, status } = this.deps;
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      status.failed.add(file.key);
    });
    for (const f of files) {
      this.load.audio(f.key, f.url);
      status.requested += 1;
    }
  }
}

/** Lanza la carga del audio en paralelo si toca (`BootScene.create`); no espera a que termine. */
export function launchAudioLoad(scenes: { launch(key: string): unknown }, on: boolean): void {
  if (on) scenes.launch(AUDIO_LOAD_SCENE_KEY);
}
