import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assetUrl, fontUrl } from '../../../src/composition/assetUrl';
import {
  UI_PIECES,
  contrastRatio,
  type UiAppearance,
} from '../../../src/infrastructure/content/appearanceSchema';
import { applyUiKit, cssRole, uiKitVariables } from '../../../src/infrastructure/dom/uiKit';
import { repoAppearance } from '../../support/mapArt';

// Spec sprite-rendering (0032): "Variables solo de las piezas cargadas", "URLs de las piezas y de
// la fuente bajo la base" y "Reserva del panel con el relleno de la pieza".
const root = join(import.meta.dirname, '..', '..', '..');
const BASE = '/tfm-survivors/';
const ui: UiAppearance = repoAppearance().ui;
const url = (file: string): string => assetUrl(BASE, file);
const all = new Set(UI_PIECES.map((r) => ui.pieces[r].image));
const urlIn = (value: string | undefined): string => /^url\("(.+)"\)$/.exec(value ?? '')?.[1] ?? '';

describe('uiKitVariables (0032, design §4)', () => {
  it('Scenario: Variables solo de las piezas cargadas (las 8 cargadas)', () => {
    const vars = uiKitVariables(ui, all, url);
    for (const role of UI_PIECES) {
      const name = `--ui-${cssRole(role)}`;
      expect(urlIn(vars[`${name}-src`])).toMatch(/^\/tfm-survivors\/assets\/tiny-swords\/UI\//);
      expect(vars[`${name}-slice`]).toMatch(/^\d+ \d+ \d+ \d+$/);
      for (const ink of ['fill', 'text', 'muted', 'accent', 'danger']) {
        expect(vars[`${name}-${ink}`]).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
    expect(vars['--ui-panel-slice']).toBe('16 16 16 16');
    expect(vars['--ui-button-slice']).toBe('20 20 28 20');
    expect(vars['--ui-header-slice']).toBe('0 48 0 48');
    expect(vars['--ui-header-h']).toBe('64');
    expect(vars['--ui-panel-text']).toBe('#2b1d0e');
    expect(vars['--ui-button-on-text']).toBe('#10222e');
    expect(vars['--ui-button-on-bg']).toBe('transparent');
    expect(vars['--ui-disabled-opacity']).toBe('1');
    expect(vars['--ui-font']).toBe('"Departure Mono", monospace');
  });

  it('Scenario: Variables solo de las piezas cargadas (todas menos panel)', () => {
    const loaded = new Set([...all].filter((f) => f !== ui.pieces.panel.image));
    const full = uiKitVariables(ui, all, url);
    const vars = uiKitVariables(ui, loaded, url);
    const missing = Object.keys(full).filter((k) => !(k in vars));
    expect(missing.sort()).toEqual(
      [
        '--ui-panel-src',
        '--ui-panel-slice',
        '--ui-panel-t',
        '--ui-panel-r',
        '--ui-panel-b',
        '--ui-panel-l',
        '--ui-panel-on-text',
        '--ui-panel-on-muted',
        '--ui-panel-on-accent',
        '--ui-panel-on-danger',
        '--ui-panel-on-bg',
      ].sort(),
    );
    expect(vars['--ui-panel-fill']).toBe('#cbb18d');
    expect(vars['--ui-font']).toBe('"Departure Mono", monospace');
  });

  it('sin ninguna pieza cargada: rellenos, tintas y fuente, sin imágenes ni márgenes', () => {
    const vars = uiKitVariables(ui, new Set(), url);
    expect(Object.keys(vars).filter((k) => /-(src|slice|[trbl]|h|on-\w+)$/.test(k))).toEqual([]);
    expect(vars['--ui-disabled-opacity']).toBeUndefined();
    expect(vars['--ui-font']).toBe('"Departure Mono", monospace');
  });

  it('Scenario: URLs de las piezas y de la fuente bajo la base', () => {
    const vars = uiKitVariables(ui, all, url);
    const urls = UI_PIECES.map((r) => urlIn(vars[`--ui-${cssRole(r)}-src`]));
    const font = fontUrl(BASE, ui.font.file);
    expect(font).toBe('/tfm-survivors/assets/fonts/DepartureMono-Regular.woff2');
    for (const u of [...urls, font]) {
      expect(u.startsWith('/tfm-survivors/assets/')).toBe(true);
      expect(u).not.toMatch(/^(https?:|\/\/|data:)/);
      expect(u).not.toMatch(/["()]/);
      // Vite copia `public/` entero a `dist/`: el fichero referido existe en `public/`.
      expect(existsSync(join(root, 'public', decodeURIComponent(u.slice(BASE.length))))).toBe(true);
    }
    expect(urls.every((u) => u.startsWith('/tfm-survivors/assets/tiny-swords/UI/'))).toBe(true);
    expect(readFileSync(join(root, 'src', 'styles.css'), 'utf8')).not.toContain('url(');
  });

  it('Scenario: Reserva del panel con el relleno de la pieza', () => {
    const vars = uiKitVariables(
      ui,
      new Set([...all].filter((f) => f !== ui.pieces.panel.image)),
      url,
    );
    expect(vars['--ui-panel-fill']).toBe('#cbb18d');
    expect(vars['--ui-panel-text']).toBe('#2b1d0e');
    expect(contrastRatio(ui.pieces.panel.ink.text, ui.pieces.panel.fill)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(vars['--ui-panel-src']).toBeUndefined();
    // El borde de 1 px de la reserva lo declara la hoja de estilos (styles-ui.test.ts).
  });

  it('applyUiKit escribe cada variable con setProperty', () => {
    const written = new Map<string, string>();
    applyUiKit({ setProperty: (n, v) => written.set(n, v) }, { '--a': '1', '--b': 'x' });
    expect([...written]).toEqual([
      ['--a', '1'],
      ['--b', 'x'],
    ]);
  });
});
