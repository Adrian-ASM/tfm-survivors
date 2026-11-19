import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Escenarios "Guardarraíl en pre-commit" con `git commit` DE VERDAD (verify-report W7): repo temporal con copias
// de .husky/pre-commit, scripts/guard-staged.mjs y .claude/hooks/. core.hooksPath apunta a un shim que hace lo
// mismo que el `_/h` de husky 9 (`sh -e .husky/pre-commit`); `.husky/_` no se copia porque es generado.
// `npx` se sustituye por un stub: lint-staged/ESLint no son resolubles fuera del proyecto y, además, taparían
// el guardarraíl (ESLint también rechaza Math.random). El stub registra con qué se le llamó.
const root = join(import.meta.dirname, '..', '..');
let sandbox: string;
let repo: string;

const PATH_KEY = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
const posix = (path: string) => path.replaceAll('\\', '/');

function executable(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  chmodSync(path, 0o755);
}

function git(...args: string[]) {
  const bin = join(sandbox, 'bin');
  const env = { ...process.env, [PATH_KEY]: `${bin}${delimiter}${process.env[PATH_KEY] ?? ''}` };
  const r = spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], {
    cwd: repo,
    env,
    encoding: 'utf8',
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

function stage(path: string, content: string): void {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), content);
  git('add', '-f', path);
}

const hasCommit = () => git('rev-parse', '--verify', '-q', 'HEAD').code === 0;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'pre-commit-'));
  repo = join(sandbox, 'repo');
  mkdirSync(repo);
  git('init', '-q');
  for (const path of ['.husky/pre-commit', 'scripts/guard-staged.mjs', '.claude/hooks']) {
    cpSync(join(root, path), join(repo, path), { recursive: true });
  }
  executable(
    join(sandbox, 'hooks', 'pre-commit'),
    '#!/bin/sh\nexec sh -e .husky/pre-commit "$@"\n',
  );
  const log = posix(join(sandbox, 'npx.log'));
  executable(join(sandbox, 'bin', 'npx'), `#!/bin/sh\necho "$@" >> "${log}"\n`);
  git('config', 'core.hooksPath', posix(join(sandbox, 'hooks')));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('pre-commit · git commit real con .husky/pre-commit', () => {
  it('Aleatoriedad global en el dominio: el commit se aborta y no se crea', () => {
    stage('src/domain/x.ts', 'export const r = Math.random();\n');
    const { code, out } = git('commit', '-m', 'x');
    expect(code).not.toBe(0);
    expect(out).toContain('src/domain/x.ts');
    expect(out).toContain('RandomGenerator');
    expect(hasCommit()).toBe(false);
  });

  it('Fichero de secretos: el commit se aborta y no se crea', () => {
    stage('.env.local', 'TOKEN=abc\n');
    const { code, out } = git('commit', '-m', 'x');
    expect(code).not.toBe(0);
    expect(out).toContain('.env.example');
    expect(hasCommit()).toBe(false);
  });

  it('Commit limpio: pasa por lint-staged y el guardarraíl y se crea el commit', () => {
    stage('src/domain/ok.ts', 'export const v = 1;\n');
    const { code, out } = git('commit', '-m', 'ok');
    expect(code, out).toBe(0);
    expect(out).toContain('guard: 1 fichero(s) revisados');
    expect(readFileSync(join(sandbox, 'npx.log'), 'utf8')).toContain('lint-staged');
    expect(hasCommit()).toBe(true);
  });

  it('El dominio importa el motor: el commit se aborta y no se crea', () => {
    stage('src/domain/y.ts', "import Phaser from 'phaser';\nexport const P = Phaser;\n");
    const { code, out } = git('commit', '-m', 'x');
    expect(code).not.toBe(0);
    expect(out).toContain('src/domain/y.ts');
    expect(out).toContain('El dominio no puede importar el motor');
    expect(hasCommit()).toBe(false);
  });

  it('Se evalúa lo preparado, no el disco: el commit se aborta y no se crea', () => {
    stage('src/domain/x.ts', 'export const r = Math.random();\n');
    writeFileSync(join(repo, 'src/domain/x.ts'), 'export const r = 4;\n'); // corregido sin preparar
    const { code, out } = git('commit', '-m', 'x');
    expect(code).not.toBe(0);
    expect(out).toContain('RandomGenerator');
    expect(hasCommit()).toBe(false);
  });
});
