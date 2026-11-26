import type { SoundOut, MusicState } from '../../src/infrastructure/audio/SoundOut';
import { EFFECT_TYPES, type EffectType } from '../../src/infrastructure/audio/effectTypes';
import type { EffectRules } from '../../src/infrastructure/audio/EffectMixer';
import type { AudioContent } from '../../src/infrastructure/content/audioSchema';
import { parseAudio, soundPaths } from '../../src/infrastructure/content/loadAudio';
import audioJson from '../../content/audio.json';
import provenanceJson from '../../content/asset-provenance.json';

/** Contenido de audio del repositorio, validado y cruzado con la nota (0035). */
export function repositoryAudio(): AudioContent {
  const parsed = parseAudio(audioJson, soundPaths(provenanceJson));
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value;
}

/**
 * Salida de audio de prueba (0035): música con posición simulada por el reloj que avanza el test
 * (`advance`), en bucle con su duración, y efectos apuntados. `sounding` se fija desde el test;
 * `stopEffects` lo deja a 0.
 */
export class FakeSoundOut implements SoundOut {
  state: MusicState = 'stopped';
  musicVolume = 0;
  effectsVolume = 0;
  positionMs = 0;
  /** Músicas sonando a la vez (0 o 1: `music` es idempotente). */
  musicPlaying = 0;
  /** Órdenes de reproducción: arranques de música y efectos. */
  orders = 0;
  sounding = 0;
  loaded = true;
  filesRequested = 0;
  stopped = 0;
  readonly played: { type: EffectType; volume: number }[] = [];
  failing = new Set<EffectType>();

  constructor(private readonly durationMs = 180_000) {}

  canPlay(type: EffectType): boolean {
    return !this.failing.has(type);
  }

  play(type: EffectType, volume: number): void {
    this.orders += 1;
    this.played.push({ type, volume });
  }

  music(state: MusicState, volume: number): void {
    this.musicVolume = volume;
    if (state === this.state) return;
    if (state === 'playing') this.orders += 1;
    if (state === 'stopped') this.positionMs = 0;
    this.state = state;
    this.musicPlaying = state === 'playing' ? 1 : 0;
  }

  restartMusic(): void {
    this.positionMs = 0;
  }

  stopEffects(): void {
    this.stopped += 1;
    this.sounding = 0;
  }

  setEffectsVolume(volume: number): void {
    this.effectsVolume = volume;
  }

  /** Pasa `ms` de reloj: la música avanza solo si suena, en bucle. */
  advance(ms: number): void {
    if (this.state === 'playing') this.positionMs = (this.positionMs + ms) % this.durationMs;
  }
}

/** Reglas de efecto del contenido de escenario: prioridad 1, sin intervalo y ganancia 1. */
export function scenarioRules(
  over: Partial<Record<EffectType, Partial<EffectRules[EffectType]>>> = {},
): EffectRules {
  const out = {} as Record<EffectType, EffectRules[EffectType]>;
  for (const t of EFFECT_TYPES) out[t] = { priority: 1, minIntervalMs: 0, gain: 1, ...over[t] };
  return out;
}
