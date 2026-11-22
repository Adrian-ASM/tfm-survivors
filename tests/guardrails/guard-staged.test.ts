import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Escenarios "Guardarraíl en pre-commit" (spec architecture-guardrails): scripts/guard-staged.mjs (que importa
// los check() de .claude/hooks/) sobre un repo git temporal. El cableado con `git commit` real está en
// pre-commit.test.ts.
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

  it('lee el índice en lote sin desalinear contenidos (multibyte, espacios, sin salto final)', () => {
    stage('src/domain/ñandú con espacio.ts', 'export const s = "€ — ñ";');
    stage('docs/notas.md', `# Diseño\n\n${'ñ€'.repeat(40)}\n`); // 200 bytes, 81 caracteres
    stage('src/domain/z.ts', 'export const r = Math.random();\n');
    const { code, out } = guard();
    expect(code).not.toBe(0);
    expect(out).toContain('src/domain/z.ts');
    expect(out).not.toContain('ñandú');
    expect(out).toContain('RandomGenerator');
    expect(out).not.toContain('No se pudo leer');
  });
});

// Spec asset-provenance (0012, design D8): pasada global sobre `git ls-files` con el contenido del índice.
const NOTE_PATH = 'public/assets/tiny-swords/PROVENANCE.json';
const PNG_PATH = 'public/assets/tiny-swords/Terrain/Ground/Tilemap_Flat.png';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x0d, 0x0a, 0x7f]);

function stageBinary(path: string, content: Buffer): void {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), content);
  git('add', '-f', path);
}

function noteFor(sha256: string, bytes: number): string {
  const files = [
    {
      path: PNG_PATH,
      source: 'Tiny Swords (Update 010)/Terrain/Ground/Tilemap_Flat.png',
      version: 'Update 010',
      sha256,
      bytes,
    },
  ];
  const note = {
    pack: 'Tiny Swords',
    author: 'Pixel Frog',
    version: 'Update 010',
    license: 'CC0',
    confirmedOn: '2026-11-22',
    homepage: 'https://pixelfrog-assets.itch.io/tiny-swords',
    note: 'CC0',
    files,
  };
  return `${JSON.stringify(note, null, 2)}\n`;
}

const sha256Of = (b: Buffer) => createHash('sha256').update(b).digest('hex');

describe('guard-staged · procedencia del arte', () => {
  it('Scenario: Verify en rojo (PNG versionado sin entrada en la nota)', () => {
    stageBinary(PNG_PATH, PNG);
    const { code, out } = guard();
    expect(code).not.toBe(0);
    expect(out).toContain(PNG_PATH);
  });

  it('Scenario: Verify en rojo también en --all (CI)', () => {
    stageBinary(PNG_PATH, PNG);
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--no-verify', '-m', 'x');
    const { code, out } = guard('--all');
    expect(code).not.toBe(0);
    expect(out).toContain(PNG_PATH);
  });

  it('Scenario: Sin red ni pack (PNG con su entrada y su hash: pasa en los dos modos)', () => {
    stageBinary(PNG_PATH, PNG);
    stage(NOTE_PATH, noteFor(sha256Of(PNG), PNG.length));
    const staged = guard();
    expect(staged.code, staged.out).toBe(0);
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--no-verify', '-m', 'x');
    const all = guard('--all');
    expect(all.code, all.out).toBe(0);
  });

  it('el hash se calcula sobre los bytes del índice (sin conversión de finales de línea)', () => {
    stageBinary(PNG_PATH, PNG);
    stage(NOTE_PATH, noteFor('0'.repeat(64), PNG.length));
    const { code, out } = guard();
    expect(code).not.toBe(0);
    expect(out).toContain('sha256');
  });

  it('un .DS_Store preparado bloquea el commit', () => {
    stage('public/assets/.DS_Store', 'x');
    const { code, out } = guard();
    expect(code).not.toBe(0);
    expect(out).toContain('public/assets/.DS_Store');
  });

  it('una nota que no es JSON se informa sin traza', () => {
    stageBinary(PNG_PATH, PNG);
    stage(NOTE_PATH, '{ no es json');
    const { code, out } = guard();
    expect(code).not.toBe(0);
    expect(out).toContain(NOTE_PATH);
    expect(out).not.toContain('at JSON.parse');
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

  it('un fichero versionado borrado del disco se omite con un aviso, sin traza (S14)', () => {
    stage('src/domain/gone.ts', 'export const g = 1;\n');
    stage('src/domain/kept.ts', 'export const k = 2;\n');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--no-verify', '-m', 'x');
    rmSync(join(repo, 'src/domain/gone.ts'));
    const { code, out } = guard('--all');
    expect(code, out).toBe(0);
    expect(out).toContain('src/domain/gone.ts');
    expect(out).toContain('1 fichero(s) revisados');
    expect(out).not.toContain('ENOENT');
  });
});
