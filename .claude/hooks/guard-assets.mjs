#!/usr/bin/env node
// Guardarraíl de procedencia del arte (spec asset-provenance, change 0012, design D8).
// Modo hook registrado en .claude/settings.json (verify-report W5).
// `checkAssets` es pura: recibe la lista de ficheros versionados, la nota de procedencia ya leída y un
// `digest(path) → { sha256, bytes }` inyectado. La ejecuta scripts/guard-staged.mjs (pre-commit y CI).
// 0034 (ADR-0030): lista aparte `generated[]` de imágenes con IA, solo en `public/assets/icons/`,
// con `generatedPolicy` apuntando al ADR; la cabecera del pack y el Free Pack solo afectan a `files[]`.
// 0035 (ADR-0031): lista aparte `sounds[]` de audio CC0 (kenney.nl, opengameart.org, freesound.org),
// solo en `public/assets/audio/`; un audio no vale en ninguna otra lista.
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
/** Ficheros de audio (0035): cada uno con registro en `sounds[]`, solo en su carpeta. */
export const AUDIO = /\.(ogg|mp3|wav|flac)$/i;
/** Carpeta del audio (0035, design D13). */
export const AUDIO_DIR = 'public/assets/audio/';

/** Reglas de ruta de un fichero versionado: prohibidos, Free Pack y audio fuera de su carpeta. */
function pathProblems(path) {
  const problems = [];
  const name = path.split('/').pop() ?? '';
  if (FORBIDDEN_NAMES.has(name.toLowerCase()) || FORBIDDEN_EXT.test(name))
    problems.push(`${path}: fichero prohibido en el repositorio (sistema, edición o comprimido).`);
  if (FREE_PACK.test(path))
    problems.push(`${path}: ruta del Tiny Swords Free Pack, que no es CC0.`);
  if (AUDIO.test(path) && !path.startsWith(AUDIO_DIR))
    problems.push(`${path}: fichero de audio fuera de ${AUDIO_DIR}.`);
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

/** Carpeta de los iconos generados con IA (0034, ADR-0030): la única que admite `generated[]`. */
export const AI_DIR = 'public/assets/icons/';
/** Carpeta de los ADR: `generatedPolicy` debe apuntar a un fichero versionado dentro. */
const ADR_DIR = 'docs/adr/';
const PNG = /\.png$/;
const GENERATED_TEXT_FIELDS = ['path', 'tool', 'terms', 'prompt'];
const GENERATED_FIELDS = new Set([
  ...GENERATED_TEXT_FIELDS,
  'createdOn',
  'postProcess',
  'sha256',
  'bytes',
]);

/** `AAAA-MM-DD` y fecha de calendario real (`2026-02-30` no lo es). */
function isCalendarDate(value) {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const generatedListOf = (provenance) =>
  Array.isArray(provenance?.generated) ? provenance.generated : [];

/** Campos de un registro de `generated[]` (design D8, regla 3). */
function generatedFieldProblems(entry, at) {
  const problems = [];
  for (const field of GENERATED_TEXT_FIELDS) {
    if (!isText(entry?.[field])) problems.push(`${at}: "${field}" ausente o vacío.`);
  }
  if (!isCalendarDate(entry?.createdOn))
    problems.push(`${at}: "createdOn" debe ser una fecha de calendario AAAA-MM-DD.`);
  if (!SHA256.test(String(entry?.sha256 ?? '')))
    problems.push(`${at}: "sha256" ausente o no es un SHA-256 en hexadecimal.`);
  if (!Number.isInteger(entry?.bytes) || entry.bytes < 0)
    problems.push(`${at}: "bytes" ausente o no es un entero ≥ 0.`);
  for (const field of Object.keys(entry ?? {})) {
    if (!GENERATED_FIELDS.has(field)) problems.push(`${at}: campo desconocido "${field}".`);
  }
  return problems;
}

/** Un registro de `generated[]`: campos, carpeta de iconos, post-proceso, fichero y digest. */
function generatedEntryProblems(entry, i, versioned, digest) {
  const path = isText(entry?.path) ? entry.path : `generated[${i}]`;
  const at = `${NOTE}: imagen con IA ${path}`;
  const problems = generatedFieldProblems(entry, at);
  if (entry?.postProcess !== undefined && !versioned.has(entry.postProcess))
    problems.push(`${at}: "postProcess" apunta a ${entry.postProcess}, que no está versionado.`);
  if (!isText(entry?.path)) return problems;
  if (!entry.path.startsWith(AI_DIR) || !PNG.test(entry.path))
    problems.push(`${entry.path}: imagen con IA fuera de ${AI_DIR} (solo iconos .png, ADR-0030).`);
  if (!versioned.has(entry.path)) {
    problems.push(`${entry.path}: la nota la registra como imagen con IA pero no está versionada.`);
    return problems;
  }
  const actual = digest(entry.path);
  if (SHA256.test(String(entry.sha256 ?? '')) && actual.sha256 !== entry.sha256)
    problems.push(`${at}: el "sha256" del fichero (${actual.sha256}) no coincide con la nota.`);
  if (Number.isInteger(entry.bytes) && actual.bytes !== entry.bytes)
    problems.push(`${at}: "bytes" = ${actual.bytes}, la nota dice ${entry.bytes}.`);
  return problems;
}

/** Lista `generated[]` (0034, ADR-0030): política, registros, repetidos y rutas en dos listas. */
function generatedProblems(files, provenance, digest) {
  const generated = generatedListOf(provenance);
  const versioned = new Set(files);
  const problems = [];
  const policy = provenance?.generatedPolicy;
  if (generated.length > 0 && !isText(policy))
    problems.push(`${NOTE}: falta "generatedPolicy" (ruta del ADR de las imágenes con IA).`);
  if (isText(policy) && (!policy.startsWith(ADR_DIR) || !versioned.has(policy)))
    problems.push(`${policy}: "generatedPolicy" debe ser un ADR versionado en ${ADR_DIR}.`);
  const others = new Set(
    [...(provenance?.files ?? []), ...(provenance?.fonts ?? [])].map((e) => e?.path),
  );
  const seen = new Set();
  generated.forEach((entry, i) => {
    problems.push(...generatedEntryProblems(entry, i, versioned, digest));
    const path = entry?.path;
    if (!isText(path)) return;
    if (seen.has(path)) problems.push(`${NOTE}: entrada repetida para ${path}.`);
    seen.add(path);
    if (others.has(path)) problems.push(`${path}: figura en dos listas de ${PROVENANCE_PATH}.`);
  });
  return problems;
}

/** Gráficos de la carpeta de iconos: solo `.png` y solo en `generated[]` (regla 1). */
function iconDirProblems(files, provenance) {
  const generated = new Set(generatedListOf(provenance).map((e) => e?.path));
  const art = new Set((provenance?.files ?? []).map((e) => e?.path));
  const problems = [];
  for (const path of files) {
    if (!path.startsWith(AI_DIR) || !GRAPHIC.test(path)) continue;
    if (!PNG.test(path)) problems.push(`${path}: en ${AI_DIR} solo se admiten iconos .png.`);
    if (art.has(path))
      problems.push(`${path}: un icono de ${AI_DIR} no puede estar en la lista de arte "files".`);
    else if (!generated.has(path) && PNG.test(path))
      problems.push(`${path}: icono sin entrada en "generated" de ${PROVENANCE_PATH}.`);
  }
  return problems;
}

const SOUND_LICENSE = 'CC0';
const SOUND_HOSTS = new Set(['kenney.nl', 'opengameart.org', 'freesound.org']);
const SOUND_TEXT_FIELDS = ['path', 'title', 'author'];
const SOUND_FIELDS = new Set([
  ...SOUND_TEXT_FIELDS,
  'url',
  'license',
  'downloadedOn',
  'sha256',
  'bytes',
]);

const soundListOf = (provenance) => (Array.isArray(provenance?.sounds) ? provenance.sounds : []);

/** URL `https:` de uno de los tres hosts CC0 (con o sin `www.`), sin red. */
function isSoundUrl(value) {
  if (typeof value !== 'string') return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && SOUND_HOSTS.has(url.hostname.replace(/^www\./, ''));
}

/** Campos de un registro de `sounds[]` (design 0035 D13, regla 3). */
function soundFieldProblems(entry, at) {
  const problems = [];
  for (const field of SOUND_TEXT_FIELDS) {
    if (!isText(entry?.[field])) problems.push(`${at}: "${field}" ausente o vacío.`);
  }
  if (!isSoundUrl(entry?.url))
    problems.push(`${at}: "url" debe ser https de ${[...SOUND_HOSTS].join(', ')}.`);
  if (entry?.license !== SOUND_LICENSE)
    problems.push(`${at}: "license" debe ser "${SOUND_LICENSE}".`);
  if (!isCalendarDate(entry?.downloadedOn))
    problems.push(`${at}: "downloadedOn" debe ser una fecha de calendario AAAA-MM-DD.`);
  if (!SHA256.test(String(entry?.sha256 ?? '')))
    problems.push(`${at}: "sha256" ausente o no es un SHA-256 en hexadecimal.`);
  if (!Number.isInteger(entry?.bytes) || entry.bytes < 0)
    problems.push(`${at}: "bytes" ausente o no es un entero ≥ 0.`);
  for (const field of Object.keys(entry ?? {})) {
    if (!SOUND_FIELDS.has(field)) problems.push(`${at}: campo desconocido "${field}".`);
  }
  return problems;
}

/** Un registro de `sounds[]`: campos, carpeta de audio, fichero versionado y digest. */
function soundEntryProblems(entry, i, versioned, digest) {
  const path = isText(entry?.path) ? entry.path : `sounds[${i}]`;
  const at = `${NOTE}: audio ${path}`;
  const problems = soundFieldProblems(entry, at);
  if (!isText(entry?.path)) return problems;
  if (!entry.path.startsWith(AUDIO_DIR) || !AUDIO.test(entry.path))
    problems.push(
      `${entry.path}: audio registrado fuera de ${AUDIO_DIR} (.ogg, .mp3, .wav o .flac).`,
    );
  if (!versioned.has(entry.path)) {
    problems.push(`${entry.path}: la nota lo registra como audio pero no está versionado.`);
    return problems;
  }
  const actual = digest(entry.path);
  if (SHA256.test(String(entry.sha256 ?? '')) && actual.sha256 !== entry.sha256)
    problems.push(`${at}: el "sha256" del fichero (${actual.sha256}) no coincide con la nota.`);
  if (Number.isInteger(entry.bytes) && actual.bytes !== entry.bytes)
    problems.push(`${at}: "bytes" = ${actual.bytes}, la nota dice ${entry.bytes}.`);
  return problems;
}

/** Lista `sounds[]` (0035): audio sin registro, registros, repetidos y audio en otras listas. */
function soundProblems(files, provenance, digest) {
  const sounds = soundListOf(provenance);
  const registered = new Set(sounds.map((e) => e?.path).filter(isText));
  const versioned = new Set(files);
  const problems = files
    .filter((path) => AUDIO.test(path) && !registered.has(path))
    .map((path) => `${path}: fichero de audio sin registro en "sounds" de ${PROVENANCE_PATH}.`);
  const others = [
    ...(provenance?.files ?? []),
    ...(provenance?.fonts ?? []),
    ...generatedListOf(provenance),
  ]
    .map((e) => e?.path)
    .filter(isText);
  for (const path of others.filter((p) => AUDIO.test(p)))
    problems.push(`${path}: un fichero de audio solo puede registrarse en "sounds".`);
  const otherSet = new Set(others);
  const seen = new Set();
  sounds.forEach((entry, i) => {
    problems.push(...soundEntryProblems(entry, i, versioned, digest));
    const path = entry?.path;
    if (!isText(path)) return;
    if (seen.has(path)) problems.push(`${NOTE}: entrada repetida para ${path}.`);
    seen.add(path);
    if (otherSet.has(path)) problems.push(`${path}: figura en dos listas de ${PROVENANCE_PATH}.`);
  });
  return problems;
}

/** Rutas de la lista de audio de la nota (`sounds[]`, 0035): no valen como hoja ni como icono. */
export function soundPaths(provenance) {
  return soundListOf(provenance)
    .map((e) => e?.path)
    .filter(isText);
}

/** Reglas de procedencia. Devuelve las líneas de error ([] si cumple). */
export function checkAssets({ files, provenance, digest }) {
  const problems = files.flatMap(pathProblems);
  const entries = Array.isArray(provenance?.files) ? provenance.files : [];
  const registered = new Set(
    [...entries, ...generatedListOf(provenance)].map((e) => e?.path).filter(isText),
  );
  const versioned = new Set(files);
  for (const path of files) {
    if (GRAPHIC.test(path) && !FORBIDDEN_EXT.test(path) && !registered.has(path))
      problems.push(`${path}: asset gráfico sin entrada en ${PROVENANCE_PATH}.`);
  }
  problems.push(...fontProblems(files, provenance, digest));
  if (provenance === undefined) return problems;
  problems.push(...iconDirProblems(files, provenance));
  problems.push(...generatedProblems(files, provenance, digest));
  problems.push(...soundProblems(files, provenance, digest));
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
