import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Lectura mínima de `src/styles.css` para los tests del kit de UI (0032): reglas planas (el fichero
// no tiene @media ni anidación) y un evaluador de las expresiones de longitud que usa
// (`max(...)`, `calc(var(...) * var(--ui-scale, 1) * 1px)`, `em` y `px`).

export interface CssRule {
  /** Selectores de la lista, con los espacios normalizados. */
  readonly selectors: readonly string[];
  readonly decls: ReadonlyMap<string, string>;
}

const root = join(import.meta.dirname, '..', '..');

export const stylesText = (): string => readFileSync(join(root, 'src', 'styles.css'), 'utf8');

/** Divide por comas de primer nivel (fuera de paréntesis). */
export function splitTop(text: string, sep = ','): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === sep && depth === 0) {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(text.slice(start).trim());
  return out.filter((s) => s !== '');
}

export function parseCss(text = stylesText()): CssRule[] {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = splitTop((m[1] ?? '').replace(/\s+/g, ' ').trim()).map((s) =>
      s.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')'),
    );
    const decls = new Map<string, string>();
    for (const d of (m[2] ?? '').split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      decls.set(
        d.slice(0, i).trim(),
        d
          .slice(i + 1)
          .replace(/\s+/g, ' ')
          .trim(),
      );
    }
    rules.push({ selectors, decls });
  }
  return rules;
}

/** Valor de `prop` en las reglas cuyo selector es exactamente `selector` (la última gana). */
export function declOf(rules: readonly CssRule[], selector: string, prop: string): string {
  let value: string | undefined;
  for (const r of rules) {
    if (r.selectors.includes(selector) && r.decls.has(prop)) value = r.decls.get(prop);
  }
  if (value === undefined) throw new Error(`sin ${prop} para ${selector}`);
  return value;
}

/** Contexto de evaluación: px por em y valor de cada variable (sin ella, su reserva). */
export interface CssEnv {
  readonly emPx: number;
  readonly vars: Readonly<Record<string, number>>;
}

/** Sustituye `var(--x, d)` (anidadas) por el valor del entorno o su reserva. */
function substitute(expr: string, env: CssEnv): string {
  let s = expr;
  for (;;) {
    const m = /var\((--[\w-]+)(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/.exec(s);
    if (!m) return s;
    const name = m[1] ?? '';
    const fallback = m[2]?.trim();
    const value = name in env.vars ? String(env.vars[name]) : (fallback ?? 'NaN');
    s = s.slice(0, m.index) + value + s.slice(m.index + m[0].length);
  }
}

/** Evalúa un término sin `max`: `Nem`, `Npx`, `N` o `calc(a * b * Npx)` (solo productos). */
function term(t: string, env: CssEnv): number {
  const s = t.trim();
  const em = /^(-?[\d.]+)em$/.exec(s);
  if (em) return Number(em[1]) * env.emPx;
  const px = /^(-?[\d.]+)px$/.exec(s);
  if (px) return Number(px[1]);
  if (/^-?[\d.]+$/.test(s)) return Number(s);
  const calc = /^calc\((.*)\)$/.exec(s);
  if (calc) {
    const inner = calc[1] ?? '';
    const sum = /^\((.*)\)\s*\*\s*(.*)$/.exec(inner);
    if (sum) {
      const parts = splitTop(sum[1] ?? '', '+').map((p) => term(p, env));
      return parts.reduce((a, b) => a + b, 0) * term(`calc(${sum[2] ?? ''})`, env);
    }
    return inner
      .split('*')
      .map((f) => term(f, env))
      .reduce((a, b) => a * b, 1);
  }
  const max = /^max\((.*)\)$/.exec(s);
  if (max) return Math.max(...splitTop(max[1] ?? '').map((p) => term(p, env)));
  throw new Error(`término CSS no soportado: ${s}`);
}

/** Evalúa una longitud CSS (un solo valor) en px. */
export function evalLength(expr: string, env: CssEnv): number {
  return term(substitute(expr, env), env);
}

/** Divide un valor de varios lados (`padding`, `border-image-width`) en sus términos. */
export function sides(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const c of value) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ' ' && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
    } else cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

/** Los 4 lados (t, r, b, l) de un valor abreviado de 1 a 4 términos, en px. */
export function boxSides(value: string, env: CssEnv): [number, number, number, number] {
  const v = sides(value).map((s) => evalLength(s, env));
  const [t = 0, r = t, b = t, l = r] = v;
  return [t, r, b, l];
}
