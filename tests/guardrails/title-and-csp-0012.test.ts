import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cspOf, parseCsp } from '../../config/csp';

// Change 0012: el arte no cambia la CSP (spec sprite-rendering, "Directivas sin cambios") y el
// documento lleva el título nuevo (spec main-menu, "Título en el menú y en el documento").
const root = join(import.meta.dirname, '..', '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  name: string;
  description: string;
};

/** Directivas de la CSP antes de 0012 (congeladas). */
const BEFORE_0012: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'img-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
};

describe('index.html tras 0012', () => {
  it('Scenario: Directivas sin cambios (una a una, img-src = self data:)', () => {
    const policy = parseCsp(cspOf(html) ?? '');
    expect(Object.fromEntries(policy)).toEqual(BEFORE_0012);
  });

  it('Scenario: Título en el menú y en el documento (parte del documento)', () => {
    const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? '';
    expect(title).toContain('Greentide Vanguard');
    expect(title).not.toContain('Sprint Survivors');
  });

  it('package.json: descripción con el título nuevo y el nombre técnico sin cambios', () => {
    expect(pkg.description).toContain('Greentide Vanguard');
    expect(pkg.description).not.toContain('Sprint Survivors');
    expect(pkg.name).toBe('sprint-survivors');
  });
});
