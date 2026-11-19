#!/usr/bin/env node
// Guardarraíl 1/3 fuera de Claude Code: aplica las MISMAS reglas de .claude/hooks/ a cualquier autor
// (persona, Claude desde la app, otros agentes). No duplica reglas: importa el `check()` que exporta cada hook
// (el mismo que usa Claude Code vía stdin) y lo ejecuta en proceso sobre cada fichero.
//
//   node scripts/guard-staged.mjs         → contenido PREPARADO de los ficheros del commit (pre-commit)
//   node scripts/guard-staged.mjs --all   → todos los ficheros versionados (CI)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { check as checkArchitecture } from '../.claude/hooks/guard-architecture.mjs';
import { check as checkSecrets } from '../.claude/hooks/guard-secrets.mjs';

const CHECKS = [checkSecrets, checkArchitecture];
const BINARY = /\.(png|jpe?g|gif|webp|ico|bmp|mp3|ogg|wav|woff2?|ttf|otf|zip|gz|pdf)$/i;
const MAX_BUFFER = 256 * 1024 * 1024;

const all = process.argv.includes('--all');
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

const git = (args, input) => execFileSync('git', args, { cwd: root, input, maxBuffer: MAX_BUFFER });

const listed = all
  ? git(['ls-files', '-z'])
  : git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']);
const files = listed
  .toString('utf8')
  .split('\0')
  .filter((f) => f && !BINARY.test(f));

/**
 * Contenido preparado (índice) de todos los ficheros con UNA sola llamada a git.
 * Formato de `git cat-file --batch`: "<sha> <tipo> <bytes>\n<contenido>\n" o "<objeto> missing\n".
 */
function readIndex(paths) {
  const out = git(['cat-file', '--batch'], paths.map((p) => `:${p}\n`).join(''));
  const contents = new Map();
  let pos = 0;
  for (const path of paths) {
    const eol = out.indexOf(0x0a, pos);
    const header = out.toString('utf8', pos, eol);
    pos = eol + 1;
    if (header.endsWith(' missing')) continue;
    const size = Number(header.split(' ')[2]);
    contents.set(path, out.toString('utf8', pos, pos + size));
    pos += size + 1;
  }
  return contents;
}

/** En --all (CI), el contenido versionado en disco. */
function readDisk(paths) {
  return new Map(paths.map((p) => [p, readFileSync(join(root, p), 'utf8')]));
}

const contents = all ? readDisk(files) : readIndex(files);
const failures = [];
for (const path of files) {
  const content = contents.get(path);
  if (content === undefined) {
    failures.push(`No se pudo leer ${path} del índice de git.`);
    continue;
  }
  for (const check of CHECKS) {
    const lines = check({ file_path: path, content }, root);
    if (lines.length > 0) failures.push(lines.join('\n'));
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n\n'));
  console.error(
    `\n✖ guard: ${failures.length} problema(s) en ${files.length} fichero(s). ` +
      'No uses --no-verify: el CI aplica las mismas reglas.',
  );
  process.exit(1);
}
console.log(
  `✔ guard: ${files.length} fichero(s) revisados${all ? ' (todo el repo)' : ' (preparados)'}.`,
);
