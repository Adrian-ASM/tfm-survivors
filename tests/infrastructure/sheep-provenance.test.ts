import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import provenanceJson from '../../content/asset-provenance.json';
import { ASSET_DIR } from '../../src/infrastructure/content/appearanceSchema';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import { REGISTERED, rawAppearance } from '../support/appearance';

// Spec asset-provenance (0023), "Procedencia de las hojas de ovejas y carne", y sprite-rendering
// (0023), "Datos de la oveja inválidos".
const root = join(import.meta.dirname, '..', '..');
const SOURCES = [
  'Resources/Resources/M_Idle.png',
  'Resources/Sheep/HappySheep_Idle.png',
  'Resources/Sheep/HappySheep_Bouncing.png',
].map((f) => `Tiny Swords (Update 010)/${f}`);
/** Entradas de la nota antes de este change (19 + 3 de recursos de 0022). */
const ENTRIES_BEFORE = 22;

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

describe('Procedencia de las hojas de ovejas y carne (asset-provenance)', () => {
  it('Scenario: Hojas de ovejas y carne registradas (3 entradas más, al final; las de antes iguales)', async () => {
    const { checkAssets } = await guard();
    const list = [...new Set([...versioned(), ...files.map((f) => f.path)])].filter(Boolean);
    expect(checkAssets({ files: list, provenance: provenanceJson, digest: digestOf })).toEqual([]);
    // 0025 añade al final las rocas de la piedra: estas 3 siguen en su sitio.
    expect(files.length).toBeGreaterThanOrEqual(ENTRIES_BEFORE + 3);
    const added = files.slice(ENTRIES_BEFORE, ENTRIES_BEFORE + 3);
    expect(added.map((f) => f.source)).toEqual(SOURCES);
    for (const entry of added) {
      expect(entry.path).toBe(ASSET_DIR + entry.source.replace('Tiny Swords (Update 010)/', ''));
      expect(entry.version).toBe('Update 010');
      expect(digestOf(entry.path)).toEqual({ sha256: entry.sha256, bytes: entry.bytes });
    }
  });

  it('Scenario: Hoja de oveja sin entrada (HappySheep_Bouncing.png)', async () => {
    const { checkAssets, PROVENANCE_PATH } = await guard();
    const bouncing = `${ASSET_DIR}Resources/Sheep/HappySheep_Bouncing.png`;
    const note = { ...provenanceJson, files: files.filter((f) => f.path !== bouncing) };
    const digest = (path: string) => {
      const e = files.find((f) => f.path === path);
      return { sha256: e?.sha256 ?? '', bytes: e?.bytes ?? 0 };
    };
    const problems = checkAssets({
      files: [...files.map((f) => f.path), PROVENANCE_PATH],
      provenance: note,
      digest,
    });
    expect(problems.join('\n')).toContain(bouncing);
  });

  it('Scenario: Hojas de ovejas y carne no usadas (sin _All ni NoShadow; M_Spawn solo 1 vez)', () => {
    const list = versioned().filter((f) => !f.startsWith('openspec/'));
    const forbidden = /HappySheep_All|M_Idle_\(NoShadow\)|M_Spawn_\(NoShadow\)/;
    expect(list.filter((f) => forbidden.test(f))).toEqual([]);
    // 0030: M_Spawn.png es la aparición de la carne (asset-provenance, hojas de aparición).
    expect(list.filter((f) => f.includes('M_Spawn'))).toEqual([
      `${ASSET_DIR}Resources/Resources/M_Spawn.png`,
    ]);
    for (const name of ['HappySheep_Idle.png', 'HappySheep_Bouncing.png', 'M_Idle.png']) {
      expect(
        list.filter((f) => f.endsWith(`/${name}`)),
        name,
      ).toHaveLength(1);
    }
  });

  it('Scenario: Hojas de ovejas y carne no usadas (lista simulada con M_Spawn_(NoShadow): falla)', () => {
    const extra = `${ASSET_DIR}Resources/Resources/M_Spawn_(NoShadow).png`;
    const list = [...versioned(), extra].filter((f) => !f.startsWith('openspec/'));
    const forbidden = /HappySheep_All|M_Idle_\(NoShadow\)|M_Spawn_\(NoShadow\)/;

    expect(list.filter((f) => forbidden.test(f))).toEqual([extra]);
    expect(list.filter((f) => f.includes('M_Spawn'))).toHaveLength(2);
  });
});

describe('Datos de la oveja inválidos (sprite-rendering)', () => {
  const failure = (change: (r: ReturnType<typeof rawAppearance>) => void): string => {
    const raw = rawAppearance();
    change(raw);
    const r = parseAppearance(raw, REGISTERED);
    if (r.ok) throw new Error('se esperaba un error');
    return r.error.field;
  };

  it('sin aspecto de oveja: nombra el aspecto', () => {
    expect(failure((r) => Reflect.deleteProperty(r, 'sheep'))).toBe('sheep');
  });

  it('sin la animación bounce: nombra bounce', () => {
    expect(failure((r) => Reflect.deleteProperty(r.sheep, 'bounce'))).toBe('sheep.bounce');
  });

  it('el color de la oveja igual al de wood: nombra el color de la oveja', () => {
    expect(
      failure((r) => {
        r.sheep.placeholderColor = r.pickups.wood?.placeholderColor;
      }),
    ).toBe('sheep.placeholderColor');
  });

  it('el color de la oveja "blanco": nombra el color de la oveja', () => {
    expect(failure((r) => (r.sheep.placeholderColor = 'blanco'))).toBe('sheep.placeholderColor');
  });

  it('una hoja de la oveja sin entrada en la nota: nombra su fichero', () => {
    const registered = REGISTERED.filter((p) => !p.endsWith('HappySheep_Idle.png'));
    const r = parseAppearance(rawAppearance(), registered);
    expect(r.ok ? null : r.error.field).toBe('sheep.idle.sheet.file');
  });
});
