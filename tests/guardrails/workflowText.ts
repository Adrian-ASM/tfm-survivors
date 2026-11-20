// Lectura de workflows de GitHub Actions como texto (design 0011-public-deploy): regex sobre ficheros
// que controla el proyecto, sin dependencia YAML, con el mismo criterio que ci.test.ts. Cada helper
// recibe el texto para poder probar también variantes mutadas.

/** Bloque de claves indentadas con 2 espacios que sigue a la clave de nivel 0 `key:`. */
function topLevelBlock(yaml: string, key: string): { inline: string; body: string } | null {
  const match = new RegExp(`(?:^|\\n)${key}:([^\\n]*)\\n((?:(?: [^\\n]*)?\\n)*)`).exec(yaml);
  if (!match) return null;
  return { inline: (match[1] ?? '').trim(), body: match[2] ?? '' };
}

/** Elementos de una lista YAML en línea (`[a, 'b']`) o de un único valor. */
export function listOf(raw: string | undefined): string[] {
  const text = (raw ?? '').trim();
  const inner = text.startsWith('[') ? text.slice(1, text.lastIndexOf(']')) : text;
  return inner
    .split(',')
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter((item) => item !== '');
}

/** Disparadores del workflow (`on:` en línea, como lista o como bloque), en orden. */
export function triggersOf(yaml: string): string[] {
  const on = topLevelBlock(yaml, 'on');
  if (on === null) return [];
  if (on.inline !== '') return listOf(on.inline);
  return [...on.body.matchAll(/^ {2}([\w-]+):/gm)].map((m) => m[1] ?? '');
}

/** Texto del disparador `name` dentro de `on:` (vacío si no está). */
export function triggerBlock(yaml: string, name: string): string {
  const body = topLevelBlock(yaml, 'on')?.body ?? '';
  return new RegExp(`^ {2}${name}:[^\\n]*\\n(?: {3,}[^\\n]*\\n|\\n)*`, 'm').exec(body)?.[0] ?? '';
}

/** Texto del job `name` dentro de `jobs:` (desde su clave hasta el siguiente job), o null. */
export function jobBlock(yaml: string, name: string): string | null {
  const body = topLevelBlock(yaml, 'jobs')?.body ?? '';
  return new RegExp(`^ {2}${name}:[^\\n]*\\n(?: {3,}[^\\n]*\\n|\\n)*`, 'm').exec(body)?.[0] ?? null;
}

/** Pasos (`- ...` con 6 espacios) de un job, cada uno con sus líneas. */
export function stepsOf(job: string): string[] {
  return job
    .split(/\n(?= {6}- )/)
    .slice(1)
    .map((step) => `${step.trimEnd()}\n`);
}
