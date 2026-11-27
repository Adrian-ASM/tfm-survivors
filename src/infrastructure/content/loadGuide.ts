import type { RunConfig } from '../../domain/run/RunConfig';
import { err, invalidConfig, ok, type DomainError, type Result } from '../../domain/shared/Result';
import { interpolate, markerValues, type InterpolationIssue } from './guideMarkers';
import {
  BUILD_TEXT_MAX,
  GUIDE_BRACE_UNMATCHED,
  GUIDE_BUILD_TOO_LONG,
  GUIDE_MARKER_UNKNOWN,
  GUIDE_MARKER_UNRESOLVED,
  GuideSchema,
  type Guide,
  type GuidePage,
} from './guideSchema';

const FIELD_ROOT = 'guide';
const BUILDING_KINDS = ['house', 'tower'] as const;
type BuildingKind = (typeof BUILDING_KINDS)[number];

/** `(página n)` con n de 1 a 7 si la ruta empieza en `pages.<índice>`; si no, nada. */
function pageSuffix(path: readonly (string | number)[]): string {
  const [head, index] = path;
  return head === 'pages' && typeof index === 'number' ? ` (página ${String(index + 1)})` : '';
}

function guideError(path: readonly (string | number)[], message: string): DomainError {
  const field = [FIELD_ROOT, ...path.map(String)].join('.');
  return invalidConfig(field, message + pageSuffix(path));
}

function issueMessage(issue: InterpolationIssue): string {
  if (issue.kind === 'brace') return GUIDE_BRACE_UNMATCHED;
  const base = issue.kind === 'unknown' ? GUIDE_MARKER_UNKNOWN : GUIDE_MARKER_UNRESOLVED;
  return `${base}: ${issue.marker}`;
}

/**
 * Valida `guide.json` (zod) y sustituye sus marcadores con la config ya validada (design §1 y §2).
 * El error nombra el campo (`guide.pages.3.paragraphs.0`), la página (1..7) y, si es el caso, el
 * marcador. El resultado sale congelado: el modal no conoce los marcadores.
 */
export function parseGuide(raw: unknown, config: RunConfig): Result<Guide, DomainError> {
  const parsed = GuideSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path: (string | number)[] = (issue?.path ?? []).map((p) =>
      typeof p === 'number' ? p : String(p),
    );
    // Un campo desconocido se nombra a sí mismo (como en parseAppearance).
    if (issue?.code === 'unrecognized_keys' && issue.keys[0] !== undefined)
      path.push(issue.keys[0]);
    return err(guideError(path, issue?.message ?? 'Guía inválida'));
  }
  const values = markerValues(config);
  const pages: GuidePage[] = [];
  for (const [i, page] of parsed.data.pages.entries()) {
    const title = interpolate(page.title, values);
    if (!title.ok) return err(guideError(['pages', i, 'title'], issueMessage(title.error)));
    const paragraphs: string[] = [];
    for (const [j, text] of page.paragraphs.entries()) {
      const shown = interpolate(text, values);
      if (!shown.ok) {
        return err(guideError(['pages', i, 'paragraphs', j], issueMessage(shown.error)));
      }
      paragraphs.push(shown.value);
    }
    pages.push(
      Object.freeze({
        id: page.id,
        title: title.value,
        paragraphs: Object.freeze(paragraphs),
        icons: Object.freeze([...(page.icons ?? [])]),
      }),
    );
  }
  // 0036 (design D7): las explicaciones de la obra, con los mismos marcadores; campo sin página.
  const build: Record<BuildingKind, string> = { house: '', tower: '' };
  for (const kind of BUILDING_KINDS) {
    const shown = interpolate(parsed.data.build[kind], values);
    if (!shown.ok) return err(guideError(['build', kind], issueMessage(shown.error)));
    if (shown.value.length > BUILD_TEXT_MAX) {
      return err(guideError(['build', kind], GUIDE_BUILD_TOO_LONG));
    }
    build[kind] = shown.value;
  }
  return ok(Object.freeze({ pages: Object.freeze(pages), build: Object.freeze(build) }));
}
