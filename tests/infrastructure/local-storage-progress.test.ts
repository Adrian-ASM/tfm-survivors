import { describe, expect, it } from 'vitest';
import {
  LocalStorageProgressRepository,
  PROGRESS_STORAGE_KEY,
} from '../../src/infrastructure/progress/LocalStorageProgressRepository';
import { encodeProgress } from '../../src/infrastructure/progress/progressCodec';
import { FakeStorage } from '../support/FakeStorage';
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
