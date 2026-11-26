import { describe, expect, it } from 'vitest';
import { AudioCues } from '../../../src/infrastructure/audio/audioCues';
import { AudioDirector } from '../../../src/infrastructure/audio/AudioDirector';
import {
  AudioLoadStatus,
  audioKeys,
  type AudioKeys,
} from '../../../src/infrastructure/audio/audioPlan';
import { EffectMixer } from '../../../src/infrastructure/audio/EffectMixer';
import { zeroCounts } from '../../../src/infrastructure/audio/effectTypes';
import {
  PhaserSoundOut,
  type EngineSound,
  type EngineSoundManager,
} from '../../../src/infrastructure/audio/PhaserSoundOut';
import { unavailableSoundOut, type SoundOut } from '../../../src/infrastructure/audio/SoundOut';
import type { AudioContent } from '../../../src/infrastructure/content/audioSchema';
import type { RunSnapshot } from '../../../src/domain/run/RunSnapshot';
import { repositoryAudio } from '../../support/audio';
import { aDefaultConfig } from '../../support/builders';
import { startSeededRun } from '../../support/runs';

// Spec audio (0035), "Desbloqueo y fallos de audio" y "Bucle": `PhaserSoundOut` con un gestor de
// sonido falso del motor (design D7). Ninguna operación lanza.

class FakeSound implements EngineSound {
  isPlaying = false;
  isPaused = false;
  volume = 1;
  loop = false;
  plays = 0;
  constructor(readonly key: string) {}
  play(config?: { volume?: number; loop?: boolean }): boolean {
    this.isPlaying = true;
    this.isPaused = false;
    this.plays += 1;
    if (config?.volume !== undefined) this.volume = config.volume;
    if (config?.loop !== undefined) this.loop = config.loop;
    return true;
  }
  pause(): boolean {
    if (!this.isPlaying) return false;
    this.isPlaying = false;
    this.isPaused = true;
    return true;
  }
  resume(): boolean {
    if (!this.isPaused) return false;
    this.isPaused = false;
    this.isPlaying = true;
    return true;
  }
  stop(): boolean {
    this.isPlaying = false;
    this.isPaused = false;
    return true;
  }
  setVolume(value: number): void {
    this.volume = value;
  }
}

class FakeManager implements EngineSoundManager {
  locked = false;
  readonly added: FakeSound[] = [];
  constructor(private readonly cached: Set<string>) {}
  add(key: string, config?: { loop?: boolean }): FakeSound {
    // Como WebAudioSound: lanza si la clave no está en la caché.
    if (!this.cached.has(key)) throw new Error(`Audio key "${key}" not found in cache`);
    const s = new FakeSound(key);
    if (config?.loop !== undefined) s.loop = config.loop;
    this.added.push(s);
    return s;
  }
}

/** Contenido con fichero en todos los tipos (los del repositorio aún son `null`, tarea 6.1). */
function withFiles(): AudioContent {
  const audio = structuredClone(repositoryAudio());
  const effects = Object.fromEntries(
    Object.entries(audio.effects).map(([t, e]) => [t, { ...e, file: `${t.toLowerCase()}.ogg` }]),
  ) as AudioContent['effects'];
  return { ...audio, music: { file: 'music.ogg' }, effects };
}

function setup(failing: readonly string[] = []) {
  const audio = withFiles();
  const keys: AudioKeys = audioKeys(audio);
  const status = new AudioLoadStatus();
  const cache = new Set<string>(
    [keys.music, ...Object.values(keys.effects)].filter((k): k is string => k !== null),
  );
  for (const f of failing) {
    cache.delete(f);
    status.failed.add(f);
  }
  const manager = new FakeManager(cache);
  const out = new PhaserSoundOut(
    manager,
    { exists: (k) => cache.has(k) },
    keys,
    audio.effects,
    audio.maxVoices,
    status,
  );
  return { audio, keys, cache, manager, out, status };
}

function directorOn(out: SoundOut, audio: AudioContent = repositoryAudio()) {
  const mixer = new EffectMixer(audio.effects, audio.maxVoices, out);
  const cues = new AudioCues({ towerMatchPx: audio.towerMatchPx, maxTowerProjectiles: 16 });
  const d = new AudioDirector({ out, cues, mixer, settings: { ...audio.defaults } });
  return { d, mixer };
}

const BASE: RunSnapshot = startSeededRun(aDefaultConfig(), 42, 'empty').snapshot();

describe('PhaserSoundOut (spec audio 0035, D7)', () => {
  it('Scenario: Fichero que no carga', () => {
    const { out, keys, manager } = setup(['audio:pickup.ogg']);
    const { mixer } = directorOn(out, withFiles());

    expect(() => {
      mixer.decide(
        { ...zeroCounts(), pickup: 1, levelUp: 1 },
        {
          renderMs: 0,
          halted: false,
          hidden: false,
          effectsVolume: 0.8,
          sounding: out.sounding,
          canPlay: (t) => out.canPlay(t),
        },
      );
    }).not.toThrow();
    expect([out.canPlay('pickup'), out.canPlay('levelUp')]).toEqual([false, true]);
    expect(mixer.stats.byType.pickup.dropped).toBe(1);
    expect(manager.added.map((s) => s.key)).toEqual([keys.effects.levelUp]);
  });

  it('Scenario: Fichero que no carga (nunca llama a add con una clave ausente)', () => {
    const { out, manager } = setup(['audio:pickup.ogg']);

    expect(() => {
      out.play('pickup', 0.5);
    }).not.toThrow();
    expect(manager.added).toEqual([]);
  });

  it('Scenario: Desbloqueo rechazado', () => {
    const { out, manager } = setup();
    manager.locked = true;
    const { d, mixer } = directorOn(out, withFiles());

    expect(() => {
      d.newRun();
      d.screen('playing');
      d.frame(BASE, 0, false);
      d.frame({ ...BASE, kills: 3 }, 20, false);
    }).not.toThrow();
    expect(d.music).toBe('playing');
    expect([out.canPlay('enemyDeath'), mixer.stats.byType.enemyDeath]).toEqual([
      false,
      { requested: 3, played: 0, dropped: 3 },
    ]);
  });

  it('Scenario: Navegador sin Web Audio', () => {
    const out = unavailableSoundOut();
    const { d, mixer } = directorOn(out);
    const hurt = {
      ...BASE,
      hits: [{ id: 0, tick: 1, kind: 'player' as const, x: 0, y: 0, amount: 5 }],
    };

    expect(() => {
      d.newRun();
      d.screen('playing');
      d.frame(BASE, 0, false);
      d.frame(hurt, 16, false);
      d.setSettings({ ...d.settings, muted: true });
    }).not.toThrow();
    expect(mixer.stats.byType.playerHurt).toEqual({ requested: 1, played: 0, dropped: 1 });
    expect([out.sounding, out.filesRequested, d.music]).toEqual([0, 0, 'playing']);
  });

  it('Scenario: Bucle (la música va con loop: true y arranca en cuanto carga)', () => {
    const { out, manager, cache, keys } = setup();
    const music = keys.music ?? '';
    cache.delete(music);

    out.music('playing', 0.5);
    const before = manager.added.length;
    cache.add(music);
    out.music('playing', 0.5);
    const s = manager.added[0];

    expect(before).toBe(0);
    expect([s?.key, s?.loop, s?.isPlaying, s?.volume]).toEqual([music, true, true, 0.5]);
  });

  it('Scenario: Pausa con Esc (pausa y reanuda sin reiniciar; stop vuelve a 0)', () => {
    const { out, manager } = setup();
    out.music('playing', 0.5);
    const s = manager.added[0] as FakeSound;

    out.music('paused', 0.5);
    const paused = [s.isPaused, s.plays];
    out.music('playing', 0.5);
    const resumed = [s.isPlaying, s.plays];
    out.restartMusic();
    out.music('playing', 0.5);

    expect(paused).toEqual([true, 1]);
    expect(resumed).toEqual([true, 1]);
    expect([s.isPlaying, s.plays, manager.added.length]).toEqual([true, 2, 1]);
  });

  it('Scenario: Cambio al instante (volumen a la música que suena, sin reiniciarla)', () => {
    const { out, manager } = setup();
    out.music('playing', 0.5);
    const s = manager.added[0] as FakeSound;

    out.music('playing', 0.2);

    expect([s.volume, s.plays]).toEqual([0.2, 1]);
  });

  it('Scenario: Silencio y vuelta (los efectos que suenan pasan a 0 y vuelven con su ganancia)', () => {
    const { out, manager, audio } = setup();
    out.play('explosion', 0.4);
    const s = manager.added[0] as FakeSound;

    out.setEffectsVolume(0);
    const muted = s.volume;
    out.setEffectsVolume(0.8);

    expect([muted, s.volume]).toEqual([0, 0.8 * audio.effects.explosion.gain]);
  });

  it('Scenario: Tope lleno (pool perezoso: como mucho maxVoices instancias por tipo)', () => {
    const { out, manager, audio } = setup();
    for (let i = 0; i < audio.maxVoices + 5; i++) out.play('impactWeapon', 0.5);

    expect(manager.added).toHaveLength(audio.maxVoices);
    expect(out.sounding).toBe(audio.maxVoices);
  });

  it('Scenario: Pausa con Esc (stopEffects deja 0 efectos sonando)', () => {
    const { out } = setup();
    out.play('pickup', 0.5);
    out.play('levelUp', 0.5);
    out.play('build', 0.5);

    out.stopEffects();

    expect(out.sounding).toBe(0);
  });

  it('cuenta los ficheros pedidos y si alguno cargó (sonda)', () => {
    const { out, status, cache } = setup();
    status.requested = 11;
    const loaded = out.loaded;
    cache.clear();

    expect([out.filesRequested, loaded, out.loaded]).toEqual([11, true, false]);
  });
});
