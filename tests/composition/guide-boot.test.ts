import { describe, expect, it } from 'vitest';
import appearanceJson from '../../content/appearance.json';
import guideJson from '../../content/guide.json';
import provenanceJson from '../../content/asset-provenance.json';
import { bootContent } from '../../src/composition/contentBoot';
import type { DomainError } from '../../src/domain/shared/Result';
import { GUIDE_PAGE_IDS } from '../../src/infrastructure/content/guideSchema';
import { rawContent } from '../support/builders';
import { registeredPaths } from '../../src/infrastructure/content/loadAppearance';

// Spec menu-guide, "Contenido de la guía validado": un guide.json inválido pasa por `report` (la
// vía de showContentError) y bootContent devuelve null, así que no se crea el menú (design 0028
// §1).
//
// "Marcador sin valor en el contenido" no figura en INVALID: por bootContent es inalcanzable,
// porque el schema de structures.json (StructuresSchema, objeto estricto) exige `goblin-tower` y un
// fichero sin ella falla antes, en parseContent. Se cubre con parseGuide y una RunConfig sin ese
// tipo en guide-markers.test.ts; aquí se comprueba que ese fichero tampoco crea el menú.
const REGISTERED = registeredPaths(provenanceJson);

type Page = { id: string; title: string; paragraphs: string[]; icons?: string[] } & Record<
  string,
  unknown
>;
type RawGuide = { pages: Page[] };

function boot(guide: unknown, content = rawContent()) {
  const errors: DomainError[] = [];
  const booted = bootContent(
    { content, appearance: structuredClone(appearanceJson), guide },
    (e) => errors.push(e),
    REGISTERED,
  );
  return { booted, errors };
}

/** Copia del guide.json con un cambio en la página n (1..7). */
function guideWith(n: number, change: (p: Page, g: RawGuide) => void): RawGuide {
  const g = structuredClone<RawGuide>(guideJson);
  const p = g.pages[n - 1];
  if (!p) throw new Error(`sin página ${String(n)}`);
  change(p, g);
  return g;
}

const INVALID: [string, RawGuide][] = [
  ['seis páginas', guideWith(7, (_, g) => g.pages.pop())],
  ['ocho páginas', guideWith(7, (p, g) => g.pages.push(structuredClone(p)))],
  ['párrafo en blanco (página 4)', guideWith(4, (p) => (p.paragraphs[0] = '   '))],
  ['página 4 sin párrafos', guideWith(4, (p) => (p.paragraphs = []))],
  ['título vacío (página 1)', guideWith(1, (p) => (p.title = ''))],
  [
    'páginas 4 y 5 intercambiadas',
    guideWith(4, (p, g) => {
      g.pages[3] = g.pages[4] as Page;
      g.pages[4] = p;
    }),
  ],
  ['recurso diamante (página 3)', guideWith(3, (p) => (p.icons = ['diamante']))],
  ['recurso repetido (página 3)', guideWith(3, (p) => (p.icons = ['gold', 'gold']))],
  ['campo image (página 6)', guideWith(6, (p) => (p.image = 'x.png'))],
  ['marcador desconocido (página 5)', guideWith(5, (p) => (p.paragraphs[0] = '{tower.cost.gold}'))],
  ['llave abierta (página 2)', guideWith(2, (p) => (p.paragraphs[0] = 'cada {'))],
  ['llave cerrada (página 2)', guideWith(2, (p) => (p.paragraphs[0] = 'cada }'))],
];

describe('bootContent con la guía (0028)', () => {
  it.each(INVALID)('Scenario: guide.json inválido impide el menú (%s)', (_, guide) => {
    const { booted, errors } = boot(guide);
    expect(booted).toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0]?.field).toMatch(/^guide\./);
  });

  it('sin guía (campo ausente) tampoco arranca', () => {
    const { booted, errors } = boot(undefined);
    expect(booted).toBeNull();
    expect(errors[0]?.field).toBe('guide');
  });

  it('structures.json sin goblin-tower no crea el menú (falla el schema, antes de la guía)', () => {
    const content = rawContent();
    Reflect.deleteProperty(content.structures.types, 'goblin-tower');
    const { booted, errors } = boot(guideJson, content);
    expect(booted).toBeNull();
    expect(errors.map((e) => e.field)).toEqual(['structures.types.goblin-tower']);
  });

  it('con el contenido por defecto, booted.guide sale interpolada', () => {
    const { booted, errors } = boot(guideJson);
    expect(errors).toEqual([]);
    const pages = booted?.guide.pages ?? [];
    expect(pages.map((p) => p.id)).toEqual([...GUIDE_PAGE_IDS]);
    const texts = pages.flatMap((p) => [p.title, ...p.paragraphs]);
    expect(texts.some((t) => /[{}]/.test(t))).toBe(false);
    expect(texts.join(' ')).toContain('10:00');
  });
});
