#!/usr/bin/env node
// Guardarraíl de procedencia del arte (spec asset-provenance, change 0012, design D8).
// `checkAssets` es pura: recibe la lista de ficheros versionados, la nota de procedencia ya leída y un
// `digest(path) → { sha256, bytes }` inyectado. La ejecuta scripts/guard-staged.mjs (pre-commit y CI).
import { relativePath, runAsHook } from './lib.mjs';

export const PROVENANCE_PATH = 'public/assets/tiny-swords/PROVENANCE.json';

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


/** Reglas de procedencia. Devuelve las líneas de error ([] si cumple). */
export function checkAssets({ files, provenance, digest }) {
  void files;
  void digest;
  if (provenance === undefined) return [];
  return noteProblems(provenance);
}

/** Modo hook de Claude Code: solo las reglas de ruta (las copias por shell no pasan por aquí). */
export function check(toolInput = {}, projectDir = undefined) {
  const path = relativePath(toolInput.file_path, projectDir);
  return FREE_PACK.test(path) ? [`${path}: ruta del Tiny Swords Free Pack, que no es CC0.`] : [];
}

await runAsHook(import.meta.url, check);
