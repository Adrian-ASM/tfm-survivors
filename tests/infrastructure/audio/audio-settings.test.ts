import { describe, expect, it } from 'vitest';
import { ClearProgress } from '../../../src/application/ClearProgress';
import { ImportProgress } from '../../../src/application/ImportProgress';
import { LoadProgress } from '../../../src/application/LoadProgress';
import { AudioSettingsStore } from '../../../src/infrastructure/audio/AudioSettingsStore';
import {
  AUDIO_STORAGE_KEY,
  LocalStorageAudioSettingsRepository,
} from '../../../src/infrastructure/audio/LocalStorageAudioSettingsRepository';
import {
  LocalStorageProgressRepository,
  PROGRESS_STORAGE_KEY,
} from '../../../src/infrastructure/progress/LocalStorageProgressRepository';
import { MenuProgress } from '../../../src/infrastructure/progress/MenuProgress';
import { encodeProgress } from '../../../src/infrastructure/progress/progressCodec';
import { FakeStorage, domException } from '../../support/FakeStorage';
import { aProgress, entriesAt, records } from '../../support/progress';

const DEFAULTS = { music: 50, effects: 80, muted: false };

/** Almacenamiento que cuenta las escrituras de la clave de audio. */
class AudioStorage extends FakeStorage {
  audioWrites = 0;
  override setItem(key: string, value: string): void {
    super.setItem(key, value);
    if (key === AUDIO_STORAGE_KEY) this.audioWrites += 1;
  }
}

function storeOn(storage: AudioStorage | (() => never)) {
  const warnings: string[] = [];
  const repo = new LocalStorageAudioSettingsRepository(
    typeof storage === 'function' ? storage : () => storage,
  );
  const store = new AudioSettingsStore(repo, DEFAULTS, (m) => warnings.push(m));
  return { store, warnings };
}

const saved = (storage: FakeStorage): unknown =>
  JSON.parse(storage.values.get(AUDIO_STORAGE_KEY) ?? 'null');

describe('Ajustes de audio guardados (spec audio, 0035 D9)', () => {
  it('Scenario: Sin ajustes guardados', () => {
    const storage = new AudioStorage();
    const { store, warnings } = storeOn(storage);

    expect(store.settings).toEqual(DEFAULTS);
    expect([storage.audioWrites, warnings.length]).toEqual([0, 0]);
  });

  it.each([
    ['texto hola', 'hola'],
    ['música 140', JSON.stringify({ version: 1, music: 140, effects: 80, muted: false })],
    ['efectos "80"', JSON.stringify({ version: 1, music: 50, effects: '80', muted: false })],
    [
      'campo extra master',
      JSON.stringify({ version: 1, music: 50, effects: 80, muted: false, master: 1 }),
    ],
  ])('Scenario: Ajustes dañados (%s)', (_name, value) => {
    const storage = new AudioStorage();
    storage.values.set(AUDIO_STORAGE_KEY, value);
    const { store, warnings } = storeOn(storage);
    const intact = storage.values.get(AUDIO_STORAGE_KEY);

    store.set('effects', 70);

    expect(intact).toBe(value);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('audio');
    expect(saved(storage)).toEqual({ version: 1, music: 50, effects: 70, muted: false });
  });

  it('Scenario: Ajustes dañados (los por defecto en uso antes del cambio)', () => {
    const storage = new AudioStorage();
    storage.values.set(AUDIO_STORAGE_KEY, 'hola');

    expect(storeOn(storage).store.settings).toEqual(DEFAULTS);
  });

  it('Scenario: Almacenamiento que lanza', () => {
    const storage = new AudioStorage();
    storage.getError = domException('SecurityError');
    storage.setError = domException('SecurityError');
    const { store, warnings } = storeOn(storage);

    expect(() => {
      store.setMuted(true);
    }).not.toThrow();
    expect([store.settings.muted, warnings.length]).toEqual([true, 1]);
  });

  it('Scenario: Almacenamiento que lanza (al acceder a localStorage)', () => {
    const { store, warnings } = storeOn(() => {
      throw domException('SecurityError');
    });

    store.set('music', 30);

    expect([store.settings.music, warnings.length]).toEqual([30, 1]);
  });

  it('Scenario: Silencio y vuelta (los ajustes guardados siguen en 50/80)', () => {
    const storage = new AudioStorage();
    const { store } = storeOn(storage);

    store.setMuted(true);
    store.setMuted(false);

    expect(saved(storage)).toEqual({ version: 1, music: 50, effects: 80, muted: false });
    expect(storage.audioWrites).toBe(2);
  });

  it('Scenario: Ajustes que sobreviven a la recarga', () => {
    const storage = new AudioStorage();
    const first = storeOn(storage).store;
    first.set('music', 30);
    first.set('effects', 65);
    first.setMuted(true);

    const reloaded = storeOn(storage).store;

    expect(reloaded.settings).toEqual({ music: 30, effects: 65, muted: true });
  });

  it('Scenario: Una escritura por cambio (un valor igual no escribe ni avisa)', () => {
    const storage = new AudioStorage();
    const { store } = storeOn(storage);
    const seen: number[] = [];
    store.subscribe((s) => seen.push(s.music));

    store.set('music', 50);
    store.set('music', 55);
    store.set('music', 140);
    store.setMuted(false);

    expect([storage.audioWrites, seen, store.settings.music]).toEqual([2, [55, 100], 100]);
  });

  it('Scenario: Independiente del progreso', async () => {
    const storage = new AudioStorage();
    const A = JSON.stringify({ version: 1, music: 30, effects: 65, muted: true });
    storage.values.set(AUDIO_STORAGE_KEY, A);
    storage.values.set(PROGRESS_STORAGE_KEY, encodeProgress(aProgress(records(300, 8, 120))));
    storeOn(storage);
    const repository = new LocalStorageProgressRepository(() => storage);
    const { session } = new LoadProgress(repository).execute();
    const importProgress = new ImportProgress(session, repository);
    const menu = new MenuProgress(session, importProgress, new ClearProgress(session, repository));

    const exported = menu.exportText();
    const file = encodeProgress(aProgress(records(10, 2, 30), entriesAt(2, 1)));
    await menu.importFile({ size: file.length, text: () => Promise.resolve(file) });
    menu.clear();

    expect(storage.values.get(AUDIO_STORAGE_KEY)).toBe(A);
    expect(exported).not.toContain('music');
    expect(exported).not.toContain('muted');
  });
});
