import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import provenanceJson from '../../content/asset-provenance.json';
import { ASSET_DIR } from '../../src/infrastructure/content/appearanceSchema';

// Spec asset-provenance (0022), "Procedencia de las hojas de los recursos": madera y vetas de
// Update 010, al final de la nota y vigiladas por el guardarraíl. Las 19 de antes, intactas.
const root = join(import.meta.dirname, '..', '..');
const SOURCES = [
  'Resources/Resources/W_Idle.png',
  'Resources/Gold Mine/GoldMine_Active.png',
  'Resources/Gold Mine/GoldMine_Inactive.png',
].map((f) => `Tiny Swords (Update 010)/${f}`);

/** Entradas que tenía la nota antes del change (G_Idle.png incluida). */
const ENTRIES_BEFORE = 19;
/** La de G_Idle.png antes del change, campo a campo. */
const G_IDLE = {
  path: `${ASSET_DIR}Resources/Resources/G_Idle.png`,
  source: 'Tiny Swords (Update 010)/Resources/Resources/G_Idle.png',
  version: 'Update 010',
  sha256: 'ee9a2018e179b95839105d0b6d39725f22ae57e28d73532421fb1994c4b4de78',
  bytes: 1179,
};

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

describe('Procedencia de las hojas de los recursos (asset-provenance)', () => {
  it('Scenario: Hojas de recursos registradas (3 entradas más; G_Idle igual)', async () => {
    const { checkAssets } = await guard();
    const list = [...new Set([...versioned(), ...files.map((f) => f.path)])].filter(Boolean);
    expect(checkAssets({ files: list, provenance: provenanceJson, digest: digestOf })).toEqual([]);
    // 0023 añade al final las hojas de la carne y de las ovejas: estas 3 siguen en su sitio.
    expect(files.length).toBeGreaterThanOrEqual(ENTRIES_BEFORE + 3);
    const added = files.slice(ENTRIES_BEFORE, ENTRIES_BEFORE + 3);
    expect(added.map((f) => f.source)).toEqual(SOURCES);
    for (const entry of added) {
      expect(entry.path).toBe(ASSET_DIR + entry.source.replace('Tiny Swords (Update 010)/', ''));
      expect(entry.version).toBe('Update 010');
      expect(digestOf(entry.path)).toEqual({ sha256: entry.sha256, bytes: entry.bytes });
    }
    expect(files.find((f) => f.path === G_IDLE.path)).toEqual(G_IDLE);
  });

  it('Scenario: Hoja de recursos sin entrada (GoldMine_Inactive.png)', async () => {
    const { checkAssets, PROVENANCE_PATH } = await guard();
    const inactive = `${ASSET_DIR}Resources/Gold Mine/GoldMine_Inactive.png`;
    const note = { ...provenanceJson, files: files.filter((f) => f.path !== inactive) };
    const digest = (path: string) => {
      const e = files.find((f) => f.path === path);
      return { sha256: e?.sha256 ?? '', bytes: e?.bytes ?? 0 };
    };
    const problems = checkAssets({
      files: [...files.map((f) => f.path), PROVENANCE_PATH],
      provenance: note,
      digest,
    });
    expect(problems.join('\n')).toContain(inactive);
  });

  it('Scenario: Hojas de recursos no usadas (sin Destroyed, NoShadow, _Spawn ni HappySheep_All)', () => {
    const list = versioned().filter((f) => !f.startsWith('openspec/'));
    const unused = /GoldMine_Destroyed|NoShadow|_Spawn|HappySheep_All/;
    expect(list.filter((f) => unused.test(f))).toEqual([]);
  });
});
