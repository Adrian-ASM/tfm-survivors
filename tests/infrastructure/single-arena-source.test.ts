import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseContent, repositoryContent } from '../../src/infrastructure/content/loadRunConfig';
import { DEFAULT_MAX_VIEW, DEFAULT_MOBILE, aDefaultConfig } from '../support/builders';

// Spec run-outcome (0013), "Una sola fuente del tamaño del mundo en los tests" (design D6): el mundo
// y la vista salen de content/arena.json. `builders.ts` queda fuera por `SCENARIO_ARENA` (geometría
// de escenario, no el mundo del juego), igual que los escenarios con arena explícita.
const ROOT = join(import.meta.dirname, '..', '..');
const SELF = relative(ROOT, import.meta.filename)
  .split(sep)
  .join('/');
/**
 * Ficheros donde una dimensión del mundo (3.840 × 2.160) o del tope de vista (2.560 × 1.440) escrita
 * a mano duplicaría content/arena.json (0017).
 */
const NO_LITERAL_SIZE = [
  'tests/e2e',
  'tests/bench',
  'tests/support/policies.ts',
  'tests/support/runs.ts',
];
const LITERAL_SIZE = /\b(3840|2160|2560|1440)\b/;
/** Radio del anillo derivado de la vista de 960 × 540 (anterior a 0017, ADR-0015). */
const DERIVED_RING = /582\.7/;

function filesUnder(path: string): string[] {
  const full = join(ROOT, path);
  if (/\.ts$/.test(path)) return [path];
  return readdirSync(full, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && /\.ts$/.test(d.name))
    .map((d) => relative(ROOT, join(d.parentPath, d.name)).split(sep).join('/'));
}

const read = (file: string): string => readFileSync(join(ROOT, file), 'utf8');

describe('Una sola fuente del tamaño del mundo en los tests (0013)', () => {
  it('Scenario: Sin arena por defecto duplicada (ningún DEFAULT_ARENA en tests/)', () => {
    const hits = filesUnder('tests')
      .filter((file) => file !== SELF)
      .filter((file) => read(file).includes('DEFAULT_ARENA'));

    expect(hits).toEqual([]);
  });

  it('sin literales del mundo ni del tope en los E2E, el bench, el bot ni los helpers', () => {
    const hits = NO_LITERAL_SIZE.flatMap(filesUnder).flatMap((file) =>
      read(file)
        .split('\n')
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => LITERAL_SIZE.test(line))
        .map(({ n }) => `${file}:${String(n)}`),
    );

    expect(hits).toEqual([]);
  });

  it('Scenario: Sin radio del anillo derivado de la vista (ningún 582.7 ni 582.727 en tests/)', () => {
    const hits = filesUnder('tests')
      .filter((file) => file !== SELF)
      .filter((file) => DERIVED_RING.test(read(file)));

    expect(hits).toEqual([]);
  });

  it('Scenario: Contenido de los tests igual al del juego (mundo, tope, móvil y ringRadius)', () => {
    const loaded = parseContent(repositoryContent());

    expect(loaded.ok && loaded.value).toEqual({
      config: aDefaultConfig(),
      maxView: DEFAULT_MAX_VIEW,
      mobile: DEFAULT_MOBILE,
    });
  });
});
