#!/usr/bin/env node
// Guardarraíl de procedencia del arte (spec asset-provenance, change 0012, design D8).
// Modo hook registrado en .claude/settings.json (verify-report W5).
// `checkAssets` es pura: recibe la lista de ficheros versionados, la nota de procedencia ya leída y un
// `digest(path) → { sha256, bytes }` inyectado. La ejecuta scripts/guard-staged.mjs (pre-commit y CI).
import { relativePath, runAsHook } from './lib.mjs';

/** Nota de procedencia (design D8; en content/ por R6: Vite no importa JSON de public/). */
export const PROVENANCE_PATH = 'content/asset-provenance.json';

const HEADER = {
  pack: 'Tiny Swords',
  author: 'Pixel Frog',
  version: 'Update 010',
  license: 'CC0',
};
const VERSION = HEADER.version;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const FREE_PACK = /free[ _]?pack/i;
const GRAPHIC = /\.(png|jpe?g|gif|webp|svg|ico|bmp|aseprite)$/i;
const FORBIDDEN_EXT = /\.(aseprite|zip|rar|7z|tar|gz)$/i;
const FORBIDDEN_NAMES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);
const NOTE = `Nota de procedencia (${PROVENANCE_PATH})`;

const isText = (v) => typeof v === 'string' && v.trim() !== '';

function headerProblems(provenance) {
  const problems = [];
  for (const [field, expected] of Object.entries(HEADER)) {
    const value = provenance[field];
    if (!isText(value)) problems.push(`${NOTE}: falta el campo "${field}".`);
    else if (value !== expected)
      problems.push(`${NOTE}: "${field}" vale "${value}"; debe ser "${expected}".`);
  }
  if (!isText(provenance.confirmedOn))
    problems.push(`${NOTE}: falta el campo "confirmedOn" (fecha de la confirmación CC0).`);
  else if (!DATE.test(provenance.confirmedOn))
    problems.push(`${NOTE}: "confirmedOn" debe ser una fecha AAAA-MM-DD.`);
  return problems;
}

function entryProblems(entry, i) {
  const at = `${NOTE}: files[${i}]`;
  const problems = [];
  for (const field of ['path', 'source']) {
    if (!isText(entry?.[field])) problems.push(`${at}.${field} ausente o vacío.`);
  }
  if (entry?.version !== VERSION) problems.push(`${at}.version debe ser "${VERSION}".`);
  if (!SHA256.test(String(entry?.sha256 ?? '')))
    problems.push(`${at}.sha256 ausente o no es un SHA-256 en hexadecimal.`);
  if (!Number.isInteger(entry?.bytes) || entry.bytes < 0)
    problems.push(`${at}.bytes ausente o no es un entero ≥ 0.`);
  return problems;
}

function noteProblems(provenance) {
  const problems = headerProblems(provenance);
  const entries = Array.isArray(provenance.files) ? provenance.files : [];
  if (entries.length === 0) problems.push(`${NOTE}: "files" debe tener al menos una entrada.`);
  const seen = new Set();
  entries.forEach((entry, i) => {
    problems.push(...entryProblems(entry, i));
    const path = entry?.path;
    if (!isText(path)) return;
    if (seen.has(path)) problems.push(`${NOTE}: entrada repetida para ${path}.`);
    seen.add(path);
    if (FREE_PACK.test(String(entry.source ?? '')))
      problems.push(`${path}: su origen es del Tiny Swords Free Pack, que no es CC0.`);
  });
  return problems;
}
/** Reglas de ruta de un fichero versionado: prohibidos y Free Pack. */
function pathProblems(path) {
  const problems = [];
  const name = path.split('/').pop() ?? '';
  if (FORBIDDEN_NAMES.has(name.toLowerCase()) || FORBIDDEN_EXT.test(name))
    problems.push(`${path}: fichero prohibido en el repositorio (sistema, edición o comprimido).`);
  if (FREE_PACK.test(path))
    problems.push(`${path}: ruta del Tiny Swords Free Pack, que no es CC0.`);
  return problems;
}

function digestProblems(entry, digest) {
  const actual = digest(entry.path);
  const problems = [];
  if (actual.sha256 !== entry.sha256)
    problems.push(`${entry.path}: el sha256 del fichero no coincide con la nota.`);
  if (actual.bytes !== entry.bytes)
    problems.push(`${entry.path}: bytes = ${actual.bytes}, la nota dice ${entry.bytes}.`);
  return problems;
}

/** Reglas de procedencia. Devuelve las líneas de error ([] si cumple). */
export function checkAssets({ files, provenance, digest }) {
  const problems = files.flatMap(pathProblems);
  const entries = Array.isArray(provenance?.files) ? provenance.files : [];
  const registered = new Set(entries.map((e) => e?.path).filter(isText));
  const versioned = new Set(files);
  for (const path of files) {
    if (GRAPHIC.test(path) && !FORBIDDEN_EXT.test(path) && !registered.has(path))
      problems.push(`${path}: asset gráfico sin entrada en ${PROVENANCE_PATH}.`);
  }
  if (provenance === undefined) return problems;
  problems.push(...noteProblems(provenance));
  for (const entry of entries) {
    if (!isText(entry?.path)) continue;
    if (!versioned.has(entry.path))
      problems.push(`${entry.path}: la nota lo registra pero no está versionado.`);
    else problems.push(...digestProblems(entry, digest));
  }
  return problems;
}

/** Modo hook de Claude Code: solo las reglas de ruta (las copias por shell no pasan por aquí). */
export function check(toolInput = {}, projectDir = undefined) {
  return pathProblems(relativePath(toolInput.file_path, projectDir));
}

await runAsHook(import.meta.url, check);
