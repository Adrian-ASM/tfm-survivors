import { z } from 'zod';

// Guía «Cómo jugar» del menú (change 0028, design §1): presentación, como `appearance.json`. Siete
// páginas con id fijo y en orden, textos no vacíos y recursos citados de un catálogo cerrado.

export const GUIDE_PAGE_IDS = [
  'movement',
  'progression',
  'resources',
  'castle',
  'sites',
  'enemies',
  'outcome',
] as const;
export const GUIDE_ICONS = ['xp', 'gold', 'wood', 'meat', 'stone'] as const;

export type GuidePageId = (typeof GUIDE_PAGE_IDS)[number];
export type GuideIcon = (typeof GUIDE_ICONS)[number];

/** Largo máximo del título: una línea en la ventana mínima (960 × 540, escala ×1). */
export const GUIDE_TITLE_MAX = 48;

export const GUIDE_TEXT_EMPTY = 'El texto de la guía no puede estar vacío.';
export const GUIDE_TITLE_TOO_LONG = `El título de una página tiene como mucho ${String(
  GUIDE_TITLE_MAX,
)} caracteres.`;
export const GUIDE_PARAGRAPHS_EMPTY = 'Cada página de la guía tiene al menos un párrafo.';
const PAGE_COUNT = String(GUIDE_PAGE_IDS.length);
export const GUIDE_PAGE_COUNT = `La guía tiene exactamente ${PAGE_COUNT} páginas.`;
export const GUIDE_PAGE_ORDER = 'Las páginas de la guía van en el orden fijo de sus temas.';
export const GUIDE_ICON_REPEATED = 'Un recurso citado no se repite en la misma página.';
export const GUIDE_MARKER_UNKNOWN = 'Marcador desconocido en la guía';
export const GUIDE_BRACE_UNMATCHED = 'Llave suelta en la guía: cada { y } forma un marcador.';
export const GUIDE_MARKER_UNRESOLVED = 'Marcador sin valor en el contenido cargado';

/** Texto no vacío tras quitar espacios: `"   "` cuenta como vacío. */
const Text = z.string().trim().min(1, { error: GUIDE_TEXT_EMPTY });

const Page = z.strictObject({
  id: z.enum(GUIDE_PAGE_IDS),
  title: Text.max(GUIDE_TITLE_MAX, { error: GUIDE_TITLE_TOO_LONG }),
  paragraphs: z.array(Text).min(1, { error: GUIDE_PARAGRAPHS_EMPTY }),
  icons: z.array(z.enum(GUIDE_ICONS)).optional(),
});

export const GuideSchema = z
  .strictObject({
    pages: z.array(Page).length(GUIDE_PAGE_IDS.length, { error: GUIDE_PAGE_COUNT }),
  })
  .superRefine((guide, ctx) => {
    guide.pages.forEach((page, i) => {
      if (page.id !== GUIDE_PAGE_IDS[i]) {
        ctx.addIssue({ code: 'custom', path: ['pages', i, 'id'], message: GUIDE_PAGE_ORDER });
      }
      const icons = page.icons ?? [];
      if (new Set(icons).size !== icons.length) {
        ctx.addIssue({ code: 'custom', path: ['pages', i, 'icons'], message: GUIDE_ICON_REPEATED });
      }
    });
  });

export type RawGuide = z.output<typeof GuideSchema>;

/** Página ya validada e interpolada: lo único que conoce el modal. */
export interface GuidePage {
  readonly id: GuidePageId;
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly icons: readonly GuideIcon[];
}

export interface Guide {
  readonly pages: readonly GuidePage[];
}
