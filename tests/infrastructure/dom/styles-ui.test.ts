import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  type UiPieceRole,
} from '../../../src/infrastructure/content/appearanceSchema';
import { screenCorners, uiMargins } from '../../../src/infrastructure/phaser/ui/nineSlice';
import { boxSides, declOf, parseCss, stylesText, type CssEnv } from '../../support/css';
import { repoAppearance } from '../../support/mapArt';

// Hoja de estilos del kit de UI (0032, design §4), leída como texto: specs sprite-rendering ("Piezas
// de UI en los paneles DOM", "Reserva de las piezas de UI y de la fuente"), main-menu, menu-guide,
// castle-shop, build-sites y run-results.
const rules = parseCss();
const ui = repoAppearance().ui;
const PANELS = [
  '.menu-panel',
  '.pause-panel',
  '.confirm-dialog',
  '.guide-modal',
  // 0035: el panel Sonido con las mismas piezas que la guía.
  '.sound-panel',
  '.results-panel',
  '.shop-panel',
  '.build-panel',
] as const;
const ALL = `:is(${PANELS.join(', ')})`;
const BUTTON = `${ALL} button`;
const HOVER = `${ALL} button:is(:hover, :focus-visible)`;
const FOCUS = `${ALL} button:focus-visible`;
const ACTIVE = `${ALL} button:active`;
const DISABLED = `${ALL} button:is(:disabled, .is-unavailable)`;
const CONFIRM = '.confirm-dialog__actions button:first-child';
/** Tamaño de letra de cada panel a ×1 (px), el de su `font`. */
const FONT_PX: Record<(typeof PANELS)[number], number> = {
  '.menu-panel': 16,
  '.pause-panel': 16,
  '.confirm-dialog': 16,
  '.guide-modal': 16,
  '.sound-panel': 16,
  '.results-panel': 14,
  '.shop-panel': 14,
  '.build-panel': 14,
};
const panelMargins = uiMargins(ui.pieces.panel);
const buttonMargins = uiMargins(ui.pieces.button);
const css = (role: string) => role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Entorno con la pieza de panel cargada (sus márgenes publicados) y la escala k. */
function panelEnv(k: number, emPx: number): CssEnv {
  const m = panelMargins;
  return {
    emPx: emPx * k,
    vars: {
      '--ui-scale': k,
      '--ui-panel-t': m.top,
      '--ui-panel-r': m.right,
      '--ui-panel-b': m.bottom,
      '--ui-panel-l': m.left,
    },
  };
}
function buttonEnv(k: number, emPx: number): CssEnv {
  const m = buttonMargins;
  return {
    emPx: emPx * k,
    vars: {
      '--ui-scale': k,
      '--ui-b-t': m.top,
      '--ui-b-r': m.right,
      '--ui-b-b': m.bottom,
      '--ui-b-l': m.left,
    },
  };
}
const ge = (got: readonly number[], want: readonly number[]) =>
  got.every((g, i) => g >= (want[i] ?? 0) - 1e-9);

/** `--ui-b-src` del estado: la pieza que pinta ese botón. */
const pieceOf = (selector: string): string => declOf(rules, selector, '--ui-b-src');

describe('Kit de UI en la hoja de estilos (0032)', () => {
  it('Scenario: Esquinas a ×1 y a ×2 (pieza de prueba 24, 20, 24, 28)', () => {
    const m = { left: 24, top: 20, right: 24, bottom: 28 };
    const one = screenCorners(m, 1);
    const two = screenCorners(m, 2);
    expect([one.topLeft, one.topRight, one.bottomLeft, one.bottomRight]).toEqual([
      { width: 24, height: 20 },
      { width: 24, height: 20 },
      { width: 24, height: 28 },
      { width: 24, height: 28 },
    ]);
    expect([two.topLeft, two.topRight, two.bottomLeft, two.bottomRight]).toEqual([
      { width: 48, height: 40 },
      { width: 48, height: 40 },
      { width: 48, height: 56 },
      { width: 48, height: 56 },
    ]);
    // La hoja de estilos pinta las esquinas con esos anchos: margen × --ui-scale px, enteros.
    const width = declOf(rules, '.menu-panel', 'border-image-width');
    for (const k of [1, 2]) {
      const env = {
        emPx: 16,
        vars: { '--ui-scale': k, '--ui-panel-t': 20, '--ui-panel-r': 24, '--ui-panel-b': 28 },
      };
      const sidesPx = boxSides(width, { ...env, vars: { ...env.vars, '--ui-panel-l': 24 } });
      expect(sidesPx).toEqual([20 * k, 24 * k, 28 * k, 24 * k]);
      expect(sidesPx.every(Number.isInteger)).toBe(true);
    }
  });

  it('Scenario: Los siete paneles con la pieza de panel (y sus botones con las de botón)', () => {
    for (const p of PANELS) {
      expect(declOf(rules, p, 'border-image-source')).toBe('var(--ui-panel-src, none)');
      expect(declOf(rules, p, 'border-image-slice')).toBe('var(--ui-panel-slice, 0) fill');
    }
    expect(pieceOf(BUTTON)).toBe('var(--ui-button-src, none)');
    expect(pieceOf(HOVER)).toMatch(/^var\(--ui-button-hover-src,/);
    expect(pieceOf(ACTIVE)).toMatch(/^var\(--ui-button-pressed-src,/);
    expect(pieceOf(DISABLED)).toBe('var(--ui-button-disabled-src, none)');
    expect(pieceOf(CONFIRM)).toBe('var(--ui-button-danger-src, none)');
    expect(pieceOf(`${CONFIRM}:active`)).toMatch(/^var\(--ui-button-danger-pressed-src,/);
    // El estado solo reasigna las variables: la pintura del botón se declara una vez.
    expect(declOf(rules, BUTTON, 'border-image-source')).toBe('var(--ui-b-src)');
    expect(stylesText()).not.toContain('url(');
  });

  it('Scenario: Los siete paneles con la pieza de panel (relleno ≥ margen × k en cada lado)', () => {
    for (const k of [1, 2]) {
      for (const p of PANELS) {
        const pad = boxSides(declOf(rules, p, 'padding'), panelEnv(k, FONT_PX[p]));
        const m = panelMargins;
        expect(
          ge(pad, [m.top * k, m.right * k, m.bottom * k, m.left * k]),
          `${p} ×${String(k)}`,
        ).toBe(true);
      }
      for (const p of PANELS) {
        const pad = boxSides(declOf(rules, `${p} button`, 'padding'), buttonEnv(k, FONT_PX[p]));
        const m = buttonMargins;
        expect(ge(pad, [m.top * k, m.right * k, m.bottom * k, m.left * k]), `${p} button`).toBe(
          true,
        );
      }
      const minHeight = boxSides(declOf(rules, BUTTON, 'min-height'), buttonEnv(k, 16))[0];
      expect(minHeight).toBe((buttonMargins.top + buttonMargins.bottom) * k);
    }
  });

  it('Scenario: Reglas de reserva declaradas en el DOM', () => {
    for (const p of PANELS) {
      const border = p === '.shop-panel' ? '1px solid #f5c542' : '1px solid #7ce2fe';
      expect(declOf(rules, p, 'border'), p).toBe(border);
      expect(declOf(rules, p, 'font-family')).toMatch(/monospace\)$/);
    }
    expect(declOf(rules, BUTTON, 'border')).toBe('1px solid #7ce2fe');
    expect(declOf(rules, BUTTON, 'background')).toBe('var(--ui-b-bg)');
    expect(declOf(rules, BUTTON, '--ui-b-bg')).toBe('var(--ui-button-on-bg, #23233a)');
    expect(declOf(rules, BUTTON, '--ui-b-text')).toBe('var(--ui-button-on-text, #fff)');
    // Reserva del panel: fondo = relleno de panel, texto con su tinta.
    for (const p of PANELS) {
      expect(declOf(rules, p, 'background')).toMatch(
        /^var\(--ui-panel-on-bg, var\(--ui-panel-fill,/,
      );
      expect(declOf(rules, p, 'color')).toBe('var(--ui-panel-text, #fff)');
    }
  });

  it('main-menu · Scenario: Botón deshabilitado, botón con foco y botón de borrado', () => {
    expect(pieceOf(DISABLED)).toContain('--ui-button-disabled-src');
    expect(pieceOf(HOVER)).toContain('--ui-button-hover-src');
    expect(declOf(rules, FOCUS, 'outline')).toMatch(/^2px solid /);
    expect(pieceOf(CONFIRM)).toContain('--ui-button-danger-src');
    // Cancelar es el último botón de la fila: sin regla propia, la de `button`.
    expect(rules.some((r) => r.selectors.some((s) => s.includes(':last-child')))).toBe(false);
  });

  it('main-menu · Scenario: Diálogo con texto legible (tintas con contraste ≥ 4,5)', () => {
    expect(declOf(rules, '.confirm-dialog', 'color')).toBe('var(--ui-panel-text, #fff)');
    expect(declOf(rules, BUTTON, '--ui-b-text')).toContain('--ui-button-on-text');
    expect(declOf(rules, CONFIRM, '--ui-b-text')).toContain('--ui-button-danger-on-text');
    const pairs: UiPieceRole[] = ['panel', 'button', 'buttonDanger'];
    for (const role of pairs) {
      const { fill, ink } = ui.pieces[role];
      expect(contrastRatio(ink.text, fill), role).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('menu-guide · Scenario: Guía dentro del marco a ×1 y a ×2 (≥ margen × k y ≥ 12 px)', () => {
    for (const k of [1, 2]) {
      const pad = boxSides(declOf(rules, '.guide-modal', 'padding'), panelEnv(k, 16));
      const m = panelMargins;
      expect(ge(pad, [m.top * k, m.right * k, m.bottom * k, m.left * k])).toBe(true);
      expect(pad.every((p) => p >= 12)).toBe(true);
    }
    expect(declOf(rules, '.guide-modal__body', 'overflow-y')).toBe('auto');
    expect(declOf(rules, '.guide-modal__body', 'min-height')).toBe('0');
    expect(declOf(rules, '.guide-modal', 'max-height')).toBe('calc(100vh - 2em)');
  });

  it('menu-guide · Scenario: Controles de la guía con piezas de botón', () => {
    for (const sel of [BUTTON, HOVER, ACTIVE]) expect(sel).toContain('.guide-modal');
    expect(pieceOf(BUTTON)).toContain('--ui-button-src');
    expect(pieceOf(HOVER)).toContain('--ui-button-hover-src');
    expect(pieceOf(ACTIVE)).toContain('--ui-button-pressed-src');
  });

  it('cabecera 3-slice en los títulos: alto = alto declarado × k y colas sin deformar', () => {
    const titles = [
      '.menu-panel h1',
      '.pause-panel h2',
      '.guide-modal__header h2',
      '.results-panel__title',
      '.shop-panel h2',
      '.build-panel h2',
    ];
    for (const t of titles) {
      expect(declOf(rules, t, 'border-image-source')).toBe('var(--ui-header-src, none)');
    }
    const header = ui.pieces.header;
    const env = (k: number): CssEnv => ({
      emPx: 16,
      vars: { '--ui-scale': k, '--ui-header-h': 'height' in header ? header.height : 0 },
    });
    expect(boxSides(declOf(rules, titles[0] ?? '', 'height'), env(2))[0]).toBe(128);
    const width = declOf(rules, titles[0] ?? '', 'border-image-width');
    const m = uiMargins(header);
    expect(
      boxSides(width, {
        emPx: 16,
        vars: { '--ui-scale': 2, '--ui-header-l': m.left, '--ui-header-r': m.right },
      }),
    ).toEqual([0, m.right * 2, 0, m.left * 2]);
  });

  it('variables de color con reserva: cada var() de color declara su valor de antes', () => {
    const colors = rules.flatMap((r) =>
      ['color', 'background'].flatMap((p) => (r.decls.has(p) ? [r.decls.get(p) ?? ''] : [])),
    );
    for (const c of colors.filter(
      (v) => v.startsWith('var(--ui-') && !v.startsWith('var(--ui-b-'),
    )) {
      expect(c, c).toMatch(/,/);
    }
  });

  it('castle-shop · Scenario: Filas comprables y no comprables (reglas)', () => {
    expect(declOf(rules, '.shop-panel__notice', 'color')).toBe('var(--ui-b-danger, #ff8a80)');
    expect(declOf(rules, DISABLED, '--ui-b-danger')).toBe(
      'var(--ui-button-disabled-on-danger, #ff8a80)',
    );
    expect(declOf(rules, '.shop-panel__description', 'color')).toBe('var(--ui-b-muted, #c8c8d8)');
    expect(declOf(rules, '.shop-panel__product.is-unavailable', 'opacity')).toBe(
      'var(--ui-disabled-opacity, 0.6)',
    );
    expect(declOf(rules, '.shop-panel__gold', 'color')).toBe('var(--ui-panel-text, #f5c542)');
  });

  it('castle-shop · Scenario: Tienda con desplazamiento interno a ×1 en 1.280 × 720', () => {
    const maxHeight = declOf(rules, '.shop-panel', 'max-height');
    expect(maxHeight).toBe('calc(100vh - 2em)');
    // 100vh − 2em con em = 14 px a ×1: 720 − 28 < 720.
    expect(720 - 2 * 14).toBeLessThan(720);
    const pad = boxSides(declOf(rules, '.shop-panel', 'padding'), panelEnv(1, 14));
    const m = panelMargins;
    expect(ge(pad, [m.top, m.right, m.bottom, m.left])).toBe(true);
    expect(declOf(rules, '.shop-panel__products', 'overflow-y')).toBe('auto');
    expect(declOf(rules, '.shop-panel__products', 'min-height')).toBe('0');
    for (const fixed of ['.shop-panel h2', '.shop-panel__gold', '.shop-panel__leave']) {
      expect(declOf(rules, fixed, 'flex'), fixed).toBe('none');
    }
  });

  it('castle-shop · Scenario: Tienda entera a ×2', () => {
    const pad = boxSides(declOf(rules, '.shop-panel', 'padding'), panelEnv(2, 14));
    const m = panelMargins;
    expect(ge(pad, [m.top * 2, m.right * 2, m.bottom * 2, m.left * 2])).toBe(true);
    // 1.440 − 2·28 < 1.440.
    expect(declOf(rules, '.shop-panel', 'max-height')).toBe('calc(100vh - 2em)');
  });

  it('build-sites · Scenario: Torre no asequible con piezas (cifras que faltan en danger)', () => {
    expect(declOf(rules, '.build-panel__amount.is-short', 'color')).toBe(
      'var(--ui-b-danger, #ff8a80)',
    );
    expect(declOf(rules, '.build-panel__option.is-unavailable', 'opacity')).toBe(
      'var(--ui-disabled-opacity, 0.55)',
    );
  });

  it('build-sites · Scenario: Panel entero dentro del marco (×1 y ×2)', () => {
    for (const k of [1, 2]) {
      const pad = boxSides(declOf(rules, '.build-panel', 'padding'), panelEnv(k, 14));
      const m = panelMargins;
      expect(ge(pad, [m.top * k, m.right * k, m.bottom * k, m.left * k])).toBe(true);
    }
  });

  it('run-results · Scenario: Colores de mensajes y avisos', () => {
    expect(declOf(rules, '.results-panel__notices', 'color')).toBe(
      'var(--ui-panel-danger, #f5c46b)',
    );
    expect(declOf(rules, '.results-panel__message', 'color')).toBe(
      'var(--ui-panel-accent, #7ce2fe)',
    );
    const { fill, ink } = ui.pieces.panel;
    expect(contrastRatio(ink.danger, fill)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ink.accent, fill)).toBeGreaterThanOrEqual(4.5);
  });

  it('run-results · Scenario: Contenido máximo dentro del marco (relleno ≥ márgenes a ×1)', () => {
    const pad = boxSides(declOf(rules, '.results-panel', 'padding'), panelEnv(1, 14));
    const m = panelMargins;
    expect(ge(pad, [m.top, m.right, m.bottom, m.left])).toBe(true);
    expect(declOf(rules, '.results-panel', 'border')).toBe('1px solid #7ce2fe');
  });

  it('las variables de las piezas se llaman como los roles en kebab-case', () => {
    for (const role of ['buttonHover', 'buttonPressed', 'buttonDisabled', 'buttonDanger']) {
      expect(stylesText()).toContain(`--ui-${css(role)}-src`);
    }
  });
});
