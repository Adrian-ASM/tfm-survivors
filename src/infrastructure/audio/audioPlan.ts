import type { AudioContent } from '../content/audioSchema';
import { EFFECT_TYPES, type EffectType } from './effectTypes';

/**
 * Salida de audio de la carga (design 0035 D1): `muted` con `?e2e` (lógica entera, sin ficheros),
 * `unavailable` sin Web Audio (todo se descarta) y `web` con Phaser Sound.
 */
export type AudioMode = 'muted' | 'unavailable' | 'web';

/** Modo de audio: `?e2e` gana (salida muda, 0 ficheros); sin `AudioContext`, no disponible. */
export function audioMode(e2e: boolean, hasWebAudio: boolean): AudioMode {
  if (e2e) return 'muted';
  return hasWebAudio ? 'web' : 'unavailable';
}

/** `audio.noAudio` del motor: solo hay sistema de sonido de Phaser en modo `web` (D1). */
export const noAudio = (mode: AudioMode): boolean => mode !== 'web';

/** ¿Ofrece el navegador Web Audio? (`AudioContext` o `webkitAudioContext`). */
export function hasWebAudio(win: object): boolean {
  return 'AudioContext' in win || 'webkitAudioContext' in win;
}

/** Clave del audio en la caché del motor: una por fichero (dos tipos pueden compartirlo). */
export const audioKey = (file: string): string => `audio:${file}`;

/** Claves de la música y de cada tipo de efecto (`null` sin fichero: ese sonido no existe). */
export interface AudioKeys {
  readonly music: string | null;
  readonly effects: Readonly<Record<EffectType, string | null>>;
}

export function audioKeys(audio: AudioContent): AudioKeys {
  const effects = {} as Record<EffectType, string | null>;
  for (const t of EFFECT_TYPES) {
    const file = audio.effects[t].file;
    effects[t] = file === null ? null : audioKey(file);
  }
  return { music: audio.music.file === null ? null : audioKey(audio.music.file), effects };
}

/** Ficheros que pide `AudioLoadScene`: uno por fichero distinto, música primero, con su URL. */
export function audioFilesToLoad(
  audio: AudioContent,
  url: (file: string) => string,
): { readonly key: string; readonly url: string }[] {
  const files = [audio.music.file, ...EFFECT_TYPES.map((t) => audio.effects[t].file)];
  const seen = new Set<string>();
  const out: { key: string; url: string }[] = [];
  for (const file of files) {
    if (file === null || seen.has(file)) continue;
    seen.add(file);
    out.push({ key: audioKey(file), url: url(file) });
  }
  return out;
}

/** Estado de la carga del audio que comparte `AudioLoadScene` con la salida (sonda D12). */
export class AudioLoadStatus {
  requested = 0;
  readonly failed = new Set<string>();
}
