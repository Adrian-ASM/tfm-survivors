import type { RunSnapshot } from '../domain/run/RunSnapshot';
import { AudioCues } from '../infrastructure/audio/audioCues';
import {
  AudioDirector,
  type AudioScreen,
  type AudioView,
} from '../infrastructure/audio/AudioDirector';
import { audioKeys, type AudioLoadStatus, type AudioMode } from '../infrastructure/audio/audioPlan';
import { EffectMixer } from '../infrastructure/audio/EffectMixer';
import {
  PhaserSoundOut,
  type EngineAudioCache,
  type EngineSoundManager,
} from '../infrastructure/audio/PhaserSoundOut';
import {
  mutedSoundOut,
  unavailableSoundOut,
  type SoundOut,
} from '../infrastructure/audio/SoundOut';
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

/** Lo que el cableado del audio usa del juego del motor (`Phaser.Game`, Phaser 4.2.1). */
export interface AudioGame {
  readonly events: { on(event: string, fn: () => void): unknown };
  /** Gestor de sonido: con `noAudio`, el mudo del motor (no se usa). */
  readonly sound: EngineSoundManager & { pauseOnBlur: boolean };
  readonly cache: { readonly audio: EngineAudioCache };
}

/** Nombres de los eventos del juego que escucha el audio (`Phaser.Core.Events`). */
export interface AudioGameEvents {
  readonly hidden: string;
  readonly visible: string;
  readonly preStep: string;
}

export interface AudioPlaybackEnv {
  readonly mode: AudioMode;
  readonly game: AudioGame;
  readonly events: AudioGameEvents;
  /** Pedidos y fallidos de `AudioLoadScene` (0 pedidos sin modo `web`). */
  readonly status: AudioLoadStatus;
  /** Tope de flechas de torre del contenido de obra (buffer de `AudioCues`). */
  readonly maxTowerProjectiles: number;
  /** Retención de 0033 (aviso de orientación); sin modo móvil, nunca. */
  readonly hold?: () => boolean;
}

/** Lo que la composición conecta a la escena y a la sonda (design D6 y D12). */
export interface AudioPlayback {
  /** Partida nueva: Jugar, R, ↻ o el arranque con `?e2e` (callback `started`). */
  newRun(): void;
  /** Pantalla del frame (`onScreen`) o el menú. */
  screen(name: AudioScreen): void;
  /** Cada snapshot pintado con su reloj de render (cuarto argumento de `onRender`). */
  render(snapshot: RunSnapshot, renderMs: number): void;
  /** Sonda `window.__sprint.audio`. */
  view(): AudioView;
}

/** Salida de audio del modo de la carga (design D1). */
function soundOutFor(audio: AudioContent, env: AudioPlaybackEnv): SoundOut {
  if (env.mode === 'muted') return mutedSoundOut();
  if (env.mode === 'unavailable') return unavailableSoundOut();
  // La spec pide pausa con la pestaña oculta, no con la ventana sin foco (D1, D6).
  env.game.sound.pauseOnBlur = false;
  return new PhaserSoundOut(
    env.game.sound,
    env.game.cache.audio,
    audioKeys(audio),
    audio.effects,
    audio.maxVoices,
    env.status,
  );
}

/**
 * Reproducción del audio (0035, design D1, D6 y D12): elige la salida (Phaser Sound, muda con
 * `?e2e` o no disponible), crea director, peticiones y mezclador, aplica cada cambio de ajustes al
 * instante, escucha la pestaña oculta y consume M y el botón táctil una vez por frame del juego.
 */
export function wireAudioPlayback(
  audio: AudioContent,
  controls: AudioControls,
  env: AudioPlaybackEnv,
): AudioPlayback {
  const out = soundOutFor(audio, env);
  const mixer = new EffectMixer(audio.effects, audio.maxVoices, out);
  const cues = new AudioCues({
    towerMatchPx: audio.towerMatchPx,
    maxTowerProjectiles: env.maxTowerProjectiles,
  });
  const director = new AudioDirector({ out, cues, mixer, settings: controls.store.settings });
  controls.store.subscribe((s) => {
    director.setSettings(s);
  });
  env.game.events.on(env.events.hidden, () => {
    director.setHidden(true);
  });
  env.game.events.on(env.events.visible, () => {
    director.setHidden(false);
  });
  env.game.events.on(env.events.preStep, () => {
    controls.frame();
  });
  return {
    newRun: () => {
      director.newRun();
    },
    screen: (name) => {
      director.screen(name);
    },
    render: (snapshot, renderMs) => {
      director.frame(snapshot, renderMs, env.hold?.() ?? false);
    },
    view: () => director.view(),
  };
}

/** Publica la sonda E2E solo con `?e2e` (spec main-menu, "Sin sonda fuera de E2E"). */
export function exposeProbe(target: object, e2e: boolean, probe: object): void {
  if (e2e) Object.defineProperty(target, '__sprint', { value: probe });
}
