import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLIC_URL } from '../remote/target';
import { triggerBlock, triggersOf } from './workflowText';

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

const WORKFLOWS_DIR = join(ROOT, '.github', 'workflows');
const workflows = readdirSync(WORKFLOWS_DIR).filter((f) => /\.ya?ml$/.test(f));
const SMOKE = readIfExists('.github', 'workflows', 'smoke-public.yml');
const AUTOMATIC = ['push', 'pull_request', 'pull_request_target', 'schedule', 'workflow_run'];

/** Problemas del workflow del smoke (vacío si cumple la spec "Workflow manual"). */
function smokeWorkflowProblems(yaml: string): string[] {
  const problems: string[] = [];
  if (yaml === '') return ['no existe smoke-public.yml'];
  const triggers = triggersOf(yaml);
  if (triggers.join() !== 'workflow_dispatch') problems.push(`on: ${triggers.join()}`);
  const dispatch = triggerBlock(yaml, 'workflow_dispatch');
  const url = /\n {6}url:\n((?: {8,}[^\n]*\n)*)/.exec(dispatch)?.[1] ?? '';
  if (!/required:\s*false/.test(url)) problems.push('inputs.url opcional');
  if (!url.includes(`default: '${PUBLIC_URL}'`)) problems.push('inputs.url por defecto');
  const permissions = /\npermissions:\n((?: {2}[^\n]*\n)*)/.exec(yaml)?.[1]?.trim() ?? '';
  if (permissions !== 'contents: read') problems.push(`permissions: ${permissions}`);
  if (/pages:|id-token|write/.test(yaml)) problems.push('permisos de escritura');
  const timeouts = [...yaml.matchAll(/timeout-minutes:\s*(\d+)/g)].map((m) => Number(m[1]));
  if (timeouts.join() !== '8') problems.push(`timeout-minutes: ${timeouts.join()}`);
  if (!/\n\s+SMOKE_URL:\s*\$\{\{\s*inputs\.url\s*\}\}/.test(yaml)) problems.push('env SMOKE_URL');
  if (/run:[^\n]*\$\{\{[^}]*inputs/.test(yaml)) problems.push('inputs interpolado en run');
  return problems;
}

describe('Workflow del smoke remoto (spec public-deploy)', () => {
  it('Scenario: Workflow manual (solo workflow_dispatch, url opcional, contents: read, 8 min)', () => {
    expect(smokeWorkflowProblems(SMOKE)).toEqual([]);
  });

  it('Scenario: Workflow manual (rojo con variantes mutadas)', () => {
    const mutants = [
      SMOKE.replace('on:\n', 'on:\n  push:\n    branches: [main]\n'),
      SMOKE.replace('contents: read', 'contents: write'),
      SMOKE.replace('timeout-minutes: 8', 'timeout-minutes: 30'),
      SMOKE.replace('run: npm run smoke:public', 'run: SMOKE_URL=${{ inputs.url }} npm run smoke:public'),
    ];

    expect(mutants.map((m) => smokeWorkflowProblems(m)[0])).toEqual([
      'on: push,workflow_dispatch',
      'permissions: contents: write',
      'timeout-minutes: 30',
      'inputs interpolado en run',
    ]);
  });

  it('Scenario: Ningún disparador automático (solo su workflow lo lanza; ci.yml no lo menciona)', () => {
    const launching = workflows.filter((f) =>
      readFileSync(join(WORKFLOWS_DIR, f), 'utf8').includes('smoke:public'),
    );

    expect(launching).toEqual(['smoke-public.yml']);
    expect(triggersOf(SMOKE).filter((t) => AUTOMATIC.includes(t))).toEqual([]);
    expect(read('.github', 'workflows', 'ci.yml')).not.toMatch(/smoke/i);
  });
});
