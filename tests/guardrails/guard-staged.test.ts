import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Escenarios "Guardarraíl en pre-commit" (spec architecture-guardrails), en un repo git temporal con una copia
// de los hooks reales de .claude/hooks/.
const root = join(import.meta.dirname, '..', '..');
const script = join(root, 'scripts', 'guard-staged.mjs');
let repo: string;

const git = (...args: string[]) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });

function write(path: string, content: string): void {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), content);
}

function stage(path: string, content: string): void {
  write(path, content);
  git('add', '-f', path);
}

function guard(...args: string[]) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: repo, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'guard-'));
  git('init', '-q');
  cpSync(join(root, '.claude', 'hooks'), join(repo, '.claude', 'hooks'), { recursive: true });
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('guard-staged · pre-commit', () => {
  it('Aleatoriedad global en el dominio', () => {
    stage('src/domain/x.ts', 'export const r = Math.random();\n');
    const { code, out } = guard();
    expect(code).not.toBe(0);
    expect(out).toContain('src/domain/x.ts');
    expect(out).toContain('RandomGenerator');
  });

  it('El dominio importa el motor', () => {
    stage('src/domain/y.ts', "import Phaser from 'phaser';\nexport const P = Phaser;\n");
    const { code, out } = guard();
    expect(code).not.toBe(0);
    expect(out).toContain('El dominio no puede importar el motor');
  });

  it('Fichero de secretos', () => {
    stage('.env.local', 'TOKEN=abc\n');
    const { code, out } = guard();
    expect(code).not.toBe(0);
    expect(out).toContain('.env.example');
  });

  it('Se evalúa lo preparado, no el disco', () => {
    stage('src/domain/x.ts', 'export const r = Math.random();\n');
    write('src/domain/x.ts', 'export const r = 4;\n'); // corregido en disco, sin volver a preparar
    expect(guard().code).not.toBe(0);
  });

  it('Commit limpio', () => {
    for (let i = 0; i < 50; i++)
      stage(`src/domain/clean${String(i)}.ts`, `export const v${String(i)} = ${String(i)};\n`);
    const started = Date.now();
    const { code, out } = guard();
    const elapsed = Date.now() - started;
    expect(code, out).toBe(0);
    expect(out).toContain('50 fichero(s)');
    expect(elapsed).toBeLessThan(2000);
  });
});

describe('guard-staged --all · CI', () => {
  it('Violación subida sin pre-commit', () => {
    stage('src/application/z.ts', 'export const t = Date.now();\n');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--no-verify', '-m', 'x');
    const { code, out } = guard('--all');
    expect(code).not.toBe(0);
    expect(out).toContain('src/application/z.ts');
    expect(out).toContain('Clock');
  });
});
