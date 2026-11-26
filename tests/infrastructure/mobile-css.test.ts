import { describe, expect, it } from 'vitest';
import { declOf, parseCss, splitTop } from '../support/css';

// Spec mobile-display y touch-controls (0033): reglas de `src/styles.css` bajo `.is-mobile` (sin
// navegador; las medidas reales las cubre el E2E móvil). Design §6.
const rules = parseCss();
const PANELS = [
  'menu-panel',
  'pause-panel',
  'confirm-dialog',
  'guide-modal',
  // 0035: el panel Sonido es un panel DOM más (spec mobile-display, "Paneles DOM en modo móvil").
  'sound-panel',
  'results-panel',
  'shop-panel',
  'build-panel',
];

/**
 * Evalúa en px una longitud con `calc`, sumas, restas, productos, `env(name, d)` y `var(--x)`.
 * Suficiente para las reglas del modo móvil (no es un motor CSS).
 */
function px(expr: string, env: Record<string, number>, vars: Record<string, string> = {}): number {
  let s = expr;
  for (let i = 0; i < 10; i++) {
    s = s
      .replace(
        /env\(([\w-]+)(?:,\s*[^()]*)?\)/g,
        (_m, name: string) => `${String(env[name] ?? 0)}px`,
      )
      .replace(/var\((--[\w-]+)\)/g, (_m, name: string) => vars[name] ?? 'NaN');
  }
  return sum(s.replace(/calc\(/g, '('));
}

function sum(expr: string): number {
  const s = expr.trim();
  if (s.startsWith('(') && closing(s) === s.length - 1) return sum(s.slice(1, -1));
  const terms = splitSigned(s);
  if (terms.length > 1) return terms.reduce((a, [sign, t]) => a + sign * sum(t), 0);
  const factors = splitTop(s, '*');
  if (factors.length > 1) return factors.map(sum).reduce((a, b) => a * b, 1);
  const v = /^(-?[\d.]+)(px|vw|dvh|em)?$/.exec(s);
  if (!v) throw new Error(`no soportado: ${s}`);
  return Number(v[1]);
}

const closing = (s: string): number => {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    if (s[i] === ')' && --depth === 0) return i;
  }
  return -1;
};

/** Términos de una suma o resta de primer nivel, con su signo. */
function splitSigned(s: string): [number, string][] {
  const out: [number, string][] = [];
  let depth = 0;
  let start = 0;
  let sign = 1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if ((c === '+' || c === '-') && depth === 0 && s[i - 1] === ' ' && s[i + 1] === ' ') {
      out.push([sign, s.slice(start, i)]);
      sign = c === '+' ? 1 : -1;
      start = i + 1;
    }
  }
  out.push([sign, s.slice(start)]);
  return out;
}

const decl = (selector: string, prop: string) => declOf(rules, selector, prop);
const RESERVE_VARS = { '--touch-bar-reserve': decl('html.is-mobile', '--touch-bar-reserve') };

describe('styles.css · modo móvil (0033)', () => {
  it('todas las reglas nuevas cuelgan de .is-mobile (la cascada de escritorio no cambia)', () => {
    const touchRules = rules.filter((r) =>
      r.selectors.some((s) => /touch-bar|rotate-notice|safe-area|dvh/.test(s)),
    );
    const mobileOnly = rules
      .filter((r) => [...r.decls.values()].some((v) => /safe-area|dvh|--touch-bar/.test(v)))
      .concat(touchRules);
    expect(mobileOnly.length).toBeGreaterThan(0);
    for (const r of mobileOnly) {
      expect(r.selectors.every((s) => s.includes('is-mobile'))).toBe(true);
    }
  });

  it('Scenario: Arrastre sin desplazar la página (sin zoom, rebote ni selección; alto dinámico)', () => {
    for (const sel of ['html.is-mobile', '.is-mobile body']) {
      expect(decl(sel, 'touch-action')).toBe('none');
      expect(decl(sel, 'overscroll-behavior')).toBe('none');
      expect(decl(sel, 'user-select')).toBe('none');
      expect(decl(sel, '-webkit-touch-callout')).toBe('none');
      expect(decl(sel, 'height')).toBe('100dvh');
    }
  });

  it('Scenario: Paneles en un móvil horizontal (cada panel se desplaza dentro de sí mismo)', () => {
    for (const p of PANELS) {
      const sel = `.is-mobile .${p}`;
      expect(decl(sel, 'overflow-y')).toBe('auto');
      expect(decl(sel, 'touch-action')).toBe('pan-y');
      expect(decl(sel, 'max-height')).toBe('calc(100dvh - 2em - var(--safe-area-block))');
    }
  });

  it('Scenario: Botones operativos tras desplazar (44 × 44 en paneles y barra, sin doble toque)', () => {
    for (const p of [...PANELS, 'touch-bar']) {
      const sel = `.is-mobile .${p} button`;
      expect([decl(sel, 'min-width'), decl(sel, 'min-height')]).toEqual(['44px', '44px']);
      expect(decl(sel, 'touch-action')).toBe('manipulation');
    }
  });

  it('Scenario: La barra no tapa los paneles (844 px: el panel acaba antes que la barra)', () => {
    const viewport = 844;
    const reserve = px('var(--touch-bar-reserve)', { 'safe-area-inset-right': 0 }, RESERVE_VARS);
    const maxPanel = viewport - 2 * reserve;
    const panelRight = (viewport + maxPanel) / 2;
    const right = px(decl('.is-mobile .touch-bar', 'right'), {});
    const barWidth = 3 * 44 + 2 * px(decl('.is-mobile .touch-bar', 'gap'), {});
    const barLeft = viewport - right - barWidth;

    for (const p of PANELS) {
      expect(decl(`.is-mobile .${p}`, 'max-width')).toBe(
        'calc(100vw - 2 * var(--touch-bar-reserve))',
      );
    }
    expect(panelRight).toBeLessThanOrEqual(barLeft);
  });

  it('Scenario: Tamaño y zonas seguras (márgenes de 47 px a la derecha y 21 px abajo)', () => {
    const insets = { 'safe-area-inset-right': 47, 'safe-area-inset-bottom': 21 };
    const bar = '.is-mobile .touch-bar';

    expect(decl(bar, 'position')).toBe('fixed');
    expect(px(decl(bar, 'right'), insets)).toBeGreaterThanOrEqual(47);
    expect(px(decl(bar, 'bottom'), insets)).toBeGreaterThanOrEqual(21);
    const button = `${bar} button`;
    expect([decl(button, 'width'), decl(button, 'height')]).toEqual(['44px', '44px']);
    expect(decl('.is-mobile body', 'padding')).toContain('env(safe-area-inset-right, 0px)');
  });

  it('el aviso de orientación tapa todo (fijo, a pantalla completa y por encima de la barra)', () => {
    const notice = '.is-mobile .rotate-notice';
    expect([decl(notice, 'position'), decl(notice, 'inset')]).toEqual(['fixed', '0']);
    expect(Number(decl(notice, 'z-index'))).toBeGreaterThan(
      Number(decl('.is-mobile .touch-bar', 'z-index')),
    );
    expect(decl(`${notice}[hidden]`, 'display')).toBe('none');
    expect(decl('.is-mobile .touch-bar button[hidden]', 'display')).toBe('none');
  });
});
