import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import type { AudioCues, CueSnapshot } from './audioCues';
import { effectiveVolumes, type AudioSettings, type EffectiveVolumes } from './audioVolumes';
import type { EffectMixer, MixStats } from './EffectMixer';
import type { EffectType } from './effectTypes';
import { musicState, type MusicState } from './musicState';
import type { SoundOut } from './SoundOut';

/** Pantalla que informa la escena (la misma lista que `Screen` de `GameScene`). */
export type AudioScreen = 'menu' | 'playing' | 'paused' | 'shop' | 'build';

export interface AudioDirectorDeps {
  readonly out: SoundOut;
  readonly cues: AudioCues;
  readonly mixer: EffectMixer;
  /** Ajustes en uso al cargar. */
  readonly settings: AudioSettings;
}

/** Lo que lee la sonda `window.__sprint.audio` (design D12). */
export interface AudioView {
  readonly loaded: boolean;
  readonly filesRequested: number;
  readonly music: MusicState;
  readonly settings: AudioSettings;
  readonly volumes: EffectiveVolumes;
  readonly requested: number;
  readonly played: number;
  readonly dropped: number;
  readonly byType: MixStats['byType'];
  readonly sounding: number;
}

/**
 * Director del audio (design 0035 D6), sin motor: junta las peticiones de `AudioCues`, la decisión
 * de `EffectMixer` y el estado de `musicState`, y se lo da a la salida. Lo alimentan la composición
 * (partida nueva, pantalla, pestaña oculta y inUse) y cada snapshot pintado. Al pasar a pausa
 * corta los efectos que suenan. No toca la simulación.
 */
export class AudioDirector {
  private inRun = false;
  private over = false;
  private paused = false;
  private held = false;
  private hidden = false;
  private current: MusicState = 'stopped';
  private inUse: AudioSettings;
  private vols: EffectiveVolumes;
  private readonly canPlay = (type: EffectType): boolean => this.deps.out.canPlay(type);

  constructor(private readonly deps: AudioDirectorDeps) {
    this.inUse = deps.settings;
    this.vols = effectiveVolumes(deps.settings);
    deps.out.setEffectsVolume(this.vols.effects);
  }

  get music(): MusicState {
    return this.current;
  }

  get settings(): AudioSettings {
    return this.inUse;
  }

  get volumes(): EffectiveVolumes {
    return this.vols;
  }

  /** Partida nueva (Jugar, R, ↻ o el arranque con `?e2e`): música a 0 y nueva referencia. */
  newRun(): void {
    this.inRun = true;
    this.over = false;
    this.deps.cues.newRun();
    this.deps.mixer.newRun();
    this.deps.out.restartMusic();
    this.apply();
  }

  /** Pantalla visible del frame: el menú quita la partida; `paused` es la pausa del jugador. */
  screen(name: AudioScreen): void {
    this.inRun = name !== 'menu';
    if (!this.inRun) this.over = false;
    this.paused = name === 'paused';
    this.apply();
  }

  /** Pestaña oculta o visible: se aplica en el propio evento (sin frames con la pestaña oculta). */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.apply();
  }

  /** Ajustes nuevos: volúmenes a la música y a los efectos que suenan, sin cambiar el estado. */
  setSettings(settings: AudioSettings): void {
    this.inUse = settings;
    this.vols = effectiveVolumes(settings);
    this.deps.out.setEffectsVolume(this.vols.effects);
    this.apply();
  }

  /** Un snapshot pintado con partida, con el reloj de render y la retención del frame. */
  frame(
    snapshot: CueSnapshot & Pick<RunSnapshot, 'status'>,
    renderMs: number,
    held: boolean,
  ): void {
    this.over = snapshot.status === 'over';
    this.held = held;
    this.apply();
    const counts = this.deps.cues.next(snapshot);
    const out = this.deps.out;
    this.deps.mixer.decide(counts, {
      renderMs,
      halted: this.paused || this.held,
      hidden: this.hidden,
      effectsVolume: this.vols.effects,
      sounding: out.sounding,
      canPlay: this.canPlay,
    });
  }

  view(): AudioView {
    const { stats } = this.deps.mixer;
    const out = this.deps.out;
    return {
      loaded: out.loaded,
      filesRequested: out.filesRequested,
      music: this.current,
      settings: this.inUse,
      volumes: this.vols,
      requested: stats.requested,
      played: stats.played,
      dropped: stats.dropped,
      byType: stats.byType,
      sounding: out.sounding,
    };
  }

  private apply(): void {
    const next = musicState({
      inRun: this.inRun,
      over: this.over,
      paused: this.paused,
      held: this.held,
      hidden: this.hidden,
    });
    if (next === 'paused' && this.current !== 'paused') this.deps.out.stopEffects();
    this.current = next;
    this.deps.out.music(next, this.vols.music);
  }
}
