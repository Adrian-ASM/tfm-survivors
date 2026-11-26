/** Ajustes de audio (spec audio 0035): música y efectos 0..100 y silencio general. */
export interface AudioSettings {
  readonly music: number;
  readonly effects: number;
  readonly muted: boolean;
}

/** Volúmenes efectivos (sin la ganancia del tipo): 0 con silencio, si no valor / 100. */
export interface EffectiveVolumes {
  readonly music: number;
  readonly effects: number;
}

export function effectiveVolumes(s: AudioSettings): EffectiveVolumes {
  return s.muted ? { music: 0, effects: 0 } : { music: s.music / 100, effects: s.effects / 100 };
}
