import { err, ok, type Result } from '../../domain/shared/Result';
import { AudioSettingsSchema } from './audioSettingsSchema';
import type { AudioSettings } from './audioVolumes';

/** Clave propia, aparte del progreso (spec audio, "Ajustes de audio guardados"). */
export const AUDIO_STORAGE_KEY = 'sprint-survivors/audio';

export type AudioSettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type AudioLoadError = 'unavailable' | 'corrupt';
export type AudioSaveError = 'unavailable' | 'quota-exceeded';

/** Nombres de la excepción de cuota (estándar y el antiguo de Firefox). */
const QUOTA_NAMES = new Set(['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED']);

/**
 * Ajustes de audio sobre `localStorage` (design 0035 D9), con el patrón de
 * `LocalStorageProgressRepository`: recibe una función porque acceder a `window.localStorage` ya
 * puede lanzar. Nunca lanza y nunca toca el valor al leer. Sin puerto en `application`: solo lo usa
 * el adaptador.
 */
export class LocalStorageAudioSettingsRepository {
  constructor(private readonly storage: () => AudioSettingsStorage) {}

  /** `ok(null)` sin valor; `corrupt` si no es JSON o no cumple el esquema; `unavailable` si lanza. */
  load(): Result<AudioSettings | null, AudioLoadError> {
    let text: string | null;
    try {
      text = this.storage().getItem(AUDIO_STORAGE_KEY);
    } catch {
      return err('unavailable');
    }
    if (text === null) return ok(null);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return err('corrupt');
    }
    const parsed = AudioSettingsSchema.safeParse(json);
    if (!parsed.success) return err('corrupt');
    const { music, effects, muted } = parsed.data;
    return ok({ music, effects, muted });
  }

  save(settings: AudioSettings): Result<void, AudioSaveError> {
    const value = { version: 1, ...settings };
    try {
      this.storage().setItem(AUDIO_STORAGE_KEY, JSON.stringify(value));
      return ok(undefined);
    } catch (e) {
      const quota = e instanceof DOMException && QUOTA_NAMES.has(e.name);
      return err(quota ? 'quota-exceeded' : 'unavailable');
    }
  }
}
