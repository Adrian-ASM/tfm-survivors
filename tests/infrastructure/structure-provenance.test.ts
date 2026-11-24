import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import provenanceJson from '../../content/asset-provenance.json';
import { ASSET_DIR } from '../../src/infrastructure/content/appearanceSchema';

// Spec asset-provenance (0021), "Procedencia de las hojas de las estructuras": las 4 hojas de casas,
// torres y ruinas de Update 010, con su entrada en la nota y vigiladas por el guardarraíl.
const root = join(import.meta.dirname, '..', '..');
const PACK = 'Tiny Swords (Update 010)/Factions/Goblins/Buildings/';
const SOURCES = [
  'Wood_House/Goblin_House.png',
  'Wood_House/Goblin_House_Destroyed.png',
  'Wood_Tower/Wood_Tower_Red.png',
  'Wood_Tower/Wood_Tower_Destroyed.png',
].map((f) => PACK + f);

/** Entradas que tenía la nota antes del change (las 15 primeras, sin cambios). */
const ENTRIES_BEFORE = 15;

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

async function guard() {
  return (await import(pathToFileURL(join(root, '.claude', 'hooks', 'guard-assets.mjs')).href)) as {
    checkAssets: CheckAssets;
    PROVENANCE_PATH: string;
  };
}

describe('Procedencia de las hojas de las estructuras (asset-provenance)', () => {
  it('Scenario: Hojas de estructuras registradas', async () => {
    const { checkAssets } = await guard();
    expect(
      checkAssets({ files: versioned(), provenance: provenanceJson, digest: digestOf }),
    ).toEqual([]);
    expect(files).toHaveLength(ENTRIES_BEFORE + 4);
    const added = files.slice(ENTRIES_BEFORE);
    expect(added.map((f) => f.source)).toEqual(SOURCES);
    for (const entry of added) {
      expect(entry.path).toBe(ASSET_DIR + entry.source.replace('Tiny Swords (Update 010)/', ''));
      expect(entry.version).toBe('Update 010');
      expect(digestOf(entry.path)).toEqual({ sha256: entry.sha256, bytes: entry.bytes });
    }
  });

  it('Scenario: Hoja de estructura sin entrada (Goblin_House_Destroyed.png)', async () => {
    const { checkAssets, PROVENANCE_PATH } = await guard();
    const ruin = `${ASSET_DIR}Factions/Goblins/Buildings/Wood_House/Goblin_House_Destroyed.png`;
    const note = { ...provenanceJson, files: files.filter((f) => f.path !== ruin) };
    const digest = (path: string) => {
      const e = files.find((f) => f.path === path);
      return { sha256: e?.sha256 ?? '', bytes: e?.bytes ?? 0 };
    };
    const problems = checkAssets({
      files: [...files.map((f) => f.path), PROVENANCE_PATH],
      provenance: note,
      digest,
    });
    expect(problems.join('\n')).toContain(ruin);
  });

  it('Scenario: Hojas de edificios no usadas', () => {
    const list = versioned().filter((f) => !f.startsWith('openspec/'));
    expect(list.filter((f) => /Wood_Tower_InConstruction|Fire\.png|W_Idle\.png/.test(f))).toEqual(
      [],
    );
    const colors = /Wood_Tower_(Red|Blue|Purple|Yellow)\.png$/;
    expect(list.filter((f) => colors.test(f))).toHaveLength(1);
  });
});
