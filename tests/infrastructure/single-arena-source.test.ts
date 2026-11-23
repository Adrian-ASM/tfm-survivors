import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Spec run-outcome (0013), "Una sola fuente del tamaño del mundo en los tests" (design D6): el mundo
// y la vista salen de content/arena.json. `builders.ts` queda fuera por `SCENARIO_ARENA` (geometría
// de escenario, no el mundo del juego), igual que los escenarios con arena explícita.
const ROOT = join(import.meta.dirname, '..', '..');
const SELF = relative(ROOT, import.meta.filename)
  .split(sep)
  .join('/');
/** Ficheros donde una dimensión 960 o 540 escrita a mano sería el mundo o la vista del juego. */
const NO_LITERAL_SIZE = [
  'tests/e2e',
  'tests/bench',
  'tests/support/policies.ts',
  'tests/support/runs.ts',
];
const LITERAL_SIZE = /\b(960|540)\b/;

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

  it('sin literales 960/540 en los E2E, el bench, el bot ni los helpers de partida', () => {
    const hits = NO_LITERAL_SIZE.flatMap(filesUnder).flatMap((file) =>
      read(file)
        .split('\n')
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => LITERAL_SIZE.test(line))
        .map(({ n }) => `${file}:${String(n)}`),
    );

    expect(hits).toEqual([]);
  });
});
