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
/** Ficheros de fuente (0032): cada uno con registro en `fonts[]`, licencia OFL 1.1. */
export const FONT = /\.(woff2?|ttf|otf)$/i;
const FONT_LICENSE = 'OFL-1.1';
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

/** Campos de texto obligatorios de un registro de fuente (0032, ADR-0028). */
const FONT_TEXT_FIELDS = ['path', 'family', 'author', 'source', 'version', 'licenseFile'];

/** Un registro de `fonts[]`: campos, licencia OFL 1.1, fichero y licencia versionados, digest. */
function fontEntryProblems(entry, i, versioned, digest) {
  const path = isText(entry?.path) ? entry.path : `fonts[${i}]`;
  const at = `${NOTE}: fuente ${path}`;
  const problems = [];
  for (const field of FONT_TEXT_FIELDS) {
    if (!isText(entry?.[field])) problems.push(`${at}: "${field}" ausente o vacío.`);
  }
  if (entry?.license !== FONT_LICENSE)
    problems.push(`${at}: "license" debe ser "${FONT_LICENSE}".`);
  if (!SHA256.test(String(entry?.sha256 ?? '')))
    problems.push(`${at}: "sha256" ausente o no es un SHA-256 en hexadecimal.`);
  if (!Number.isInteger(entry?.bytes) || entry.bytes < 0)
    problems.push(`${at}: "bytes" ausente o no es un entero ≥ 0.`);
  if (isText(entry?.licenseFile) && !versioned.has(entry.licenseFile))
    problems.push(`${entry.licenseFile}: fichero de licencia de ${path} no versionado.`);
  if (!isText(entry?.path)) return problems;
  if (!versioned.has(entry.path)) {
    problems.push(`${entry.path}: la nota la registra como fuente pero no está versionada.`);
    return problems;
  }
  const actual = digest(entry.path);
  if (SHA256.test(String(entry.sha256 ?? '')) && actual.sha256 !== entry.sha256)
    problems.push(`${at}: el "sha256" del fichero no coincide con la nota.`);
  if (Number.isInteger(entry.bytes) && actual.bytes !== entry.bytes)
    problems.push(`${at}: "bytes" = ${actual.bytes}, la nota dice ${entry.bytes}.`);
  return problems;
}

/** Fuentes versionadas sin registro y registros de `fonts[]` (lista aparte del arte CC0). */
function fontProblems(files, provenance, digest) {
  const fonts = Array.isArray(provenance?.fonts) ? provenance.fonts : [];
  const registered = new Set(fonts.map((f) => f?.path).filter(isText));
  const versioned = new Set(files);
  const problems = files
    .filter((path) => FONT.test(path) && !registered.has(path))
    .map((path) => `${path}: fichero de fuente sin registro en "fonts" de ${PROVENANCE_PATH}.`);
  fonts.forEach((entry, i) => problems.push(...fontEntryProblems(entry, i, versioned, digest)));
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
  problems.push(...fontProblems(files, provenance, digest));
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
