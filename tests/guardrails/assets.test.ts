import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

// Spec asset-provenance (change 0012, design D8): reglas puras de `.claude/hooks/guard-assets.mjs`
// sobre una lista de ficheros simulada, la nota de procedencia y un digest inyectado como mapa.
interface Entry {
  path?: string;
  source?: string;
  version?: string;
  sha256?: string;
  bytes?: number;
}
type Provenance = Record<string, unknown> & { files?: Entry[] };
interface Digest {
  sha256: string;
  bytes: number;
}
interface AssetsInput {
  files: string[];
  provenance: Provenance | undefined;
  digest: (path: string) => Digest;
}
type CheckAssets = (input: AssetsInput) => string[];

const root = join(import.meta.dirname, '..', '..');
const guard = (await import(
  pathToFileURL(join(root, '.claude', 'hooks', 'guard-assets.mjs')).href
)) as { checkAssets: CheckAssets; PROVENANCE_PATH: string };
const { checkAssets, PROVENANCE_PATH } = guard;

const BASE = 'public/assets/tiny-swords';
const ARCHER = `${BASE}/Factions/Knights/Troops/Archer/Blue/Archer_Blue.png`;
const ARROW = `${BASE}/Factions/Knights/Troops/Archer/Arrow/Arrow.png`;
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

function entry(path: string, sha256: string, bytes: number): Entry {
  return {
    path,
    source: `Tiny Swords (Update 010)/${path.slice(BASE.length + 1)}`,
    version: 'Update 010',
    sha256,
    bytes,
  };
}

/** Nota válida con dos entradas (sustituye a la real mientras no hay assets). */
function aNote(): Provenance {
  return {
    pack: 'Tiny Swords',
    author: 'Pixel Frog',
    version: 'Update 010',
    license: 'CC0',
    confirmedOn: '2026-11-22',
    homepage: 'https://pixelfrog-assets.itch.io/tiny-swords',
    note: 'CC0 confirmado por el autor.',
    files: [entry(ARCHER, SHA_A, 100), entry(ARROW, SHA_B, 20)],
  };
}

const DIGESTS = new Map<string, Digest>([
  [ARCHER, { sha256: SHA_A, bytes: 100 }],
  [ARROW, { sha256: SHA_B, bytes: 20 }],
]);
const digest = (path: string): Digest => DIGESTS.get(path) ?? { sha256: 'f'.repeat(64), bytes: 1 };
const FILES = ['README.md', 'src/main.ts', PROVENANCE_PATH, ARCHER, ARROW];

function run(provenance: Provenance | undefined, files: string[] = FILES): string {
  return checkAssets({ files, provenance, digest }).join('\n');
}

describe('guard-assets · nota de procedencia (spec asset-provenance)', () => {
  it('una nota completa con sus ficheros pasa', () => {
    expect(checkAssets({ files: FILES, provenance: aNote(), digest })).toEqual([]);
  });

  it('la nota vive junto a los assets', () => {
    expect(PROVENANCE_PATH).toBe(`${BASE}/PROVENANCE.json`);
  });

  it.each(['pack', 'author', 'version', 'license', 'confirmedOn'])(
    'Scenario: Nota incompleta (sin %s)',
    (field) => {
      const note = aNote();
      Reflect.deleteProperty(note, field);
      expect(run(note)).toContain(field);
    },
  );

  it.each([
    ['license', 'CC-BY'],
    ['version', 'Update 009'],
    ['pack', 'Tiny Swords (Free Pack)'],
    ['author', 'Otro'],
    ['confirmedOn', 'ayer'],
  ])('Scenario: Nota incompleta (%s con valor %s)', (field, value) => {
    expect(run({ ...aNote(), [field]: value })).toContain(field);
  });

  it('Scenario: Nota incompleta (entrada sin ruta de origen)', () => {
    const note = aNote();
    const files = note.files ?? [];
    Reflect.deleteProperty(files[1] ?? {}, 'source');
    expect(run(note)).toContain('files[1].source');
  });

  it.each(['path', 'version', 'sha256', 'bytes'])('entrada sin %s', (field) => {
    const note = aNote();
    Reflect.deleteProperty(note.files?.[0] ?? {}, field);
    expect(run(note)).toContain(`files[0].${field}`);
  });

  it('entrada con versión distinta de Update 010', () => {
    const note = aNote();
    const first = note.files?.[0] ?? {};
    first.version = 'Update 009';
    expect(run(note)).toContain('files[0].version');
  });

  it('nota sin entradas', () => {
    expect(run({ ...aNote(), files: [] }, ['README.md', PROVENANCE_PATH])).toContain('files');
  });

  it('Scenario: Entrada repetida', () => {
    const note = aNote();
    note.files = [...(note.files ?? []), entry(ARROW, SHA_B, 20)];
    const out = run(note);
    expect(out).toContain(ARROW);
    expect(out).toMatch(/repetid/i);
  });

  it('Scenario: Origen del Free Pack', () => {
    const warrior = 'public/assets/tinyswords/Warrior.png';
    const note = aNote();
    note.files = [
      ...(note.files ?? []),
      {
        path: warrior,
        source: 'Tiny Swords (Free Pack)/Units/Blue Units/Warrior/Warrior_Idle.png',
        version: 'Update 010',
        sha256: 'f'.repeat(64),
        bytes: 1,
      },
    ];
    const out = run(note, [...FILES, warrior]);
    expect(out).toContain(warrior);
    expect(out).toContain('Free Pack');
  });
});
