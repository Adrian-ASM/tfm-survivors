import type { RunConfig } from '../domain/run/RunConfig';
import { err, invalidConfig, ok, type DomainError, type Result } from '../domain/shared/Result';
import type { Appearance } from '../infrastructure/content/appearanceSchema';
import { parseAppearance } from '../infrastructure/content/loadAppearance';
import { parseRunConfig } from '../infrastructure/content/loadRunConfig';

export const APPEARANCE_MISSING = 'Falta el aspecto de este tipo de enemigo.';
export const APPEARANCE_UNKNOWN = 'Aspecto de un tipo de enemigo que no existe en enemies.json.';

/** Contenido crudo del arranque: el de juego (`content/*.json`) y los datos de aspecto. */
export interface RawBoot {
  readonly content: Parameters<typeof parseRunConfig>[0];
  readonly appearance: unknown;
}

export interface BootedContent {
  readonly config: RunConfig;
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
  const config = parseRunConfig(raw.content);
  if (!config.ok) {
    report(config.error);
    return null;
  }
  const appearance = parseAppearance(raw.appearance, registered);
  if (!appearance.ok) {
    report(appearance.error);
    return null;
  }
  const refs = checkAppearanceRefs(appearance.value, config.value);
  if (!refs.ok) {
    report(refs.error);
    return null;
  }
  return { config: config.value, appearance: appearance.value };
}
