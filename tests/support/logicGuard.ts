/**
 * Guarda del proyecto `logic` (design 0014 §5, criterio de éxito de la proposal): los tests sin
 * `@realtime`, y el preámbulo de un fichero que no es entero de tiempo real, no esperan al reloj
 * (`waitForTimeout`, `playChoosingFirst` ni `expect.poll` sobre el tick del snapshot).
 * Análisis de texto, sin ejecutar la spec: se apoya en la forma de las specs del repo.
 */

/** Specs que tienen tests de `logic` y que la guarda vigila. */
export const LOGIC_GUARDED_SPECS: readonly string[] = [
  'manual-step.spec.ts',
  'level-up.spec.ts',
  'health.spec.ts',
  'enemies.spec.ts',
  'weapons.spec.ts',
  'results.spec.ts',
  'progress.spec.ts',
  'pause.spec.ts',
  'clear-progress.spec.ts',
];

export type ClockWaitRule = 'waitForTimeout' | 'playChoosingFirst' | 'poll-tick';

export interface ClockWait {
  readonly line: number;
  readonly rule: ClockWaitRule;
}

interface Masked {
  /** Fuente con los comentarios en blanco (los textos se conservan: etiquetas). */
  readonly code: string;
  /** Fuente con comentarios y contenido de textos en blanco (estructura y detección). */
  readonly bare: string;
}

const blank = (ch: string): string => (ch === '\n' ? '\n' : ' ');

/** Enmascara comentarios y literales de texto conservando posiciones y saltos de línea. */
function mask(source: string): Masked {
  let code = '';
  let bare = '';
  // Pila de modos: 'c' código, "'" o '"' texto, '`' plantilla; en código, llaves abiertas.
  const stack: { mode: string; braces: number }[] = [{ mode: 'c', braces: 0 }];
  for (let i = 0; i < source.length; i += 1) {
    const ch = source.charAt(i);
    const next = source.charAt(i + 1);
    const top = stack[stack.length - 1] ?? { mode: 'c', braces: 0 };
    if (top.mode === 'c') {
      if (ch === '/' && (next === '/' || next === '*')) {
        const end = next === '/' ? source.indexOf('\n', i) : source.indexOf('*/', i + 2) + 2;
        const stop = end <= 0 || end < i ? source.length : end;
        const gap = source.slice(i, stop).replace(/[^\n]/g, ' ');
        code += gap;
        bare += gap;
        i = stop - 1;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') stack.push({ mode: ch, braces: 0 });
      else if (ch === '{') top.braces += 1;
      else if (ch === '}') {
        if (top.braces === 0 && stack.length > 1) stack.pop();
        else top.braces -= 1;
      }
      code += ch;
      bare += ch;
      continue;
    }
    code += ch;
    if (ch === '\\') {
      code += next;
      bare += blank(ch) + blank(next);
      i += 1;
      continue;
    }
    if (ch === top.mode) {
      stack.pop();
      bare += ch;
    } else if (top.mode === '`' && ch === '$' && next === '{') {
      stack.push({ mode: 'c', braces: 0 });
      code += next;
      bare += '${';
      i += 1;
    } else {
      bare += blank(ch);
    }
  }
  return { code, bare };
}

const OPEN = '([{';
const CLOSE = ')]}';

/** Índice del cierre que empareja con la apertura en `open` (sobre el texto enmascarado). */
function matchClose(bare: string, open: number): number {
  let depth = 0;
  for (let i = open; i < bare.length; i += 1) {
    const ch = bare.charAt(i);
    if (OPEN.includes(ch)) depth += 1;
    else if (CLOSE.includes(ch)) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return bare.length - 1;
}

const TEST_CALL = /test(\.describe(\.(serial|parallel|only|skip))?|\.only|\.skip)?\s*\(/y;
const IDENT = /[\w$.]/;
const REALTIME_TAG = /tag\s*:[^}]*@realtime/;

interface Range {
  readonly start: number;
  readonly end: number;
}

interface Analysis {
  /** Tramos de tests (y cuerpos de describe) sin `@realtime`. */
  readonly logic: Range[];
  /** Tramos fuera de cualquier `test(…)`: preámbulo y código suelto de los describe. */
  readonly loose: Range[];
  /** Hay al menos un test sin `@realtime`. */
  hasLogic: boolean;
}

/** Trocea [start, end) en llamadas `test(…)`/`test.describe(…)` de su nivel y el resto. */
function analyse(m: Masked, start: number, end: number, out: Analysis): void {
  let depth = 0;
  let looseFrom = start;
  for (let i = start; i < end; i += 1) {
    const ch = m.bare.charAt(i);
    if (depth === 0 && !IDENT.test(m.bare.charAt(i - 1))) {
      TEST_CALL.lastIndex = i;
      const call = TEST_CALL.exec(m.bare);
      if (call) {
        const open = i + call[0].length - 1;
        const close = matchClose(m.bare, open);
        const arrow = m.bare.indexOf('=>', open);
        const header = m.code.slice(open, arrow < 0 || arrow > close ? close : arrow);
        if (looseFrom < i) out.loose.push({ start: looseFrom, end: i });
        looseFrom = close + 1;
        if (!REALTIME_TAG.test(header)) {
          if (call[1]?.startsWith('.describe')) {
            // Dentro de las llaves del callback: sus tests quedan a profundidad 0.
            const brace = m.bare.indexOf('{', arrow);
            analyse(m, brace + 1, matchClose(m.bare, brace), out);
          } else {
            out.logic.push({ start: i, end: close + 1 });
            out.hasLogic = true;
          }
        }
        i = close;
        continue;
      }
    }
    if (OPEN.includes(ch)) depth += 1;
    else if (CLOSE.includes(ch)) depth -= 1;
  }
  if (looseFrom < end) out.loose.push({ start: looseFrom, end });
}

const lineAt = (source: string, index: number): number => source.slice(0, index).split('\n').length;

/** Esperas de reloj en un tramo del texto enmascarado. */
function waitsIn(bare: string, range: Range): { index: number; rule: ClockWaitRule }[] {
  const text = bare.slice(range.start, range.end);
  const found: { index: number; rule: ClockWaitRule }[] = [];
  const simple: [RegExp, ClockWaitRule][] = [
    [/\bwaitForTimeout\s*\(/g, 'waitForTimeout'],
    [/\bplayChoosingFirst\s*\(/g, 'playChoosingFirst'],
  ];
  for (const [re, rule] of simple) {
    for (const hit of text.matchAll(re)) found.push({ index: range.start + hit.index, rule });
  }
  for (const hit of text.matchAll(/\bexpect\s*\.\s*poll\s*\(/g)) {
    const open = range.start + hit.index + hit[0].length - 1;
    const args = bare.slice(open, matchClose(bare, open) + 1);
    if (/snapshot/i.test(args) && /\btick\b/.test(args)) {
      found.push({ index: range.start + hit.index, rule: 'poll-tick' });
    }
  }
  return found;
}

/**
 * Esperas de reloj que la guarda no admite en `logic`, en orden de aparición: dentro de tests o
 * describe sin `@realtime` y, si el fichero tiene algún test de `logic`, en el código suelto
 * (preámbulo, helpers, `beforeEach`).
 */
export function findClockWaits(source: string): ClockWait[] {
  const m = mask(source);
  const out: Analysis = { logic: [], loose: [], hasLogic: false };
  analyse(m, 0, m.bare.length, out);
  const ranges = out.hasLogic ? [...out.logic, ...out.loose] : out.logic;
  return ranges
    .flatMap((r) => waitsIn(m.bare, r))
    .sort((a, b) => a.index - b.index)
    .map(({ index, rule }) => ({ line: lineAt(source, index), rule }));
}
