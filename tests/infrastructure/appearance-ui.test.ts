import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import appearanceJson from '../../content/appearance.json';
import guideJson from '../../content/guide.json';
import provenanceJson from '../../content/asset-provenance.json';
import { bootContent } from '../../src/composition/contentBoot';
import {
  ASSET_DIR,
  FONT_NOT_REGISTERED,
  SHEET_NOT_REGISTERED,
  UI_DANGER_PIECES,
  UI_HEADER_HEIGHT_MUST_BE_INTEGER,
  UI_INKS,
  UI_INK_CONTRAST,
  UI_MIN_CONTRAST,
  UI_PIECES,
  UI_SLICE_MUST_BE_INTEGER,
  contrastRatio,
  type Appearance,
} from '../../src/infrastructure/content/appearanceSchema';
import {
  parseAppearance,
  registeredPaths,
  uiSheetsOf,
} from '../../src/infrastructure/content/loadAppearance';
import { REGISTERED, rawAppearance, type RawAppearance } from '../support/appearance';
import { rawContent } from '../support/builders';
import { meanColor, readPng } from '../support/png';
import { GENERATED_PATHS } from '../support/generated';

// Spec sprite-rendering (0032), "Datos de aspecto de la interfaz".
const root = join(import.meta.dirname, '..', '..');
const registered = registeredPaths(provenanceJson);

function repository(): Appearance {
  const r = parseAppearance(structuredClone(appearanceJson), registered, GENERATED_PATHS);
  if (!r.ok) throw new Error(`${r.error.field}: ${r.error.message}`);
  return r.value;
}

function failure(change: (raw: RawAppearance) => void): { field: string; message: string } {
  const raw = rawAppearance();
  change(raw);
  const r = parseAppearance(raw, REGISTERED, GENERATED_PATHS);
  if (r.ok) throw new Error('se esperaba un error de datos de aspecto');
  return r.error;
}

const isRed = (rgb: number): boolean => {
  const r = rgb >> 16;
  return r >= 96 && r >= 2 * ((rgb >> 8) & 0xff) && r >= 2 * (rgb & 0xff);
};
const hex = (rgb: number): [number, number, number] => [rgb >> 16, (rgb >> 8) & 0xff, rgb & 0xff];

/** Márgenes (l, t, r, b) de una pieza; en `header`, t = b = 0. */
function marginsOf(
  a: Appearance,
  role: (typeof UI_PIECES)[number],
): [number, number, number, number] {
  const p = a.ui.pieces[role];
  const { slice } = p;
  return 'top' in slice
    ? [slice.left, slice.top, slice.right, slice.bottom]
    : [slice.left, 0, slice.right, 0];
}

describe('Datos de aspecto de la interfaz (sprite-rendering 0032)', () => {
  it('Scenario: Datos de interfaz del repositorio', () => {
    const a = repository();
    expect(Object.keys(a.ui.pieces)).toEqual([...UI_PIECES]);
    expect(a.ui.font).toEqual({
      family: 'Departure Mono',
      file: 'DepartureMono-Regular.woff2',
      format: 'woff2',
    });
    for (const [, file] of uiSheetsOf(a)) {
      const entry = provenanceJson.files.find((f) => f.path === ASSET_DIR + file);
      expect(entry?.source.startsWith('Tiny Swords (Update 010)/UI/')).toBe(true);
    }
    for (const role of UI_PIECES) {
      const { fill, ink } = a.ui.pieces[role];
      for (const key of ['text', 'muted', 'accent'] as const) {
        expect(contrastRatio(ink[key], fill)).toBeGreaterThanOrEqual(UI_MIN_CONTRAST);
      }
    }
    expect(UI_DANGER_PIECES).toEqual(['panel', 'buttonDisabled']);
    for (const role of UI_DANGER_PIECES) {
      const { fill, ink } = a.ui.pieces[role];
      expect(isRed(ink.danger)).toBe(true);
      expect(contrastRatio(ink.danger, fill)).toBeGreaterThanOrEqual(UI_MIN_CONTRAST);
    }
  });

  it('Scenario: Tinta de peligro no exigida en los botones rojos', () => {
    const raw = structuredClone(appearanceJson);
    raw.ui.pieces.buttonDangerPressed.ink.danger = '#996878';
    expect(raw.ui.pieces.buttonDangerPressed.fill).toBe('#996878');
    expect(parseAppearance(raw, registered, GENERATED_PATHS).ok).toBe(true);
  });

  it('Scenario: Hojas de las piezas medidas (tamaño, márgenes y relleno ≤ 16 por canal)', () => {
    const a = repository();
    for (const role of UI_PIECES) {
      const piece = a.ui.pieces[role];
      const png = readPng(join(root, ASSET_DIR, piece.image));
      const [l, t, r, b] = marginsOf(a, role);
      expect(l + r, role).toBeLessThan(png.width);
      if ('height' in piece) expect(png.height, role).toBe(piece.height);
      else expect(t + b, role).toBeLessThan(png.height);
      // Centro: la mitad central del área entre márgenes (tarea 1.1).
      const iw = png.width - l - r;
      const ih = png.height - t - b;
      const x0 = l + Math.floor(iw / 4);
      const y0 = t + Math.floor(ih / 4);
      const mean = meanColor(png, x0, y0, x0 + Math.floor(iw / 2), y0 + Math.floor(ih / 2));
      hex(piece.fill).forEach((c, i) => {
        expect(Math.abs(c - (mean[i] ?? 0)), `${role} canal ${String(i)}`).toBeLessThanOrEqual(16);
      });
    }
  });

  const pieces = (raw: RawAppearance) => raw.ui.pieces;
  const piece = (raw: RawAppearance, role: string) => {
    const p = pieces(raw)[role];
    if (!p) throw new Error(`falta ${role}`);
    return p;
  };

  it.each([
    [
      'sin buttonDanger',
      (raw: RawAppearance) => {
        Reflect.deleteProperty(pieces(raw), 'buttonDanger');
      },
      'ui.pieces.buttonDanger',
      null,
    ],
    [
      'pieza extra tooltip',
      (raw: RawAppearance) => {
        pieces(raw).tooltip = structuredClone(piece(raw, 'button'));
      },
      'ui.pieces.tooltip',
      null,
    ],
    [
      'left de panel −1',
      (raw: RawAppearance) => {
        piece(raw, 'panel').slice.left = -1;
      },
      'ui.pieces.panel.slice.left',
      UI_SLICE_MUST_BE_INTEGER,
    ],
    [
      'top de button 2,5',
      (raw: RawAppearance) => {
        piece(raw, 'button').slice.top = 2.5;
      },
      'ui.pieces.button.slice.top',
      UI_SLICE_MUST_BE_INTEGER,
    ],
    [
      'header sin alto',
      (raw: RawAppearance) => {
        Reflect.deleteProperty(piece(raw, 'header'), 'height');
      },
      'ui.pieces.header.height',
      UI_HEADER_HEIGHT_MUST_BE_INTEGER,
    ],
    [
      'text de panel white',
      (raw: RawAppearance) => {
        piece(raw, 'panel').ink.text = 'white';
      },
      'ui.pieces.panel.ink.text',
      null,
    ],
    [
      'text de panel igual a su relleno',
      (raw: RawAppearance) => {
        const p = piece(raw, 'panel');
        p.ink.text = p.fill;
      },
      'ui.pieces.panel.ink.text',
      `${UI_INK_CONTRAST} (panel.text).`,
    ],
    [
      'danger de buttonDisabled #3080FF',
      (raw: RawAppearance) => {
        piece(raw, 'buttonDisabled').ink.danger = '#3080FF';
      },
      'ui.pieces.buttonDisabled.ink.danger',
      null,
    ],
    [
      'campo extra shadow en button',
      (raw: RawAppearance) => {
        piece(raw, 'button').shadow = 4;
      },
      'ui.pieces.button.shadow',
      null,
    ],
    [
      'hoja de panel sin registrar',
      (raw: RawAppearance) => {
        piece(raw, 'panel').image = 'UI/Banners/Carved_Regular.png';
      },
      'ui.pieces.panel.image',
      SHEET_NOT_REGISTERED,
    ],
    [
      'familia Departure, Mono',
      (raw: RawAppearance) => {
        raw.ui.font.family = 'Departure, Mono';
      },
      'ui.font.family',
      null,
    ],
    [
      'fichero .ttf',
      (raw: RawAppearance) => {
        raw.ui.font.file = 'DepartureMono-Regular.ttf';
      },
      'ui.font.file',
      null,
    ],
    [
      'woff2 sin registro',
      (raw: RawAppearance) => {
        raw.ui.font.file = 'Otra.woff2';
      },
      'ui.font.file',
      `${FONT_NOT_REGISTERED} Otra.woff2`,
    ],
  ])('Scenario: Datos de interfaz inválidos (%s)', (_name, change, field, message) => {
    const e = failure(change);
    expect(e.field).toBe(field);
    if (message !== null) expect(e.message).toBe(message);
  });

  it('Scenario: Datos de interfaz inválidos (no se muestra el menú: el arranque falla)', () => {
    const appearance = rawAppearance();
    const button = appearance.ui.pieces.button;
    if (button) button.slice.top = 2.5;
    const errors: string[] = [];
    const booted = bootContent(
      { content: rawContent(), appearance, guide: guideJson },
      (e) => errors.push(e.field),
      REGISTERED,
      GENERATED_PATHS,
    );
    expect(booted).toBeNull();
    expect(errors).toEqual(['ui.pieces.button.slice.top']);
  });

  it('las cuatro tintas por pieza y el catálogo cerrado de 8 roles', () => {
    expect(UI_INKS).toEqual(['text', 'muted', 'accent', 'danger']);
    expect(UI_PIECES).toHaveLength(8);
  });
});
