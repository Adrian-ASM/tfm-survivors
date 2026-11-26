import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

// Spec asset-provenance (0035 rev. 4, design D13.3 y D13.7): licencias de audio admitidas (CC0,
// CC-BY-3.0, CC-BY-4.0) y la atribución de cada entrada CC-BY en una misma línea de `CREDITS.md`. La
// nota real aún no tiene audio (tarea 6.1): la lista de audio y `CREDITS.md` son simulados.
interface Digest {
  sha256: string;
  bytes: number;
}
type SoundEntry = Record<string, unknown> & { path: string };
type Provenance = Record<string, unknown>;
type CheckAssets = (input: {
  files: string[];
  provenance: Provenance | undefined;
  digest: (path: string) => Digest;
  credits?: string;
}) => string[];

const root = join(import.meta.dirname, '..', '..');
const guard = (await import(
  pathToFileURL(join(root, '.claude', 'hooks', 'guard-assets.mjs')).href
)) as { checkAssets: CheckAssets; PROVENANCE_PATH: string; CREDITS_PATH: string };
const { checkAssets, PROVENANCE_PATH, CREDITS_PATH } = guard;

const versioned = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((f) => f !== 'CREDITS.md');
const real = JSON.parse(readFileSync(join(root, PROVENANCE_PATH), 'utf8')) as Provenance;
const diskDigest = (path: string): Digest => {
  const blob = readFileSync(join(root, path));
  return { sha256: createHash('sha256').update(blob).digest('hex'), bytes: blob.length };
};

const MUSIC = 'public/assets/audio/song.mp3';
const HURT = 'public/assets/audio/receive-hit.flac';
const SIM = new Map<string, Digest>([
  [MUSIC, { sha256: 'd'.repeat(64), bytes: 900 }],
  [HURT, { sha256: 'c'.repeat(64), bytes: 300 }],
]);
const digest = (p: string): Digest => SIM.get(p) ?? diskDigest(p);

const music: SoundEntry = {
  path: MUSIC,
  title: 'Battle Theme',
  author: 'Kenney',
  url: 'https://kenney.nl/assets/music-jingles',
  license: 'CC0',
  downloadedOn: '2026-11-25',
  sha256: 'd'.repeat(64),
  bytes: 900,
};
const hurt = (license = 'CC-BY-4.0'): SoundEntry => ({
  path: HURT,
  title: 'Hurt Sound',
  author: 'Some Author',
  url: 'https://opengameart.org/content/hurt-sound',
  license,
  downloadedOn: '2026-11-25',
  sha256: 'c'.repeat(64),
  bytes: 300,
});

const lineOf = (e: SoundEntry): string =>
  `- "${String(e['title'])}" de ${String(e['author'])} (${String(e['url'])}), ` +
  `licencia ${String(e['license'])}.`;
const creditsWith = (lines: string[], eol = '\n'): string =>
  ['# Créditos', '', ...lines, ''].join(eol);

/** El guardarraíl con la nota real y la lista de audio dada; `credits` ausente = sin CREDITS.md. */
function check(sounds: SoundEntry[], credits: string | undefined): string[] {
  const files = [...versioned, MUSIC, HURT, ...(credits === undefined ? [] : [CREDITS_PATH])];
  return checkAssets({
    files,
    provenance: { ...real, sounds },
    digest,
    ...(credits === undefined ? {} : { credits }),
  });
}

const naming = (out: string[], ...parts: string[]): boolean =>
  out.some((line) => parts.every((p) => line.includes(p)));

describe('guard-assets · licencias y créditos del audio (asset-provenance 0035 rev. 4)', () => {
  it('CREDITS.md en la raíz del repositorio', () => {
    expect(CREDITS_PATH).toBe('CREDITS.md');
  });

  it.each(['CC0', 'CC-BY-3.0', 'CC-BY-4.0'])('Scenario: Licencias admitidas (%s)', (license) => {
    const sounds = [music, hurt(license)];

    expect(check(sounds, creditsWith(sounds.map(lineOf)))).toEqual([]);
  });

  it.each([
    ['CC-BY-NC-4.0', false],
    ['CC-BY-NC-3.0', false],
    ['CC-BY-SA-4.0', false],
    ['CC-BY-ND-4.0', false],
    ['CC-BY-2.0', false],
    ['cc0', false],
    ['Unknown', false],
    ['CC-BY-NC-4.0', true],
  ] as const)('Scenario: Licencia de audio rechazada (%s; con su línea: %s)', (license, line) => {
    const sounds = [music, hurt(license)];
    const credits = creditsWith(line ? sounds.map(lineOf) : [lineOf(music)]);

    expect(naming(check(sounds, credits), HURT, '"license"', license)).toBe(true);
  });

  const full = lineOf(hurt());
  it.each([
    ['sin la línea', ''],
    ['sin el autor', full.replace(' de Some Author', '')],
    ['URL cambiada en un carácter', full.replace('hurt-sound', 'hurt-sounc')],
    ['licencia «CC-BY 3.0»', full.replace('CC-BY-4.0', 'CC-BY 3.0')],
    ['título en una línea y lo demás en la siguiente', full.replace('" de ', '"\nde ')],
  ])('Scenario: Entrada CC-BY sin línea en los créditos (%s)', (_name, line) => {
    const out = check([music, hurt()], creditsWith([lineOf(music), line]));

    expect(naming(out, HURT, 'CREDITS.md')).toBe(true);
  });

  it('Scenario: Créditos ausentes', () => {
    const out = check([music, hurt()], undefined);

    expect(naming(out, 'CREDITS.md', HURT)).toBe(true);
  });

  it('Scenario: Solo CC0 sin créditos', () => {
    const out = check([music, hurt('CC0')], undefined);

    expect(out).toEqual([]);
  });

  it('Scenario: CC0 sin línea en los créditos', () => {
    expect(check([music, hurt()], creditsWith([full]))).toEqual([]);
  });

  it('Scenario: Licencias admitidas (la línea admite texto alrededor y finales CRLF)', () => {
    const credits = creditsWith([`Audio: ${full} Gracias.`], '\r\n');

    expect(check([music, hurt()], credits)).toEqual([]);
  });
});
