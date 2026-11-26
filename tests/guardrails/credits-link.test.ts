import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Spec asset-provenance (0035 rev. 4), "Enlace desde el README": no es una regla de procedencia (design
// D13): un test sobre el repositorio.
const root = join(import.meta.dirname, '..', '..');

/** Destinos de los enlaces Markdown `[texto](destino)` de un texto. */
const linkTargets = (md: string): string[] =>
  [...md.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1] ?? '');

describe('README y CREDITS.md (asset-provenance 0035)', () => {
  it('Scenario: Enlace desde el README', () => {
    const readme = readFileSync(join(root, 'README.md'), 'utf8');

    expect(linkTargets(readme).some((t) => t === 'CREDITS.md' || t === './CREDITS.md')).toBe(true);
    expect(existsSync(join(root, 'CREDITS.md'))).toBe(true);
  });

  it('el detector de enlaces no confunde una mención sin enlace', () => {
    expect(linkTargets('ver CREDITS.md y [otro](docs/x.md)')).toEqual(['docs/x.md']);
    expect(linkTargets('[créditos](./CREDITS.md)')).toEqual(['./CREDITS.md']);
  });
});
