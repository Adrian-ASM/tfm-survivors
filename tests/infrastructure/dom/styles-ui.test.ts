import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  type UiPieceRole,
} from '../../../src/infrastructure/content/appearanceSchema';
import { screenCorners, uiMargins } from '../../../src/infrastructure/phaser/ui/nineSlice';
import { boxSides, declOf, evalLength, parseCss, stylesText, type CssEnv } from '../../support/css';
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
    // 0036: la × ya no está en el flujo (posición absoluta), ver «La × y el centrado».
    for (const fixed of ['.shop-panel h2', '.shop-panel__gold']) {
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

// Change 0036 (design D1, D2, D4 y D6): la × de los cuatro modales, el centrado de los botones de
// una sola etiqueta, los iconos de recurso mayores y la imagen del edificio de la obra.
const MODALS = ['.shop-panel', '.build-panel', '.guide-modal', '.sound-panel'] as const;
const CLOSE = ':is(.shop-panel, .build-panel, .guide-modal, .sound-panel) > .ui-close';
/** Reglas de fila, que no son botones de una sola etiqueta y conservan su disposición. */
const ROW = /__product|__option/;
/** ¿Alguno de sus selectores alcanza a un `button` de un panel (o a la ×)? */
const targetsButton = (sel: string) =>
  / button(:|$|\s)/.test(sel) || sel.endsWith(' button') || sel.includes('.ui-close');
const singleLabelRules = rules.filter((r) =>
  r.selectors.some(
    (s) => targetsButton(s) && !ROW.test(s) && !s.startsWith('.is-mobile .touch-bar'),
  ),
);

describe('La × y el centrado en la hoja de estilos (0036)', () => {
  it('Scenario: Reglas de centrado (ni izquierda ni extremos en los botones de una sola etiqueta)', () => {
    expect(singleLabelRules.length).toBeGreaterThan(5);
    for (const r of singleLabelRules) {
      const sel = r.selectors.join(', ');
      expect(r.decls.get('text-align'), sel).not.toBe('left');
      expect(r.decls.get('justify-content') ?? '', sel).not.toMatch(/space-between|flex-start/);
    }
    expect(declOf(rules, BUTTON, 'text-align')).toBe('center');
    // Las reglas de las filas quedan acotadas a ellas y ganan a la común por especificidad.
    expect(declOf(rules, '.shop-panel .shop-panel__product', 'text-align')).toBe('left');
    expect(declOf(rules, '.build-panel .build-panel__option', 'display')).toBe('grid');
    for (const sel of ['.shop-panel button', '.build-panel button']) {
      const r = rules.filter((x) => x.selectors.includes(sel));
      expect(r.some((x) => x.decls.has('text-align') || x.decls.has('justify-content'))).toBe(
        false,
      );
    }
    expect(stylesText()).not.toContain('.shop-panel__leave');
    expect(stylesText()).not.toContain('.build-panel__leave');
    expect(stylesText()).not.toContain('.sound-panel__actions');
  });

  it('Scenario: Reglas de centrado (relleno = margen de la pieza × k en cada lado)', () => {
    const m = buttonMargins;
    for (const k of [1, 2]) {
      const want = [m.top * k, m.right * k, m.bottom * k, m.left * k];
      // La × pinta las esquinas a media escala: relleno = ancho pintado = margen × k / 2.
      const half = want.map((v) => v / 2);
      expect(boxSides(declOf(rules, CLOSE, 'padding'), buttonEnv(k, 16))).toEqual(half);
      expect(boxSides(declOf(rules, CLOSE, 'border-image-width'), buttonEnv(k, 16))).toEqual(half);
      for (const p of PANELS) {
        const pad = boxSides(declOf(rules, `${p} button`, 'padding'), buttonEnv(k, FONT_PX[p]));
        expect(pad, `${p} ×${String(k)}`).toEqual(want);
      }
    }
  });

  it('Scenario: Los siete paneles con la pieza de panel (la × con las piezas de botón)', () => {
    // La × es un `button` de uno de los paneles: hereda la pieza de cada estado sin reasignarla.
    const close = rules.filter((r) => r.selectors.includes(CLOSE));
    expect(close).toHaveLength(1);
    const decls = close[0]?.decls ?? new Map<string, string>();
    for (const prop of ['border-image-source', '--ui-b-src', 'border', 'background', 'outline']) {
      expect(decls.has(prop), prop).toBe(false);
    }
    for (const sel of [BUTTON, HOVER, ACTIVE, FOCUS]) {
      for (const m of MODALS) expect(sel).toContain(m);
    }
  });

  it('× en la esquina: a margen de panel × k del borde, 48 × k más su borde, en los 4 modales', () => {
    const m = panelMargins;
    for (const k of [1, 2]) {
      const env = buttonEnv(k, 16);
      // El −1 descuenta el borde de 1 px del recuadro: la distancia al borde exterior es t·k y r·k.
      expect(evalLength(declOf(rules, CLOSE, 'top'), env) + 1).toBe(m.top * k);
      expect(evalLength(declOf(rules, CLOSE, 'right'), env) + 1).toBe(m.right * k);
      const side = evalLength(declOf(rules, CLOSE, 'width'), env);
      expect(side).toBe(48 * k + 2);
      expect(evalLength(declOf(rules, CLOSE, 'height'), env)).toBe(side);
      // Cara visible = caja − esquinas pintadas (márgenes de la pieza × k / 2 en la ×): el centro
      // de la caja de contenido es el suyo.
      const pad = boxSides(declOf(rules, CLOSE, 'padding'), env);
      const content = { w: side - 2 - pad[1] - pad[3], h: side - 2 - pad[0] - pad[2] };
      const contentCenter = { x: 1 + pad[3] + content.w / 2, y: 1 + pad[0] + content.h / 2 };
      const h = k / 2;
      const face = {
        x: buttonMargins.left * h + (side - (buttonMargins.left + buttonMargins.right) * h) / 2,
        y: buttonMargins.top * h + (side - (buttonMargins.top + buttonMargins.bottom) * h) / 2,
      };
      expect(contentCenter).toEqual(face);
    }
    expect(declOf(rules, CLOSE, 'position')).toBe('absolute');
    expect(declOf(rules, CLOSE, 'place-items')).toBe('unsafe center');
    expect(declOf(rules, CLOSE, 'place-content')).toBe('unsafe center');
    for (const p of MODALS) expect(declOf(rules, p, 'position')).toBe('relative');
  });

  it('el título y la cabecera dejan sitio a la × (56 × k): tienda, obra, guía y Sonido', () => {
    const env = { emPx: 16, vars: { '--ui-scale': 2 } };
    for (const p of MODALS) expect(evalLength(declOf(rules, p, '--ui-close-room'), env)).toBe(112);
    expect(declOf(rules, '.shop-panel h2', 'margin-inline')).toBe('var(--ui-close-room)');
    expect(declOf(rules, '.build-panel h2', 'margin-inline')).toBe('var(--ui-close-room)');
    expect(declOf(rules, '.guide-modal__header', 'padding-right')).toBe('var(--ui-close-room)');
    expect(declOf(rules, '.sound-panel__header', 'padding-inline')).toBe('var(--ui-close-room)');
    // La regla del margen va detrás de la de `margin: 0` de los títulos (si no, la anularía).
    const last = (sel: string, prop: string) =>
      rules
        .map((r, i) => (r.selectors.includes(sel) && r.decls.has(prop) ? i : -1))
        .sort((a, b) => b - a)[0] ?? -1;
    expect(last('.build-panel h2', 'margin-inline')).toBeGreaterThan(
      last('.build-panel h2', 'margin'),
    );
    expect(last('.shop-panel h2', 'margin-inline')).toBeGreaterThan(
      last('.shop-panel h2', 'margin'),
    );
  });

  it('× en móvil: la regla táctil de 44 × 44 px alcanza a los botones de los cuatro modales', () => {
    for (const p of MODALS) {
      expect(declOf(rules, `.is-mobile ${p} button`, 'min-width')).toBe('44px');
      expect(declOf(rules, `.is-mobile ${p} button`, 'min-height')).toBe('44px');
    }
    // A escala 1 (la de móvil) la × ya mide 50 × 50 px CSS.
    expect(evalLength(declOf(rules, CLOSE, 'width'), buttonEnv(1, 16))).toBeGreaterThanOrEqual(44);
  });

  it('castle-shop · Scenario: Tienda con desplazamiento interno a ×1 en 1.280 × 720 (la × fuera de la lista)', () => {
    // Posición absoluta respecto al recuadro: no se desplaza con la lista ni entra en su flujo.
    expect(declOf(rules, CLOSE, 'position')).toBe('absolute');
    expect(declOf(rules, '.shop-panel', 'position')).toBe('relative');
    expect(
      rules.some((r) => r.selectors.some((s) => s.includes('.shop-panel__products .ui-close'))),
    ).toBe(false);
  });

  it('menu-guide · Scenario: Iconos de la guía mayores (cuadrado de más de 2em)', () => {
    for (const k of [1, 2]) {
      const env = { emPx: 16 * k, vars: { '--ui-scale': k } };
      const w = evalLength(declOf(rules, '.resource-icon', 'width'), env);
      expect(evalLength(declOf(rules, '.resource-icon', 'height'), env)).toBe(w);
      expect(w).toBeGreaterThan(2 * 16 * k);
      expect(w).toBeGreaterThan(32 * k);
    }
  });

  it('build-sites · Scenario: Iconos de recurso mayores (saldo y filas: cuadrado de más de 2em)', () => {
    const env = { emPx: 14, vars: { '--ui-scale': 1 } };
    const w = evalLength(declOf(rules, '.resource-icon', 'width'), env);
    expect(evalLength(declOf(rules, '.resource-icon', 'height'), env)).toBe(w);
    expect(w).toBeGreaterThan(2 * 14);
    // Ninguna regla de la obra cambia su tamaño: el mismo en el saldo y en las filas.
    const resized = rules.filter(
      (r) =>
        r.selectors.some((s) => s.includes('resource-icon') && s !== '.resource-icon') &&
        (r.decls.has('width') || r.decls.has('height')),
    );
    expect(resized).toEqual([]);
  });

  it('build-sites · Scenario: Proporción del icono del edificio (alto 3,5em ≥ 3em, ancho auto)', () => {
    const env = { emPx: 14, vars: { '--ui-scale': 1 } };
    const h = evalLength(declOf(rules, '.build-panel__icon', 'height'), env);
    expect(h).toBeGreaterThanOrEqual(evalLength(declOf(rules, '.resource-icon', 'height'), env));
    expect(declOf(rules, '.build-panel__icon', 'width')).toBe('auto');
    expect(declOf(rules, '.build-panel__icon', 'image-rendering')).toBe('pixelated');
    // Con los atributos del frame, el ancho en pantalla es alto × w / h: 128 : 192 y 128 : 256.
    expect((h * 128) / 192).toBeCloseTo(32.67, 1);
    expect((h * 128) / 256).toBeCloseTo(24.5, 1);
    expect(declOf(rules, '.build-panel__icon[hidden]', 'display')).toBe('none');
  });

  it('build-sites · Scenario: Explicación en una fila no asequible (tinta muted de su pieza)', () => {
    expect(declOf(rules, '.build-panel__about', 'color')).toBe('var(--ui-b-muted, #c8c8d8)');
    expect(declOf(rules, DISABLED, '--ui-b-muted')).toBe(
      'var(--ui-button-disabled-on-muted, #c8c8d8)',
    );
    // La explicación va en su propia celda de la rejilla, distinta del nombre y del coste: nombre,
    // explicación y coste en tres líneas de la misma columna (el coste no estrecha el texto).
    expect(declOf(rules, '.build-panel__name', 'grid-row')).toBe('1');
    expect(declOf(rules, '.build-panel__about', 'grid-row')).toBe('2');
    expect(declOf(rules, '.build-panel__cost', 'grid-row')).toBe('3');
    expect(declOf(rules, '.build-panel__cost', 'grid-column')).toBe('2');
    expect(() => declOf(rules, '.build-panel__about', 'overflow-wrap')).toThrow();
  });
});
