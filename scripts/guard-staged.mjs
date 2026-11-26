#!/usr/bin/env node
// Guardarraíl 1/3 fuera de Claude Code: aplica las MISMAS reglas de .claude/hooks/ a cualquier autor
// (persona, Claude desde la app, otros agentes). No duplica reglas: importa el `check()` que exporta cada hook
// (el mismo que usa Claude Code vía stdin) y lo ejecuta en proceso sobre cada fichero.
//
//   node scripts/guard-staged.mjs         → contenido PREPARADO de los ficheros del commit (pre-commit)
//   node scripts/guard-staged.mjs --all   → todos los ficheros versionados (CI)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { check as checkArchitecture } from '../.claude/hooks/guard-architecture.mjs';
import {
  AUDIO,
  CREDITS_PATH,
  FONT,
  PROVENANCE_PATH,
  checkAssets,
} from '../.claude/hooks/guard-assets.mjs';
import { check as checkSecrets } from '../.claude/hooks/guard-secrets.mjs';

const CHECKS = [checkSecrets, checkArchitecture];
const BINARY = /\.(png|jpe?g|gif|webp|ico|bmp|mp3|ogg|wav|flac|woff2?|ttf|otf|zip|gz|pdf)$/i;
const MAX_BUFFER = 256 * 1024 * 1024;
// Assets cuyo hash comprueba la nota de procedencia (las imágenes, siempre binarias: design R2).
const ASSET = /\.(png|jpe?g|gif|webp|svg|ico|bmp|aseprite)$/i;

const all = process.argv.includes('--all');
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

const git = (args, input) => execFileSync('git', args, { cwd: root, input, maxBuffer: MAX_BUFFER });

const paths = (args) =>
  git(args)
    .toString('utf8')
    .split('\0')
    .filter((f) => f && !BINARY.test(f));

// En --all, un fichero versionado pero borrado del disco (sin preparar) no se puede leer: se omite con aviso.
const deleted = new Set(all ? paths(['ls-files', '--deleted', '-z']) : []);
const files = (
  all
    ? paths(['ls-files', '-z'])
    : paths(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
).filter((f) => !deleted.has(f));
for (const path of deleted) console.warn(`⚠ guard: ${path} está borrado del disco; se omite.`);

/**
 * Contenido preparado (índice) de todos los ficheros con UNA sola llamada a git.
 * Formato de `git cat-file --batch`: "<sha> <tipo> <bytes>\n<contenido>\n" o "<objeto> missing\n".
 */
function readIndexBlobs(paths) {
  const blobs = new Map();
  if (paths.length === 0) return blobs;
  const out = git(['cat-file', '--batch'], paths.map((p) => `:${p}\n`).join(''));
  let pos = 0;
  for (const path of paths) {
    const eol = out.indexOf(0x0a, pos);
    const header = out.toString('utf8', pos, eol);
    pos = eol + 1;
    if (header.endsWith(' missing')) continue;
    const size = Number(header.split(' ')[2]);
    blobs.set(path, out.subarray(pos, pos + size));
    pos += size + 1;
  }
  return blobs;
}

function readIndex(paths) {
  const blobs = readIndexBlobs(paths);
  return new Map([...blobs].map(([path, blob]) => [path, blob.toString('utf8')]));
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

failures.push(...provenanceFailures());

/**
 * Pasada global de procedencia del arte (design D8 de 0012), una vez en los dos modos: lista del índice
 * (`git ls-files`; en pre-commit incluye lo preparado) y bytes leídos del índice, iguales en Windows y Linux.
 */
function provenanceFailures() {
  const versioned = git(['ls-files', '-z']).toString('utf8').split('\0').filter(Boolean);
  // 0032: también las fuentes, cuyo sha256 comprueba `fonts[]` de la nota; 0035: el audio
  // (`sounds[]`) y `CREDITS.md`, cuyas líneas comprueban las entradas con atribución.
  const wanted = versioned.filter(
    (f) =>
      f === PROVENANCE_PATH || f === CREDITS_PATH || ASSET.test(f) || FONT.test(f) || AUDIO.test(f),
  );
  const blobs = readIndexBlobs(wanted);
  const note = blobs.get(PROVENANCE_PATH);
  let provenance;
  if (note !== undefined) {
    try {
      provenance = JSON.parse(note.toString('utf8'));
    } catch (error) {
      return [`${PROVENANCE_PATH}: no es JSON válido (${error.message}).`];
    }
  }
  const digest = (path) => {
    const blob = blobs.get(path) ?? Buffer.alloc(0);
    return { sha256: createHash('sha256').update(blob).digest('hex'), bytes: blob.length };
  };
  const creditsBlob = blobs.get(CREDITS_PATH);
  const credits = creditsBlob === undefined ? undefined : creditsBlob.toString('utf8');
  const lines = checkAssets({ files: versioned, provenance, digest, credits });
  return lines.length > 0 ? [lines.join('\n')] : [];
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
