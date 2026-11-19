#!/usr/bin/env node
// Guardarraíl de seguridad: evita que la IA cree ficheros de secretos o pegue credenciales en el repo.
import { relativePath, newContent, runAsHook } from './lib.mjs';

const SECRET_PATTERNS = [
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, msg: 'Clave privada PEM' },
  { re: /\bsb_secret_[A-Za-z0-9_-]{10,}/, msg: 'Secret key de Supabase' },
  { re: /service_role/i, msg: 'service_role de Supabase en código cliente', onlyIn: 'src/' },
  { re: /\bgh[pousr]_[A-Za-z0-9]{30,}/, msg: 'Token de GitHub' },
  { re: /\bGOCSPX-[A-Za-z0-9_-]{20,}/, msg: 'Client secret de Google OAuth' },
  { re: /\bsk-[A-Za-z0-9_-]{20,}/, msg: 'API key de un proveedor de IA' },
];

const RULE_FILES = new Set([
  '.claude/hooks/guard-secrets.mjs',
  '.claude/hooks/guard-architecture.mjs',
]);

/** Ficheros de secretos y credenciales pegadas. Devuelve las líneas del bloqueo o [] si cumple. */
export function check(toolInput = {}, projectDir = undefined) {
  const path = relativePath(toolInput.file_path, projectDir);
  const fileName = path.split('/').pop() ?? '';

  if (/^\.env(\..+)?$/.test(fileName) && fileName !== '.env.example') {
    return [
      `Guardarraíl de seguridad: no se permite escribir ${path}.`,
      'Usa .env.example con valores de ejemplo.',
    ];
  }

  // Solo los ficheros que DEFINEN las reglas pueden contener los patrones como texto (verify-report S13).
  if (RULE_FILES.has(path)) return [];

  const text = newContent(toolInput);
  const found = SECRET_PATTERNS.filter(
    ({ re, onlyIn }) => (!onlyIn || path.startsWith(onlyIn)) && re.test(text),
  ).map(({ msg }) => `- ${msg}`);
  if (found.length === 0) return [];
  return [`Guardarraíl de seguridad: posible secreto en ${path}`, ...found, 'Ver AGENTS.md §6.'];
}

await runAsHook(import.meta.url, check);
