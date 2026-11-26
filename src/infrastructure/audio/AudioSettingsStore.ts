import type { AudioSettings } from './audioVolumes';
import type { LocalStorageAudioSettingsRepository } from './LocalStorageAudioSettingsRepository';

export const AUDIO_SETTINGS_WARNING =
  'Ajustes de audio guardados no válidos o no disponibles: se usan los de por defecto.';

type Listener = (settings: AudioSettings) => void;

const clamp = (v: number): number => Math.min(100, Math.max(0, Math.round(v)));

/**
 * Ajustes de audio en uso durante la carga (design 0035 D9). Se leen una vez: sin valor, los por
 * defecto; dañados o sin almacenamiento, los por defecto con 1 aviso que menciona `audio` (el valor
 * guardado no se toca). Cada cambio real avisa a los suscriptores y guarda 1 vez (un arrastre:
 * `preview` por paso y `commit` al soltar); si el guardado falla, el ajuste vale igual.
 */
export class AudioSettingsStore {
  private current: AudioSettings;
  private readonly listeners: Listener[] = [];
  private dirty = false;

  constructor(
    private readonly repo: Pick<LocalStorageAudioSettingsRepository, 'load' | 'save'>,
    defaults: AudioSettings,
    warn: (message: string) => void,
  ) {
    const loaded = repo.load();
    if (loaded.ok) {
      this.current = loaded.value ?? defaults;
    } else {
      this.current = defaults;
      warn(`[audio] ${AUDIO_SETTINGS_WARNING} (${loaded.error})`);
    }
  }

  get settings(): AudioSettings {
    return this.current;
  }

  subscribe(listener: Listener): void {
    this.listeners.push(listener);
  }

  /** Música o efectos (sujeto a [0, 100]) aplicado y guardado; nada si el valor no cambia. */
  set(field: 'music' | 'effects', value: number): void {
    this.preview(field, value);
    this.commit();
  }

  /**
   * Aplica sin guardar (el `input` de un deslizador mientras se arrastra, design D10): avisa a los
   * suscriptores y deja el cambio pendiente para `commit`.
   */
  preview(field: 'music' | 'effects', value: number): void {
    const v = clamp(value);
    if (this.current[field] === v) return;
    this.apply({ ...this.current, [field]: v });
  }

  /** Guarda 1 vez si hay un cambio pendiente (el `change` del deslizador); si no, nada. */
  commit(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.repo.save(this.current);
  }

  setMuted(muted: boolean): void {
    if (this.current.muted === muted) return;
    this.apply({ ...this.current, muted });
    this.commit();
  }

  private apply(next: AudioSettings): void {
    this.current = next;
    this.dirty = true;
    for (const l of this.listeners) l(next);
  }
}
