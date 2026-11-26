import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import provenanceJson from '../../content/asset-provenance.json';
import { ASSET_DIR } from '../../src/infrastructure/content/appearanceSchema';

// Spec asset-provenance (0032), "Procedencia de las piezas de UI": las 8 hojas de `UI/Banners`,
// `UI/Buttons` y `UI/Ribbons` de Update 010, al final de la nota, idénticas al pack.
const root = join(import.meta.dirname, '..', '..');
/** Entradas de la nota antes de este change (0012–0030). */
const ENTRIES_BEFORE = 45;
const PIECES = [
  'Banners/Carved_9Slides.png',
  'Buttons/Button_Blue_9Slides.png',
  'Buttons/Button_Hover_9Slides.png',
  'Buttons/Button_Blue_9Slides_Pressed.png',
  'Buttons/Button_Disable_9Slides.png',
  'Buttons/Button_Red_9Slides.png',
  'Buttons/Button_Red_9Slides_Pressed.png',
  'Ribbons/Ribbon_Yellow_3Slides.png',
];
const pathOf = (piece: string): string => `${ASSET_DIR}UI/${piece}`;
const PANEL = pathOf('Banners/Carved_9Slides.png');
const BUTTON = pathOf('Buttons/Button_Blue_9Slides.png');
/** Última entrada de antes del change (0030), que no debe cambiar. */
const LAST_BEFORE = {
  path: `${ASSET_DIR}Resources/Resources/M_Spawn.png`,
  source: 'Tiny Swords (Update 010)/Resources/Resources/M_Spawn.png',
  version: 'Update 010',
  sha256: '1d86e71839a4c688bc1be59537fbe05c6fdb7dfe6bc868e5f0c4b3a32ca003d5',
  bytes: 7030,
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
/** Lista simulada: lo versionado más lo que registra la nota (las copias aún sin `git add`). */
const simulated = (): string[] => [
  ...new Set([
    ...versioned(),
    ...files.map((f) => f.path),
    ...provenanceJson.fonts.flatMap((f) => [f.path, f.licenseFile]),
  ]),
];

describe('Procedencia de las piezas de UI (asset-provenance)', () => {
  it('Scenario: Piezas registradas (8 entradas más, al final, bajo UI/Banners|Buttons|Ribbons)', async () => {
    const { checkAssets } = await guard();

    expect(
      checkAssets({ files: simulated(), provenance: provenanceJson, digest: digestOf }),
    ).toEqual([]);
    expect(files).toHaveLength(ENTRIES_BEFORE + PIECES.length);
    const added = files.slice(ENTRIES_BEFORE);
    expect(added.map((f) => f.path)).toEqual(PIECES.map(pathOf));
    expect(added.map((f) => f.source)).toEqual(
      PIECES.map((p) => `Tiny Swords (Update 010)/UI/${p}`),
    );
    for (const { source } of added) {
      expect(source).toMatch(/^Tiny Swords \(Update 010\)\/UI\/(Banners|Buttons|Ribbons)\//);
    }
  });

  it('Scenario: Piezas registradas (las entradas de antes, iguales campo a campo)', () => {
    const before = files.slice(0, ENTRIES_BEFORE);
    expect(before.at(-1)).toEqual(LAST_BEFORE);
    expect(before.some((f) => f.path.includes('/UI/'))).toBe(false);
  });

  it('Scenario: Integridad de las piezas (sha256 y bytes; panel alterado falla)', async () => {
    const { checkAssets, PROVENANCE_PATH } = await guard();
    for (const entry of files.slice(ENTRIES_BEFORE)) {
      expect(entry.version).toBe('Update 010');
      expect(digestOf(entry.path)).toEqual({ sha256: entry.sha256, bytes: entry.bytes });
      expect(entry.path).toBe(ASSET_DIR + entry.source.replace('Tiny Swords (Update 010)/', ''));
    }
    const flip = (c: string): string => (c === '0' ? '1' : '0');
    const note = withEntries((f) =>
      f.path === PANEL ? { ...f, sha256: flip(f.sha256.charAt(0)) + f.sha256.slice(1) } : f,
    );

    const problems = checkAssets({
      files: [...files.map((f) => f.path), PROVENANCE_PATH],
      provenance: note,
      digest: digestOf,
    });

    expect(problems.join('\n')).toContain(PANEL);
  });

  it('Scenario: Pieza sin entrada (la hoja de button)', async () => {
    const { checkAssets, PROVENANCE_PATH } = await guard();

    const problems = checkAssets({
      files: [...files.map((f) => f.path), PROVENANCE_PATH],
      provenance: withEntries((f) => (f.path === BUTTON ? null : f)),
      digest: noted,
    });

    expect(problems.join('\n')).toContain(BUTTON);
  });

  it('Scenario: Pieza del Free Pack (origen de la hoja de button)', async () => {
    const { checkAssets, PROVENANCE_PATH } = await guard();
    const free = 'Tiny Swords (Free Pack)/UI Elements/UI Elements/Banners/Banner.png';

    const problems = checkAssets({
      files: [...files.map((f) => f.path), PROVENANCE_PATH],
      provenance: withEntries((f) => (f.path === BUTTON ? { ...f, source: free } : f)),
      digest: noted,
    });

    expect(problems.join('\n')).toContain(BUTTON);
    expect(problems.join('\n')).toContain('Free Pack');
  });

  it('Scenario: Iconos y punteros fuera', () => {
    expect(files.filter((f) => /\/UI\/(Icons|Pointers)\//.test(f.source))).toEqual([]);
    expect(simulated().filter((f) => /\/UI\/(Icons|Pointers)\//.test(f))).toEqual([]);
  });
});
