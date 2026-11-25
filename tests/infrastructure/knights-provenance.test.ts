import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import provenanceJson from '../../content/asset-provenance.json';
import { ASSET_DIR } from '../../src/infrastructure/content/appearanceSchema';

// Spec asset-provenance (0026), "Procedencia de las hojas de los edificios de caballeros": las 3
// hojas de los solares (obra común, casa y torre) de Update 010, con su entrada al final de la nota.
const root = join(import.meta.dirname, '..', '..');
const PACK = 'Tiny Swords (Update 010)/Factions/Knights/Buildings/';
const SOURCES = [
  'House/House_Construction.png',
  'House/House_Blue.png',
  'Tower/Tower_Blue.png',
].map((f) => PACK + f);
/** Entradas que tenía la nota antes de 0026 (sin cambios). */
const ENTRIES_BEFORE = 28;

type CheckAssets = (input: {
  files: string[];
  provenance: unknown;
  digest: (path: string) => { sha256: string; bytes: number };
}) => string[];

const files = provenanceJson.files;
const versioned = (): string[] =>
  execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n');
const digestOf = (path: string) => {
  const bytes = readFileSync(join(root, path));
  return { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
};

/** Ancho y alto de la cabecera IHDR de un PNG (bytes 16–23). */
const sizeOf = (path: string): [number, number] => {
  const b = readFileSync(join(root, path));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

async function guard() {
  return (await import(pathToFileURL(join(root, '.claude', 'hooks', 'guard-assets.mjs')).href)) as {
    checkAssets: CheckAssets;
    PROVENANCE_PATH: string;
  };
}

describe('Procedencia de las hojas de los edificios de caballeros (asset-provenance 0026)', () => {
  it('Scenario: Hojas de caballeros registradas', async () => {
    const { checkAssets } = await guard();
    expect(
      checkAssets({ files: versioned(), provenance: provenanceJson, digest: digestOf }),
    ).toEqual([]);
    expect(files).toHaveLength(ENTRIES_BEFORE + 3);
    const added = files.slice(ENTRIES_BEFORE);
    expect(added.map((f) => f.source)).toEqual(SOURCES);
    for (const entry of added) {
      expect(entry.path).toBe(ASSET_DIR + entry.source.replace('Tiny Swords (Update 010)/', ''));
      expect(entry.version).toBe('Update 010');
      expect(digestOf(entry.path)).toEqual({ sha256: entry.sha256, bytes: entry.bytes });
    }
    // Medidas del design §1, confirmadas en la cabecera PNG.
    expect(added.map((f) => sizeOf(f.path))).toEqual([
      [128, 192],
      [128, 192],
      [128, 256],
    ]);
  });

  it('Scenario: Hoja de caballeros sin entrada (Tower_Blue.png)', async () => {
    const { checkAssets, PROVENANCE_PATH } = await guard();
    const tower = `${ASSET_DIR}Factions/Knights/Buildings/Tower/Tower_Blue.png`;
    const note = { ...provenanceJson, files: files.filter((f) => f.path !== tower) };
    const digest = (path: string) => {
      const e = files.find((f) => f.path === path);
      return { sha256: e?.sha256 ?? '', bytes: e?.bytes ?? 0 };
    };
    const problems = checkAssets({
      files: [...files.map((f) => f.path), PROVENANCE_PATH],
      provenance: note,
      digest,
    });
    expect(problems.join('\n')).toContain(tower);
  });

  it('Scenario: Hojas de caballeros no usadas', () => {
    const list = versioned().filter((f) => !f.startsWith('openspec/'));
    const unused =
      /Tower_Construction|House_Destroyed|Tower_Destroyed|Castle_Construction|Wood_Tower_InConstruction|House_(Red|Purple|Yellow)|Tower_(Red|Purple|Yellow)\.png/;
    expect(list.filter((f) => unused.test(f) && !f.includes('/Goblins/'))).toEqual([]);
    expect(list.filter((f) => /Wood_Tower_InConstruction/.test(f))).toEqual([]);
  });
});
