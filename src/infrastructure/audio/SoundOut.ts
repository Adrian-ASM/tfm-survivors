import type { EffectType } from './effectTypes';
import type { MixerOut } from './EffectMixer';
import type { MusicState } from './musicState';

export type { MusicState };

/**
 * Salida de audio (design 0035 D1): Phaser Sound en el navegador, una muda con `?e2e` y una no
 * disponible sin Web Audio. Ninguna operación lanza.
 */
export interface SoundOut extends MixerOut {
  /** Efectos sonando ahora. */
  readonly sounding: number;
  /** Algún fichero de audio cargado. */
  readonly loaded: boolean;
  /** Ficheros de audio pedidos a la red en la carga. */
  readonly filesRequested: number;
  /** El tipo se puede reproducir: fichero cargado, motor desbloqueado y Web Audio. */
  canPlay(type: EffectType): boolean;
  /** Reproduce un efecto con su volumen efectivo (efectos × ganancia). */
  play(type: EffectType, volume: number): void;
  /** Lleva la música al estado dado con su volumen efectivo; idempotente. */
  music(state: MusicState, volume: number): void;
  /** Vuelve la música a la posición 0 (partida nueva). */
  restartMusic(): void;
  /** Corta los efectos que suenan. */
  stopEffects(): void;
  /** Volumen efectivo de efectos (sin ganancia) para los que suenan: cada uno × su ganancia. */
  setEffectsVolume(volume: number): void;
}

/**
 * Salida muda de `?e2e` (design D1, spec D8): todo se puede reproducir y se entrega, pero no suena
 * nada; 0 efectos sonando y 0 ficheros pedidos.
 */
export function mutedSoundOut(): SoundOut {
  return {
    sounding: 0,
    loaded: false,
    filesRequested: 0,
    canPlay: () => true,
    play: () => undefined,
    music: () => undefined,
    restartMusic: () => undefined,
    stopEffects: () => undefined,
    setEffectsVolume: () => undefined,
  };
}

/** Salida sin Web Audio (design D1): nada se puede reproducir, así que todo se descarta. */
export function unavailableSoundOut(): SoundOut {
  return { ...mutedSoundOut(), canPlay: () => false };
}
