import { z } from 'zod';
import { EFFECT_TYPES, type EffectType } from '../audio/effectTypes';

// Contenido de audio (change 0035, design D5): presentación, como `appearance.json`; no entra en la
// `RunConfig`. Estricto: sin tipos de efecto de más ni de menos y sin campos desconocidos.

/** Carpeta del audio en el repositorio (los `file` son relativos a ella). */
export const AUDIO_DIR = 'public/assets/audio/';

/** Nombre plano de un fichero de audio de la carpeta. */
export const AUDIO_FILE = /^[a-z0-9-]+\.(ogg|mp3|wav|flac)$/;

export const AUDIO_FILE_FORMAT =
  'Nombre de fichero de audio: minúsculas, dígitos y guiones, con extensión .ogg, .mp3, .wav o .flac.';
export const AUDIO_NOT_REGISTERED =
  'Fichero de audio sin registro en la lista de audio de la nota de procedencia.';

/**
 * Fichero de audio. **Transitorio** (design D5, conflicto 1): `null` hasta que lleguen los ficheros
 * CC0 del autor; ese tipo queda sin sonido. La tarea 6.1 endurece el esquema a `string`.
 */
const AudioFile = z.string().regex(AUDIO_FILE, AUDIO_FILE_FORMAT).nullable();

const Volume = z.number().int().min(0).max(100);

const EffectEntry = z.strictObject({
  file: AudioFile,
  priority: z.number().int(),
  minIntervalMs: z.number().int().min(0),
  gain: z.number().min(0).max(1),
});

export type EffectEntry = z.infer<typeof EffectEntry>;

const effectShape = Object.fromEntries(EFFECT_TYPES.map((t) => [t, EffectEntry])) as Record<
  EffectType,
  typeof EffectEntry
>;

export const AudioSchema = z.strictObject({
  maxVoices: z.number().int().min(1),
  towerMatchPx: z.number().positive(),
  defaults: z.strictObject({ music: Volume, effects: Volume, muted: z.boolean() }),
  music: z.strictObject({ file: AudioFile }),
  effects: z.strictObject(effectShape),
});

export type AudioContent = z.infer<typeof AudioSchema>;
