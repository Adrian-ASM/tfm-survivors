import type { AudioKeys, AudioLoadStatus } from './audioPlan';
import type { EffectRules } from './EffectMixer';
import { EFFECT_TYPES, type EffectType } from './effectTypes';
import type { MusicState } from './musicState';
import type { SoundOut } from './SoundOut';

/** Lo que se usa de un sonido del motor (`Phaser.Sound.WebAudioSound`, Phaser 4.2.1). */
export interface EngineSound {
  readonly isPlaying: boolean;
  readonly isPaused: boolean;
  play(config?: { readonly volume?: number; readonly loop?: boolean }): boolean;
  pause(): boolean;
  resume(): boolean;
  stop(): boolean;
  setVolume(value: number): unknown;
}

/** Lo que se usa del gestor de sonido (`this.sound` de una escena) y de la caché de audio. */
export interface EngineSoundManager {
  readonly locked: boolean;
  add(key: string, config?: { readonly loop?: boolean }): EngineSound;
}

export interface EngineAudioCache {
  exists(key: string): boolean;
}

interface Voice {
  readonly sound: EngineSound;
  readonly gain: number;
}

/**
 * Salida de audio sobre Phaser Sound (design 0035 D7). Cada tipo tiene un pool perezoso de hasta
 * `maxVoices` instancias (`sound.add`) y nunca crea objetos por frame una vez caliente: `play` usa
 * una libre o reinicia la más antigua. La música va en bucle (`loop: true`) y, si aún no ha cargado,
 * arranca en cuanto aparece en la caché con su estado en `playing`. `canPlay` es `!locked` y la
 * clave en caché (nunca llama a `add` con una clave ausente). Ninguna operación lanza.
 */
export class PhaserSoundOut implements SoundOut {
  private readonly pools = new Map<EffectType, Voice[]>();
  private readonly next = new Map<EffectType, number>();
  private musicSound: EngineSound | null = null;
  private wanted: MusicState = 'stopped';
  private musicVolume = 0;

  constructor(
    private readonly manager: EngineSoundManager,
    private readonly cache: EngineAudioCache,
    private readonly keys: AudioKeys,
    private readonly rules: EffectRules,
    private readonly maxVoices: number,
    private readonly status: AudioLoadStatus,
  ) {}

  get sounding(): number {
    let n = 0;
    for (const pool of this.pools.values()) for (const v of pool) if (v.sound.isPlaying) n += 1;
    return n;
  }

  get loaded(): boolean {
    const all = [this.keys.music, ...EFFECT_TYPES.map((t) => this.keys.effects[t])];
    return all.some((k) => k !== null && this.cache.exists(k));
  }

  get filesRequested(): number {
    return this.status.requested;
  }

  canPlay(type: EffectType): boolean {
    const key = this.keys.effects[type];
    return key !== null && !this.manager.locked && this.cached(key);
  }

  play(type: EffectType, volume: number): void {
    const key = this.keys.effects[type];
    if (key === null || !this.canPlay(type)) return;
    this.safely(() => {
      const voice = this.voiceFor(type, key);
      if (voice.sound.isPlaying || voice.sound.isPaused) voice.sound.stop();
      voice.sound.play({ volume });
    });
  }

  music(state: MusicState, volume: number): void {
    this.wanted = state;
    this.safely(() => {
      if (volume !== this.musicVolume) {
        this.musicVolume = volume;
        this.musicSound?.setVolume(volume);
      }
      this.applyMusic();
    });
  }

  restartMusic(): void {
    this.safely(() => {
      this.musicSound?.stop();
    });
  }

  stopEffects(): void {
    this.safely(() => {
      for (const pool of this.pools.values()) for (const v of pool) v.sound.stop();
    });
  }

  setEffectsVolume(volume: number): void {
    this.safely(() => {
      for (const pool of this.pools.values()) {
        for (const v of pool) if (v.sound.isPlaying) v.sound.setVolume(volume * v.gain);
      }
    });
  }

  private applyMusic(): void {
    const s = this.musicSound ?? this.createMusic();
    if (!s) return;
    if (this.wanted === 'stopped') {
      if (s.isPlaying || s.isPaused) s.stop();
    } else if (this.wanted === 'paused') {
      if (s.isPlaying) s.pause();
    } else if (s.isPaused) {
      s.resume();
    } else if (!s.isPlaying) {
      s.play({ volume: this.musicVolume, loop: true });
    }
  }

  /** La instancia de la música, solo cuando hay que sonar y la clave ya está en caché. */
  private createMusic(): EngineSound | null {
    const key = this.keys.music;
    if (key === null || this.wanted !== 'playing' || !this.cached(key)) return null;
    this.musicSound = this.manager.add(key, { loop: true });
    return this.musicSound;
  }

  private voiceFor(type: EffectType, key: string): Voice {
    const pool = this.pools.get(type) ?? [];
    this.pools.set(type, pool);
    const free = pool.find((v) => !v.sound.isPlaying && !v.sound.isPaused);
    if (free) return free;
    if (pool.length < this.maxVoices) {
      const voice = { sound: this.manager.add(key), gain: this.rules[type].gain };
      pool.push(voice);
      return voice;
    }
    // Todas ocupadas: reinicia la más antigua (turno circular).
    const i = (this.next.get(type) ?? 0) % pool.length;
    this.next.set(type, i + 1);
    return pool[i] as Voice;
  }

  private cached(key: string): boolean {
    return !this.status.failed.has(key) && this.cache.exists(key);
  }

  /** Un fallo del motor deja ese sonido mudo, nunca un error no capturado. */
  private safely(fn: () => void): void {
    try {
      fn();
    } catch {
      // El audio es solo presentación: se ignora.
    }
  }
}
