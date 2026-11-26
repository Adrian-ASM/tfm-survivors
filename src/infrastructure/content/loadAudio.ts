import { err, invalidConfig, ok, type DomainError, type Result } from '../../domain/shared/Result';
import { EFFECT_TYPES } from '../audio/effectTypes';
import { AUDIO_DIR, AUDIO_NOT_REGISTERED, AudioSchema, type AudioContent } from './audioSchema';

const FIELD_ROOT = 'audio';

/** Lo que `soundPaths` necesita de la nota de procedencia (lista `sounds[]`, 0035 D13). */
export interface SoundLists {
  readonly sounds?: readonly { readonly path: string }[];
}

/** Rutas de la lista de audio de la nota: las únicas que valen como fichero de audio. */
export function soundPaths(note: SoundLists): string[] {
  return (note.sounds ?? []).map((s) => s.path);
}

/** Ficheros citados por el contenido de audio con su ruta de campo, música primero. */
export function audioFilesOf(audio: AudioContent): [string[], string][] {
  const out: [string[], string][] = [[['music', 'file'], audio.music.file]];
  for (const t of EFFECT_TYPES) out.push([['effects', t, 'file'], audio.effects[t].file]);
  return out;
}

/**
 * Valida `audio.json` (zod estricto, design 0035 D5) y cruza cada fichero con la lista de audio de
 * la nota (`AUDIO_NOT_REGISTERED`). El error nombra la sección, el tipo y el campo
 * (`audio.effects.levelUp.file`) y, si es un campo desconocido, ese campo.
 */
export function parseAudio(
  raw: unknown,
  sounds: readonly string[],
): Result<AudioContent, DomainError> {
  const parsed = AudioSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = (issue?.path ?? []).map(String);
    if (issue?.code === 'unrecognized_keys' && issue.keys[0] !== undefined)
      path.push(issue.keys[0]);
    const field = [FIELD_ROOT, ...path].join('.');
    return err(invalidConfig(field, issue?.message ?? 'Contenido de audio inválido'));
  }
  const known = new Set(sounds);
  for (const [path, file] of audioFilesOf(parsed.data)) {
    const repoPath = AUDIO_DIR + file;
    if (!known.has(repoPath)) {
      const field = [FIELD_ROOT, ...path].join('.');
      return err(invalidConfig(field, `${AUDIO_NOT_REGISTERED} (${repoPath})`));
    }
  }
  return ok(parsed.data);
}
