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

// Spec asset-provenance (0029), "Procedencia de las hojas de la decoración": las 11 hojas de Deco
// de Update 010, al final de la nota, idénticas al pack y vigiladas por el guardarraíl.
const root = join(import.meta.dirname, '..', '..');
const DECOR = ['01', '02', '03', '07', '08', '09', '10', '11', '16', '17', '18'];
const SOURCES = DECOR.map((n) => `Tiny Swords (Update 010)/Deco/${n}.png`);
const pathOf = (n: string): string => `${ASSET_DIR}Deco/${n}.png`;
/** Entradas de la nota antes de este change (0012–0026). */
const ENTRIES_BEFORE = 31;

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

/** Hojas que usan los datos de aspecto (la comprobación de "Solo las hojas usadas"). */
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

describe('Procedencia de las hojas de la decoración (asset-provenance)', () => {
  it('Scenario: Hojas de la decoración registradas (11 entradas más, al final)', async () => {
    const { checkAssets } = await guard();
    const list = [...new Set([...versioned(), ...files.map((f) => f.path)])];

    expect(checkAssets({ files: list, provenance: provenanceJson, digest: digestOf })).toEqual([]);
    // 0030 añade al final las 3 hojas de aparición: estas 11 siguen en su sitio.
    expect(files.length).toBeGreaterThanOrEqual(ENTRIES_BEFORE + DECOR.length);
    const added = files.slice(ENTRIES_BEFORE, ENTRIES_BEFORE + DECOR.length);
    expect(added.map((f) => f.source)).toEqual(SOURCES);
    expect(added.map((f) => f.path)).toEqual(DECOR.map(pathOf));
  });

  it('Scenario: Hojas de la decoración registradas (las de antes, iguales campo a campo)', () => {
    // Las 3 rocas de 0025 (posiciones 25..27) y las 3 de caballeros de 0026 (28..30), sin tocar.
    const before = files.slice(0, ENTRIES_BEFORE);
    expect(before.map((f) => f.path)).not.toContain(pathOf('01'));
    expect(before[25]).toEqual({
      path: `${ASSET_DIR}Deco/04.png`,
      source: 'Tiny Swords (Update 010)/Deco/04.png',
      version: 'Update 010',
      sha256: 'e4a6132577721eb8837cc23fe5e25644c4d866da24c5e663fce58d86f4638f53',
      bytes: 433,
    });
  });

  it('Scenario: Integridad de las hojas de la decoración (sha256 y bytes; 18 alterado falla)', async () => {
    const { checkAssets, PROVENANCE_PATH } = await guard();
    for (const entry of files.slice(ENTRIES_BEFORE, ENTRIES_BEFORE + DECOR.length)) {
      expect(entry.version).toBe('Update 010');
      expect(digestOf(entry.path)).toEqual({ sha256: entry.sha256, bytes: entry.bytes });
      expect(entry.path).toBe(ASSET_DIR + entry.source.replace('Tiny Swords (Update 010)/', ''));
    }
    const target = pathOf('18');
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

  it('Scenario: Hoja de la decoración sin entrada (Deco/09.png)', async () => {
    const { checkAssets, PROVENANCE_PATH } = await guard();
    const target = pathOf('09');

    const problems = checkAssets({
      files: [...files.map((f) => f.path), PROVENANCE_PATH],
      provenance: withEntries((f) => (f.path === target ? null : f)),
      digest: noted,
    });

    expect(problems.join('\n')).toContain(target);
  });

  it('Scenario: Hoja de la decoración del Free Pack (Deco/16.png)', async () => {
    const { checkAssets, PROVENANCE_PATH } = await guard();
    const target = pathOf('16');
    const free = 'Tiny Swords (Free Pack)/Deco/16.png';

    const problems = checkAssets({
      files: [...files.map((f) => f.path), PROVENANCE_PATH],
      provenance: withEntries((f) => (f.path === target ? { ...f, source: free } : f)),
      digest: noted,
    });

    expect(problems.join('\n')).toContain('Free Pack');
    expect(problems.join('\n')).toContain(target);
  });

  it('Scenario: Calabazas y huesos fuera (Deco/13.png sin entrada: el guardarraíl falla)', async () => {
    const { checkAssets, PROVENANCE_PATH } = await guard();
    const target = pathOf('13');

    const problems = checkAssets({
      files: [...files.map((f) => f.path), PROVENANCE_PATH, target],
      provenance: provenanceJson,
      digest: noted,
    });

    expect(problems.join('\n')).toContain('Deco/13.png');
  });

  it('Scenario: Calabazas y huesos fuera (Deco/13.png con entrada: no es hoja de ningún aspecto)', () => {
    const target = pathOf('13');
    const registered = [...files.map((f) => f.path), target];
    const used = usedSheets();

    const unused = registered.filter((p) => !used.has(p));

    expect(unused).toEqual([target]);
  });
});
