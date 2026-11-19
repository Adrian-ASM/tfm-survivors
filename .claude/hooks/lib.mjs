// Utilidades compartidas por los hooks de Claude Code.
// Un hook PreToolUse recibe por stdin un JSON con { tool_name, tool_input, ... }.
// Salir con código 2 bloquea la herramienta y devuelve stderr a Claude como feedback.
// Cada hook exporta además `check(toolInput) → string[]` (líneas del bloqueo; [] si cumple) para que
// scripts/guard-staged.mjs aplique las MISMAS reglas en proceso, sin lanzar un `node` por fichero.
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function readHookInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

/** Ruta relativa al proyecto, con separadores '/', para poder comparar en Windows y Linux. */
export function relativePath(
  filePath,
  projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
) {
  const norm = (p) => p.replaceAll('\\', '/').replace(/\/+$/, '');
  const file = norm(filePath ?? '');
  const root = norm(projectDir);
  const lowerFile = file.toLowerCase();
  const lowerRoot = root.toLowerCase();
  return lowerFile.startsWith(lowerRoot + '/') ? file.slice(root.length + 1) : file;
}

/** Texto nuevo que la herramienta va a escribir (Write: fichero completo; Edit/MultiEdit: fragmentos). */
export function newContent(toolInput = {}) {
  if (typeof toolInput.content === 'string') return toolInput.content;
  if (typeof toolInput.new_string === 'string') return toolInput.new_string;
  if (Array.isArray(toolInput.edits))
    return toolInput.edits.map((e) => e.new_string ?? '').join('\n');
  return '';
}

export function block(lines) {
  process.stderr.write(lines.join('\n') + '\n');
  process.exit(2);
}

/** ¿Se ha ejecutado este módulo con `node <fichero>` (modo hook) en lugar de importarse? */
function isEntryPoint(moduleUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  const canonical = (p) => {
    const real = realpathSync(p);
    return process.platform === 'win32' ? real.toLowerCase() : real;
  };
  try {
    return canonical(fileURLToPath(moduleUrl)) === canonical(resolve(entry));
  } catch {
    return false;
  }
}

/** Modo Claude Code: lee el JSON de stdin y sale con 2 si `check` devuelve líneas. Importado, no hace nada. */
export async function runAsHook(moduleUrl, check) {
  if (!isEntryPoint(moduleUrl)) return;
  const input = await readHookInput();
  const lines = check(input.tool_input ?? {});
  if (lines.length > 0) block(lines);
}
