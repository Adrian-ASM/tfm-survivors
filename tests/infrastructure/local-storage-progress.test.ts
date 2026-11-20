import { describe, expect, it } from 'vitest';
import {
  LocalStorageProgressRepository,
  PROGRESS_STORAGE_KEY,
} from '../../src/infrastructure/progress/LocalStorageProgressRepository';
import { encodeProgress } from '../../src/infrastructure/progress/progressCodec';
import { FakeStorage, domException } from '../support/FakeStorage';
import { describeProgressRepositoryContract } from '../support/progressRepositoryContract';
import { aProgress, anEntry, records } from '../support/progress';

describeProgressRepositoryContract('LocalStorageProgressRepository (Storage falso)', () => {
  const storage = new FakeStorage();
  return () => new LocalStorageProgressRepository(() => storage);
});

describe('LocalStorageProgressRepository', () => {
  it('guarda el documento v1 en la clave sprint-survivors/progress', () => {
    const storage = new FakeStorage();
    const p = aProgress(records(20, 3, 41), [anEntry()]);

    new LocalStorageProgressRepository(() => storage).save(p);

    expect(PROGRESS_STORAGE_KEY).toBe('sprint-survivors/progress');
    expect(storage.values.get(PROGRESS_STORAGE_KEY)).toBe(encodeProgress(p));
  });
});

const G = aProgress(records(20, 3, 41), [anEntry()]);

function storageWith(value: string): FakeStorage {
  const storage = new FakeStorage();
  storage.values.set(PROGRESS_STORAGE_KEY, value);
  return storage;
}

describe('LocalStorageProgressRepository ante fallos (spec "Juego sin almacenamiento")', () => {
  it('Scenario: Almacenamiento bloqueado (acceder a localStorage lanza SecurityError)', () => {
    const repo = new LocalStorageProgressRepository(() => {
      throw domException('SecurityError');
    });

    expect([repo.load(), repo.save(G)]).toStrictEqual([
      { ok: false, error: { code: 'unavailable' } },
      { ok: false, error: { code: 'unavailable' } },
    ]);
  });

  it('Scenario: Almacenamiento bloqueado (getItem y setItem lanzan SecurityError)', () => {
    const storage = new FakeStorage();
    storage.getError = domException('SecurityError');
    storage.setError = domException('SecurityError');
    const repo = new LocalStorageProgressRepository(() => storage);

    expect([repo.load(), repo.save(G)]).toStrictEqual([
      { ok: false, error: { code: 'unavailable' } },
      { ok: false, error: { code: 'unavailable' } },
    ]);
  });

  it('Scenario: Almacenamiento lleno al guardar (QuotaExceededError ⇒ quota-exceeded, G intacto)', () => {
    const storage = storageWith(encodeProgress(G));
    storage.setError = domException('QuotaExceededError');
    const repo = new LocalStorageProgressRepository(() => storage);

    expect(repo.load()).toStrictEqual({ ok: true, value: G });
    expect(repo.save(aProgress(records(99, 9, 99)))).toStrictEqual({
      ok: false,
      error: { code: 'quota-exceeded' },
    });
    expect(storage.values.get(PROGRESS_STORAGE_KEY)).toBe(encodeProgress(G));
  });

  it.each([
    ['Datos guardados dañados', '{"schemaVersion":1,"records":'],
    [
      'Versión futura guardada',
      encodeProgress(G).replace('"schemaVersion": 1', '"schemaVersion": 2'),
    ],
  ])('Scenario: %s (corrupt y el valor guardado no cambia)', (_name, value) => {
    const storage = storageWith(value);

    const loaded = new LocalStorageProgressRepository(() => storage).load();

    expect(loaded.ok ? null : loaded.error.code).toBe('corrupt');
    expect(storage.values.get(PROGRESS_STORAGE_KEY)).toBe(value);
  });
});
