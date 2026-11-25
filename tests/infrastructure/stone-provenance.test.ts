import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import provenanceJson from '../../content/asset-provenance.json';
import { ASSET_DIR } from '../../src/infrastructure/content/appearanceSchema';

// Spec asset-provenance (0025), "Procedencia de las hojas de la piedra": las tres rocas de Deco de
// Update 010, al final de la nota, idénticas al pack y vigiladas por el guardarraíl.
const root = join(import.meta.dirname, '..', '..');
const ROCKS = ['04.png', '05.png', '06.png'];
const SOURCES = ROCKS.map((f) => `Tiny Swords (Update 010)/Deco/${f}`);
const pathOf = (rock: string): string => `${ASSET_DIR}Deco/${rock}`;
/** Entradas de la nota antes de este change (22 + 3 de ovejas y carne de 0023). */
const ENTRIES_BEFORE = 25;

type CheckAssets = (input: {
  files: string[];
  provenance: unknown;
  digest: (path: string) => { sha256: string; bytes: number };
}) => string[];
type Entry = (typeof provenanceJson.files)[number];

const files = provenanceJson.files;
const versioned = (): string[] =>
  execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const digestOf = (path: string) => {
  const bytes = readFileSync(join(root, path));
  return { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
};
/** Digest según la nota real (para notas simuladas sin leer disco). */
const noted = (path: string) => {
  const e = files.find((f) => f.path === path);
  return { sha256: e?.sha256 ?? '', bytes: e?.bytes ?? 0 };
};
async function guard() {
  return (await import(pathToFileURL(join(root, '.claude', 'hooks', 'guard-assets.mjs')).href)) as {
    checkAssets: CheckAssets;
    PROVENANCE_PATH: string;
  };
}
const withEntries = (change: (f: Entry) => Entry | null) => ({
  ...provenanceJson,
  files: files.map(change).filter((f): f is Entry => f !== null),
});

describe('Procedencia de las hojas de la piedra (asset-provenance)', () => {
  it('Scenario: Hojas de la piedra registradas (3 entradas más, al final)', async () => {
    const { checkAssets } = await guard();
    const list = [...new Set([...versioned(), ...files.map((f) => f.path)])];

    expect(checkAssets({ files: list, provenance: provenanceJson, digest: digestOf })).toEqual([]);
    // 0026 añade 3 entradas de caballeros al final: estas 3 siguen en su sitio, sin cambios.
    expect(files.length).toBeGreaterThanOrEqual(ENTRIES_BEFORE + 3);
    expect(files.slice(ENTRIES_BEFORE, ENTRIES_BEFORE + 3).map((f) => f.source)).toEqual(SOURCES);
  });

  it('Scenario: Integridad de las hojas de la piedra (sha256 y bytes; 05 alterado falla)', async () => {
    const { checkAssets, PROVENANCE_PATH } = await guard();
    for (const entry of files.slice(ENTRIES_BEFORE, ENTRIES_BEFORE + 3)) {
      expect(entry.path).toBe(ASSET_DIR + entry.source.replace('Tiny Swords (Update 010)/', ''));
      expect(entry.version).toBe('Update 010');
      expect(digestOf(entry.path)).toEqual({ sha256: entry.sha256, bytes: entry.bytes });
    }
    const target = pathOf('05.png');
    const flip = (c: string): string => (c === '0' ? '1' : '0');
    const note = withEntries((f) =>
      f.path === target ? { ...f, sha256: flip(f.sha256.charAt(0)) + f.sha256.slice(1) } : f,
    );

    const problems = checkAssets({
      files: [...files.map((f) => f.path), PROVENANCE_PATH],
      provenance: note,
      digest: digestOf,
    });

    expect(problems.join('\n')).toContain(target);
  });

  it('Scenario: Hoja de la piedra sin entrada (Deco/06.png)', async () => {
    const { checkAssets, PROVENANCE_PATH } = await guard();
    const target = pathOf('06.png');

    const problems = checkAssets({
      files: [...files.map((f) => f.path), PROVENANCE_PATH],
      provenance: withEntries((f) => (f.path === target ? null : f)),
      digest: noted,
    });

    expect(problems.join('\n')).toContain(target);
  });

  it('Scenario: Hoja de la piedra del Free Pack (Deco/04.png)', async () => {
    const { checkAssets, PROVENANCE_PATH } = await guard();
    const target = pathOf('04.png');
    const free = 'Tiny Swords (Free Pack)/Deco/04.png';

    const problems = checkAssets({
      files: [...files.map((f) => f.path), PROVENANCE_PATH],
      provenance: withEntries((f) => (f.path === target ? { ...f, source: free } : f)),
      digest: noted,
    });

    expect(problems.join('\n')).toContain('Free Pack');
    expect(problems.join('\n')).toContain(target);
  });

  it('Scenario: Solo las tres rocas de Deco (04, 05 y 06, una vez cada una)', () => {
    const deco = versioned().filter((f) => f.startsWith(`${ASSET_DIR}Deco/`));

    expect(deco.sort()).toEqual(ROCKS.map(pathOf));
  });
});
