import { describe, expect, it } from 'vitest';
import { pickedFile } from '../../src/infrastructure/dom/pickedFile';
import { encodeProgress } from '../../src/infrastructure/progress/progressCodec';
import {
  MAX_IMPORT_BYTES,
  readProgressFile,
} from '../../src/infrastructure/progress/readProgressFile';
import { aProgress, anEntry, records } from '../support/progress';

const P = aProgress(records(250, 10, 90), [anEntry()]);

/** Doble de `Blob` que cuenta las lecturas del contenido. */
function blob(size: number, content = '') {
  const file = {
    reads: 0,
    size,
    text: (): Promise<string> => {
      file.reads += 1;
      return Promise.resolve(content);
    },
  };
  return file;
}

const fileOf = (text: string): File => new File([text], 'progress.json');

describe('readProgressFile (spec progress-persistence, "Rechazo de imports inválidos")', () => {
  it('el límite es 64 × 1.024 = 65.536 bytes', () => {
    expect(MAX_IMPORT_BYTES).toBe(65_536);
  });

  it('Scenario: Fichero demasiado grande (65.537 bytes ⇒ too-large sin leer el contenido)', async () => {
    const file = blob(65_537, encodeProgress(P));

    const read = await readProgressFile(file);

    expect(read).toStrictEqual({ ok: false, error: { code: 'too-large' } });
    expect(file.reads).toBe(0);
  });

  it('Scenario: Fichero en el límite (65.536 bytes válidos seguidos de espacios ⇒ se acepta)', async () => {
    const valid = encodeProgress(P);
    const file = fileOf(valid + ' '.repeat(65_536 - new TextEncoder().encode(valid).byteLength));

    const read = await readProgressFile(file);

    expect(file.size).toBe(65_536);
    expect(read).toStrictEqual({ ok: true, value: P });
  });

  it.each([
    ['hola', 'hola'],
    ['schemaVersion 2', encodeProgress(P).replace('"schemaVersion": 1', '"schemaVersion": 2')],
    ['campo extra', encodeProgress(P).replace('{', '{"note": "x",')],
  ])('Scenario: Fichero no JSON o fuera de esquema (%s ⇒ error)', async (_name, text) => {
    const read = await readProgressFile(fileOf(text));

    expect(read.ok).toBe(false);
  });
});

describe('readProgressFile ante una lectura fallida', () => {
  it('si text() rechaza, devuelve un error de contenido no válido sin lanzar', async () => {
    const file = { size: 10, text: () => Promise.reject(new Error('NotReadableError')) };

    const read = await readProgressFile(file);

    expect(read.ok ? null : read.error.code).toBe('invalid');
  });
});

describe('pickedFile (spec "Si se cancela el selector de fichero, nada cambia")', () => {
  const list = (files: File[]) => ({
    length: files.length,
    item: (i: number): File | null => files[i] ?? null,
  });

  it('selector cancelado (null o lista vacía) ⇒ null', () => {
    expect([pickedFile(null), pickedFile(list([]))]).toEqual([null, null]);
  });

  it('con un fichero elegido ⇒ ese fichero', () => {
    const file = fileOf('{}');

    expect(pickedFile(list([file]))).toBe(file);
  });
});
