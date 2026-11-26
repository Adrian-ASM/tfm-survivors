import { AudioSettingsStore } from '../infrastructure/audio/AudioSettingsStore';
import {
  LocalStorageAudioSettingsRepository,
  type AudioSettingsStorage,
} from '../infrastructure/audio/LocalStorageAudioSettingsRepository';
import { MuteRequests, applyMute } from '../infrastructure/audio/MuteRequests';
import type { AudioContent } from '../infrastructure/content/audioSchema';
import { listenMuteKey, type KeyTarget } from '../infrastructure/dom/MuteKey';
import { SoundPanel } from '../infrastructure/dom/SoundPanel';

/** Lo que el cableado de los controles de audio necesita de la página (costuras para los tests). */
export interface AudioControlsEnv {
  readonly doc: Document;
  /** Contenedor `#game`: el panel Sonido va dentro, junto a los demás paneles. */
  readonly root: HTMLElement;
  /** `window.localStorage` (acceder puede lanzar). */
  readonly storage: () => AudioSettingsStorage;
  readonly warn: (message: string) => void;
  /** Dónde se escucha la tecla M (el documento). */
  readonly keys: KeyTarget;
}

/** Ajustes, panel Sonido y peticiones de silencio de la carga (0035, design D9–D11). */
export interface AudioControls {
  readonly store: AudioSettingsStore;
  readonly panel: SoundPanel;
  readonly requests: MuteRequests;
  /** Una vez por frame del juego (`PRE_STEP`): M o el botón táctil ⇒ 1 cambio de silencio. */
  frame(): void;
}

/**
 * Controles de audio (0035): carga los ajustes una vez (por defecto los del contenido), crea el
 * panel Sonido compartido por el menú y la pausa y escucha la tecla M. Exportar, Importar y Borrar
 * datos no reciben nada de esto (spec audio, "Independiente del progreso").
 */
export function wireAudioControls(audio: AudioContent, env: AudioControlsEnv): AudioControls {
  const repo = new LocalStorageAudioSettingsRepository(env.storage);
  const store = new AudioSettingsStore(repo, audio.defaults, env.warn);
  const panel = new SoundPanel(env.doc, env.root, store);
  const requests = new MuteRequests();
  listenMuteKey(env.keys, requests);
  return {
    store,
    panel,
    requests,
    frame: () => {
      applyMute(requests, store);
    },
  };
}
