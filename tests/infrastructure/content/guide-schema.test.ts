import { describe, expect, it } from 'vitest';
import guideJson from '../../../content/guide.json';
import type { RunConfig } from '../../../src/domain/run/RunConfig';
import {
  GUIDE_BRACE_UNMATCHED,
  GUIDE_ICON_REPEATED,
  GUIDE_MARKER_UNKNOWN,
  GUIDE_PAGE_COUNT,
  GUIDE_PAGE_IDS,
  GUIDE_PAGE_ORDER,
  GUIDE_PARAGRAPHS_EMPTY,
  GUIDE_TEXT_EMPTY,
} from '../../../src/infrastructure/content/guideSchema';
import { parseGuide } from '../../../src/infrastructure/content/loadGuide';
import { parseContent } from '../../../src/infrastructure/content/loadRunConfig';
import { rawContent } from '../../support/builders';

// Spec menu-guide, "Contenido de la guía validado" (change 0028, design §1 y §2).
type Page = { id: string; title: string; paragraphs: string[]; icons?: string[] } & Record<
  string,
  unknown
>;
type RawGuide = { pages: Page[] };

const config = (): RunConfig => {
  const r = parseContent(rawContent());
  if (!r.ok) throw new Error(r.error.message);
  return r.value.config;
};

const guide = (): RawGuide => structuredClone<RawGuide>(guideJson);

/** Página n (1..7) de una copia del guide.json del repositorio. */
const page = (g: RawGuide, n: number): Page => {
  const p = g.pages[n - 1];
  if (!p) throw new Error(`sin página ${String(n)}`);
  return p;
};

const errorOf = (raw: unknown) => {
  const r = parseGuide(raw, config());
  if (r.ok) throw new Error('se esperaba un error');
  return r.error;
};

describe('parseGuide: forma de guide.json', () => {
  it('Scenario: Contenido por defecto válido', () => {
    const r = parseGuide(guideJson, config());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.pages.map((p) => p.id)).toEqual([...GUIDE_PAGE_IDS]);
  });

  it('Scenario: Seis u ocho páginas', () => {
    const six = guide();
    six.pages.pop();
    const eight = guide();
    eight.pages.push(structuredClone(page(eight, 7)));
    for (const raw of [six, eight]) {
      const e = errorOf(raw);
      expect(e.field).toBe('guide.pages');
      expect(e.message).toBe(GUIDE_PAGE_COUNT);
    }
  });

  it('Scenario: Párrafo vacío o página sin párrafos', () => {
    const blank = guide();
    page(blank, 4).paragraphs[0] = '   ';
    const none = guide();
    page(none, 4).paragraphs = [];
    expect(errorOf(blank)).toMatchObject({
      field: 'guide.pages.3.paragraphs.0',
      message: `${GUIDE_TEXT_EMPTY} (página 4)`,
    });
    expect(errorOf(none)).toMatchObject({
      field: 'guide.pages.3.paragraphs',
      message: `${GUIDE_PARAGRAPHS_EMPTY} (página 4)`,
    });
  });

  it('Scenario: Título vacío', () => {
    const g = guide();
    page(g, 1).title = '';
    expect(errorOf(g)).toMatchObject({
      field: 'guide.pages.0.title',
      message: `${GUIDE_TEXT_EMPTY} (página 1)`,
    });
  });

  it('Scenario: Páginas fuera de orden', () => {
    const g = guide();
    const [four, five] = [page(g, 4), page(g, 5)];
    g.pages[3] = five;
    g.pages[4] = four;
    expect(errorOf(g)).toMatchObject({
      field: 'guide.pages.3.id',
      message: `${GUIDE_PAGE_ORDER} (página 4)`,
    });
  });

  it('Scenario: Recurso citado desconocido o repetido', () => {
    const unknown = guide();
    page(unknown, 3).icons = ['xp', 'diamante'];
    const repeated = guide();
    page(repeated, 3).icons = ['gold', 'wood', 'gold'];
    const e1 = errorOf(unknown);
    expect(e1.field).toBe('guide.pages.2.icons.1');
    expect(e1.message).toMatch(/\(página 3\)$/);
    expect(errorOf(repeated)).toMatchObject({
      field: 'guide.pages.2.icons',
      message: `${GUIDE_ICON_REPEATED} (página 3)`,
    });
  });

  it('Scenario: Campo desconocido (image en la página 6)', () => {
    const g = guide();
    page(g, 6).image = 'goblin.png';
    const e = errorOf(g);
    expect(e.field).toBe('guide.pages.5.image');
    expect(e.message).toMatch(/\(página 6\)$/);
  });

  it('un campo desconocido en la raíz se nombra sin página', () => {
    const e = errorOf({ ...guide(), extra: true });
    expect(e.field).toBe('guide.extra');
    expect(e.message).not.toMatch(/página/);
  });
});

describe('parseGuide: marcadores y llaves', () => {
  it('Scenario: Marcador desconocido (tower.cost.gold en la página 5)', () => {
    const g = guide();
    page(g, 5).paragraphs[1] = 'La torre cuesta {tower.cost.gold} de oro.';
    expect(errorOf(g)).toEqual({
      code: 'invalid-config',
      field: 'guide.pages.4.paragraphs.1',
      message: `${GUIDE_MARKER_UNKNOWN}: tower.cost.gold (página 5)`,
    });
  });

  it('Scenario: Llave suelta (cada { y cada } en la página 2)', () => {
    const open = guide();
    page(open, 2).paragraphs[0] = 'Sube de nivel cada {';
    const close = guide();
    page(close, 2).paragraphs[0] = 'Sube de nivel cada } vez';
    for (const raw of [open, close]) {
      expect(errorOf(raw)).toMatchObject({
        field: 'guide.pages.1.paragraphs.0',
        message: `${GUIDE_BRACE_UNMATCHED} (página 2)`,
      });
    }
  });

  it('un marcador desconocido en un título nombra el título', () => {
    const g = guide();
    page(g, 7).title = 'Victoria {nada}';
    expect(errorOf(g)).toMatchObject({ field: 'guide.pages.6.title' });
  });
});
