import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import appearanceJson from '../../content/appearance.json';
import provenanceJson from '../../content/asset-provenance.json';
import { ASSET_DIR } from '../../src/infrastructure/content/appearanceSchema';
import {
  aspectsOf,
  mapSheetsOf,
  parseAppearance,
  pickupSpawnSheetsOf,
  sheepSheetsOf,
  siteAspectsOf,
  structureAspectsOf,
  veinAspectsOf,
} from '../../src/infrastructure/content/loadAppearance';

// Spec asset-provenance (0030), "Procedencia de las hojas de aparición de los recogibles": G_Spawn,
// W_Spawn y M_Spawn de Update 010, al final de la nota, idénticas al pack (con sombra) y vigiladas
// por el guardarraíl. Las 42 entradas de antes, intactas.
const root = join(import.meta.dirname, '..', '..');
const NAMES = ['G_Spawn.png', 'W_Spawn.png', 'M_Spawn.png'];
const SOURCES = NAMES.map((n) => `Tiny Swords (Update 010)/Resources/Resources/${n}`);
const pathOf = (name: string): string => `${ASSET_DIR}Resources/Resources/${name}`;
/** Entradas de la nota antes de este change (0012–0029). */
const ENTRIES_BEFORE = 42;
/** Última entrada de antes del change (Deco/18 de 0029), campo a campo. */
const LAST_BEFORE = {
  path: `${ASSET_DIR}Deco/18.png`,
  source: 'Tiny Swords (Update 010)/Deco/18.png',
  version: 'Update 010',
  sha256: '8ef2e9479438091df9622dd4aa4f943b2454916fadc7975cfa1f39d30231eb68',
  bytes: 3595,
};

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

/** Hojas que usan los datos de aspecto, aparición incluida ("Solo las hojas usadas"). */
function usedSheets(): Set<string> {
  const r = parseAppearance(
    structuredClone(appearanceJson),
    files.map((f) => f.path),
  );
  if (!r.ok) throw new Error(`${r.error.field}: ${r.error.message}`);
  const a = r.value;
  return new Set([
    ...aspectsOf(a).map(([, x]) => ASSET_DIR + x.sheet.file),
    ...mapSheetsOf(a).map(([, file]) => ASSET_DIR + file),
    ...structureAspectsOf(a).map(([, x]) => ASSET_DIR + x.sheet.file),
    ...veinAspectsOf(a).map(([, x]) => ASSET_DIR + x.sheet.file),
    ...sheepSheetsOf(a).map(([, sheet]) => ASSET_DIR + sheet.file),
    ...siteAspectsOf(a).map(([, x]) => ASSET_DIR + x.sheet.file),
    ...pickupSpawnSheetsOf(a).map(([, sheet]) => ASSET_DIR + sheet.file),
  ]);
}

describe('Procedencia de las hojas de aparición de los recogibles (asset-provenance)', () => {
  it('Scenario: Hojas de aparición registradas (3 entradas más, al final; las de antes iguales)', async () => {
    const { checkAssets } = await guard();
    const list = [...new Set([...versioned(), ...files.map((f) => f.path)])];

    expect(checkAssets({ files: list, provenance: provenanceJson, digest: digestOf })).toEqual([]);
    expect(files).toHaveLength(ENTRIES_BEFORE + 3);
    const added = files.slice(ENTRIES_BEFORE);
    expect(added.map((f) => f.source)).toEqual(SOURCES);
    expect(added.map((f) => f.path)).toEqual(NAMES.map(pathOf));
    expect(files[ENTRIES_BEFORE - 1]).toEqual(LAST_BEFORE);
    expect(files.slice(0, ENTRIES_BEFORE).some((f) => f.path.includes('_Spawn'))).toBe(false);
  });

  it('Scenario: Integridad de las hojas de aparición (sha256 y bytes; W_Spawn alterado falla)', async () => {
    const { checkAssets, PROVENANCE_PATH } = await guard();
    for (const entry of files.slice(ENTRIES_BEFORE)) {
      expect(entry.version).toBe('Update 010');
      expect(digestOf(entry.path)).toEqual({ sha256: entry.sha256, bytes: entry.bytes });
    }
    const target = pathOf('W_Spawn.png');
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

  it('Scenario: Hoja de aparición sin entrada (M_Spawn.png)', async () => {
    const { checkAssets, PROVENANCE_PATH } = await guard();
    const target = pathOf('M_Spawn.png');

    const problems = checkAssets({
      files: [...files.map((f) => f.path), PROVENANCE_PATH],
      provenance: withEntries((f) => (f.path === target ? null : f)),
      digest: noted,
    });

    expect(problems.join('\n')).toContain(target);
  });

  it('Scenario: Hoja de aparición del Free Pack (G_Spawn.png)', async () => {
    const { checkAssets, PROVENANCE_PATH } = await guard();
    const target = pathOf('G_Spawn.png');
    const free = 'Tiny Swords (Free Pack)/Resources/Resources/G_Spawn.png';

    const problems = checkAssets({
      files: [...files.map((f) => f.path), PROVENANCE_PATH],
      provenance: withEntries((f) => (f.path === target ? { ...f, source: free } : f)),
      digest: noted,
    });

    expect(problems.join('\n')).toContain('Free Pack');
    expect(problems.join('\n')).toContain(target);
  });

  it('Scenario: Variante sin sombra de una hoja de aparición (con entrada: no es hoja de ningún aspecto)', () => {
    const target = pathOf('W_Spawn_(NoShadow).png');
    const registered = [...files.map((f) => f.path), target];
    const used = usedSheets();

    expect(registered.filter((p) => !used.has(p))).toEqual([target]);
  });

  it('Scenario: Solo las hojas usadas (cada entrada de la nota es hoja de un aspecto o de una aparición)', () => {
    const used = usedSheets();

    expect(files.map((f) => f.path).filter((p) => !used.has(p))).toEqual([]);
    expect(NAMES.map(pathOf).every((p) => used.has(p))).toBe(true);
  });
});
