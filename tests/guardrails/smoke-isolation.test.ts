import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Spec public-deploy, "Smoke remoto fuera de la verificación habitual": el smoke contra la URL
// pública no entra en test:e2e, en verify ni en ningún disparador automático. Lectura estática.
const ROOT = join(import.meta.dirname, '..', '..');
const read = (...parts: string[]): string => readFileSync(join(ROOT, ...parts), 'utf8');
const readIfExists = (...parts: string[]): string =>
  existsSync(join(ROOT, ...parts)) ? read(...parts) : '';

type Scripts = Record<string, string>;
const scripts = (JSON.parse(read('package.json')) as { scripts: Scripts }).scripts;

/** Comandos que ejecuta el script `name`, expandiendo `npm run X` recursivamente. */
function expandScript(all: Scripts, name: string, seen: string[] = []): string[] {
  if (seen.includes(name)) return [];
  return (all[name] ?? '')
    .split(/&&|\|\||;/)
    .map((part) => part.trim())
    .flatMap((part) => {
      const nested = /^npm(?:\.cmd)? run ([\w:.-]+)/.exec(part)?.[1];
      return nested === undefined ? [part] : expandScript(all, nested, [...seen, name]);
    });
}

const launchesSmoke = (commands: string[]): string[] =>
  commands.filter((c) => /playwright|smoke:public/.test(c));

/** Líneas de código (sin comentarios de línea) de un fichero TS. */
const codeLines = (text: string): string[] =>
  text.split('\n').filter((line) => !line.trim().startsWith('//') && line.trim() !== '');

const REMOTE_CONFIG = readIfExists('playwright.remote.config.ts');
const E2E_CONFIG = read('playwright.config.ts');

describe('Smoke remoto fuera de test:e2e y verify (spec public-deploy)', () => {
  it('Scenario: verify no incluye el smoke remoto (cadena expandida)', () => {
    const chain = expandScript(scripts, 'verify');

    expect(chain).toContain('vitest run');
    expect(launchesSmoke(chain)).toEqual([]);
  });

  it('expandScript detecta un verify que lanza Playwright o el smoke (rojo con texto mutado)', () => {
    const mutated = { ...scripts, verify: `${scripts.verify ?? ''} && npm run smoke:public` };
    const viaE2e = { ...scripts, verify: 'npm run lint && npm run test:e2e' };

    expect(launchesSmoke(expandScript(mutated, 'verify'))).not.toEqual([]);
    expect(launchesSmoke(expandScript(viaE2e, 'verify'))).toEqual(['playwright test']);
  });

  it('Scenario: test:e2e no incluye el smoke remoto (script y testDir)', () => {
    expect(scripts['test:e2e']).not.toMatch(/--config|remote/);
    expect(E2E_CONFIG).toMatch(/testDir:\s*'tests\/e2e'/);
  });

  it('smoke:public usa la config remota, que busca en tests/remote y no levanta servidor', () => {
    expect(scripts['smoke:public']).toMatch(/^playwright test --config playwright\.remote\.config\.ts/);
    expect(REMOTE_CONFIG).toMatch(/testDir:\s*'tests\/remote'/);
    expect(REMOTE_CONFIG).toMatch(/globalSetup:/);
    expect(codeLines(REMOTE_CONFIG).filter((line) => line.includes('webServer'))).toEqual([]);
  });

  it('ningún fichero de tests/e2e importa de tests/remote', () => {
    const dir = join(ROOT, 'tests', 'e2e');
    const offenders = readdirSync(dir).filter((file) =>
      /from\s+['"][^'"]*remote\//.test(readFileSync(join(dir, file), 'utf8')),
    );

    expect(offenders).toEqual([]);
  });
});
