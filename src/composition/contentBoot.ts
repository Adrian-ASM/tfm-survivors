import type { RunConfig } from '../domain/run/RunConfig';
import { err, invalidConfig, ok, type DomainError, type Result } from '../domain/shared/Result';
import type { Appearance } from '../infrastructure/content/appearanceSchema';
import { checkTileScales, parseAppearance } from '../infrastructure/content/loadAppearance';
import {
  parseContent,
  type RawContentFiles,
  type ViewSize,
} from '../infrastructure/content/loadRunConfig';

export const APPEARANCE_MISSING = 'Falta el aspecto de este tipo de enemigo.';
export const APPEARANCE_UNKNOWN = 'Aspecto de un tipo de enemigo que no existe en enemies.json.';

/** Contenido crudo del arranque: el de juego (`content/*.json`) y los datos de aspecto. */
export interface RawBoot {
  readonly content: RawContentFiles;
  readonly appearance: unknown;
}

export interface BootedContent {
  readonly config: RunConfig;
  /** Tope de vista del lienzo (presentación): no llega al núcleo. */
  readonly maxView: ViewSize;
  readonly appearance: Appearance;
}

/**
 * Los tipos con aspecto son exactamente los `id` de `enemies.json` (design D9). El error nombra el
 * id que falta o sobra.
 */
export function checkAppearanceRefs(
  appearance: Appearance,
  config: RunConfig,
): Result<true, DomainError> {
  const ids = config.enemies.types.map((t) => t.id);
  const missing = ids.find((id) => !(id in appearance.enemies));
  if (missing !== undefined) return err(invalidConfig(`enemies.${missing}`, APPEARANCE_MISSING));
  const extra = Object.keys(appearance.enemies).find((id) => !ids.includes(id));
  if (extra !== undefined) return err(invalidConfig(`enemies.${extra}`, APPEARANCE_UNKNOWN));
  return ok(true);
}

/**
 * Valida el contenido de juego, los datos de aspecto (con las hojas registradas en la nota de
 * procedencia) y su cruce. Ante el primer error lo informa y devuelve `null`: no se crea ni el menú
 * ni la partida. Sin motor ni DOM (se prueba en Node).
 */
export function bootContent(
  raw: RawBoot,
  report: (error: DomainError) => void,
  registered: readonly string[],
): BootedContent | null {
  const content = parseContent(raw.content);
  if (!content.ok) {
    report(content.error);
    return null;
  }
  const { config, maxView } = content.value;
  const appearance = parseAppearance(raw.appearance, registered);
  if (!appearance.ok) {
    report(appearance.error);
    return null;
  }
  const refs = checkAppearanceRefs(appearance.value, config);
  if (!refs.ok) {
    report(refs.error);
    return null;
  }
  const scales = checkTileScales(appearance.value, config.map.cellSize);
  if (!scales.ok) {
    report(scales.error);
    return null;
  }
  return { config, maxView, appearance: appearance.value };
}
