import { EFFECT_TYPES, type EffectCounts, type EffectType } from './effectTypes';

/** Regla de un tipo de efecto (contenido de audio, design 0035 D5). */
export interface EffectRule {
  readonly priority: number;
  readonly minIntervalMs: number;
  /** Ganancia 0..1: volumen del efecto = efectos efectivos × ganancia. */
  readonly gain: number;
}

export type EffectRules = Readonly<Record<EffectType, EffectRule>>;

/** Lo que el mezclador entrega a la salida de audio. */
export interface MixerOut {
  play(type: EffectType, volume: number): void;
}

/** Estado del frame que decide el mezclador (design D4). */
export interface MixNow {
  /** Reloj de render del adaptador, en ms. */
  readonly renderMs: number;
  /** Pausa del jugador o retención (0033). */
  readonly halted: boolean;
  /** Pestaña oculta. */
  readonly hidden: boolean;
  /** Volumen efectivo de efectos sin la ganancia (0 con silencio). */
  readonly effectsVolume: number;
  /** Efectos que suenan según la salida. */
  readonly sounding: number;
  /** El tipo se puede reproducir (fichero cargado, motor desbloqueado y Web Audio). */
  canPlay(type: EffectType): boolean;
}

export interface MixCount {
  requested: number;
  played: number;
  dropped: number;
}

/** Contadores acumulados en la carga (sonda `__sprint.audio`). */
export interface MixStats extends MixCount {
  readonly byType: Readonly<Record<EffectType, Readonly<MixCount>>>;
}

/**
 * Mezclador de efectos (design 0035 D4), puro: por snapshot procesado, como mucho 1 reproducción
 * por tipo; descarta lo que cae dentro del intervalo mínimo del tipo (reloj de render) o no se
 * puede reproducir; ordena por prioridad (y por el orden de los tipos) y acepta como mucho
 * `maxVoices − sounding`. Con el mundo detenido, la pestaña oculta o los efectos a 0, todo se
 * descarta. Lo descartado no se guarda: pedidas = reproducidas + descartadas por construcción.
 */
export class EffectMixer {
  private readonly lastAt = new Map<EffectType, number>();
  private readonly candidates: EffectType[] = [];
  private readonly counters: MixStats;
  private readonly byType: Record<EffectType, MixCount>;

  constructor(
    private readonly rules: EffectRules,
    private readonly maxVoices: number,
    private readonly out: MixerOut,
  ) {
    const byType = {} as Record<EffectType, MixCount>;
    for (const t of EFFECT_TYPES) byType[t] = { requested: 0, played: 0, dropped: 0 };
    this.byType = byType;
    this.counters = { requested: 0, played: 0, dropped: 0, byType };
  }

  get stats(): MixStats {
    return this.counters;
  }

  /** Partida nueva: el reloj de render de una escena nueva empieza en 0. */
  newRun(): void {
    this.lastAt.clear();
  }

  decide(counts: Readonly<EffectCounts>, now: MixNow): void {
    const mute = now.halted || now.hidden || now.effectsVolume === 0;
    const list = this.candidates;
    list.length = 0;
    for (const t of EFFECT_TYPES) {
      const n = counts[t];
      if (n <= 0) continue;
      this.count(t, 'requested', n);
      // Como mucho 1 candidata por tipo: el resto de ese tipo se descarta ya.
      if (n > 1) this.count(t, 'dropped', n - 1);
      if (mute || this.tooSoon(t, now.renderMs) || !now.canPlay(t)) this.count(t, 'dropped', 1);
      else list.push(t);
    }
    // Orden estable: la lista ya va en el orden de los tipos; a igual prioridad, se conserva.
    list.sort((a, b) => this.rules[b].priority - this.rules[a].priority);
    const free = Math.max(0, this.maxVoices - now.sounding);
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (!t) continue;
      if (i >= free) {
        this.count(t, 'dropped', 1);
        continue;
      }
      this.out.play(t, now.effectsVolume * this.rules[t].gain);
      this.lastAt.set(t, now.renderMs);
      this.count(t, 'played', 1);
    }
  }

  private tooSoon(t: EffectType, renderMs: number): boolean {
    const last = this.lastAt.get(t);
    return last !== undefined && renderMs - last < this.rules[t].minIntervalMs;
  }

  private count(t: EffectType, field: keyof MixCount, n: number): void {
    this.byType[t][field] += n;
    this.counters[field] += n;
  }
}
