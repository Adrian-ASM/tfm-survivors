import type { RunConfig } from '../domain/run/RunConfig';
import { err, invalidConfig, ok, type DomainError, type Result } from '../domain/shared/Result';
import { RUIN_COLOR_KEY, type Appearance } from '../infrastructure/content/appearanceSchema';
import type { Guide } from '../infrastructure/content/guideSchema';
import { checkTileScales, parseAppearance } from '../infrastructure/content/loadAppearance';
import { parseGuide } from '../infrastructure/content/loadGuide';
import { iconCatalog, type IconCatalog, type IconIds } from '../infrastructure/icons/upgradeIcons';
import type { MobileDisplay } from '../infrastructure/content/schemas';
import {
  parseContent,
  type RawContentFiles,
  type ViewSize,
} from '../infrastructure/content/loadRunConfig';

export const APPEARANCE_MISSING = 'Falta el aspecto de este tipo de enemigo.';
export const APPEARANCE_UNKNOWN = 'Aspecto de un tipo de enemigo que no existe en enemies.json.';
export const APPEARANCE_FUSE_REQUIRED =
  'El aspecto de un tipo con un estado de mecha necesita la animación fuse.';
export const APPEARANCE_THROW_REQUIRED =
  'El aspecto de un tipo con un estado de carga necesita la animación throw.';
export const STRUCTURE_APPEARANCE_MISSING =
  'Falta el aspecto o el color de reserva de este tipo de estructura.';
export const ICON_UNKNOWN_ID = 'Icono de un id que no es ninguna mejora ni la curación.';
export const STRUCTURE_APPEARANCE_UNKNOWN =
  'Aspecto o color de un tipo de estructura que no existe en structures.json.';

/**
 * Contenido crudo del arranque: el de juego (`content/*.json`), los datos de aspecto y la guía del
 * menú (0028; obligatoria: un arranque sin guía no debe pasar desapercibido).
 */
export interface RawBoot {
  readonly content: RawContentFiles;
  readonly appearance: unknown;
  readonly guide: unknown;
}

export interface BootedContent {
  readonly config: RunConfig;
  /** Tope de vista del lienzo (presentación): no llega al núcleo. */
  readonly maxView: ViewSize;
  /** Constantes del modo móvil (0033): presentación, no llegan al núcleo. */
  readonly mobile: MobileDisplay;
  readonly appearance: Appearance;
  /** Guía «Cómo jugar» ya validada e interpolada con la config (0028). */
  readonly guide: Guide;
  /** Catálogo de iconos de mejora ya cruzado con el contenido (0034): presentación. */
  readonly icons: IconCatalog;
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
  // Animaciones por clase de estado (spec sprite-rendering 0020): fuse con mecha, throw con carga.
  for (const { id, behavior } of config.enemies.types) {
    const aspect = appearance.enemies[id];
    const kinds = new Set(behavior.states.map((st) => st.kind));
    if (kinds.has('fuse') && !aspect?.fuse) {
      return err(invalidConfig(`enemies.${id}.fuse`, `${APPEARANCE_FUSE_REQUIRED} (${id})`));
    }
    if (kinds.has('charge') && !aspect?.throw) {
      return err(invalidConfig(`enemies.${id}.throw`, `${APPEARANCE_THROW_REQUIRED} (${id})`));
    }
  }
  return checkStructureRefs(appearance, config);
}

/**
 * Los tipos de estructura con aspecto y con color de reserva son exactamente los del contenido de
 * estructuras (spec sprite-rendering 0021); el error nombra el id que falta o sobra.
 */
function checkStructureRefs(appearance: Appearance, config: RunConfig): Result<true, DomainError> {
  const ids = Object.keys(config.structures.types);
  const groups = [
    ['structures', Object.keys(appearance.structures)],
    [
      'structureColors',
      Object.keys(appearance.structureColors).filter((k) => k !== RUIN_COLOR_KEY),
    ],
  ] as const;
  for (const [field, keys] of groups) {
    const missing = ids.find((id) => !keys.includes(id));
    if (missing !== undefined) {
      return err(
        invalidConfig(`${field}.${missing}`, `${STRUCTURE_APPEARANCE_MISSING} (${missing})`),
      );
    }
    const extra = keys.find((id) => !ids.includes(id));
    if (extra !== undefined) {
      return err(invalidConfig(`${field}.${extra}`, `${STRUCTURE_APPEARANCE_UNKNOWN} (${extra})`));
    }
  }
  return ok(true);
}

/** Ids del contenido con icono (0034, D2): mejoras de personaje; de arma y la curación (`heal`). */
export function iconIdsOf(config: RunConfig): IconIds {
  return {
    character: config.upgrades.character.map((u) => u.id),
    weapon: [...config.upgrades.weapons.map((u) => u.id), config.shop.heal.id],
  };
}

/**
 * Cruce de los iconos con el contenido (0034, design D2): cada clave de `icons.byId` es el id de una
 * mejora de cualquiera de los dos catálogos o el de la curación; si no, `ICON_UNKNOWN_ID` con el
 * campo `icons.byId.<id>`. Una mejora sin entrada es válida (usa la reserva de su categoría).
 */
export function checkIconRefs(
  appearance: Appearance,
  config: RunConfig,
): Result<IconCatalog, DomainError> {
  const ids = iconIdsOf(config);
  const known = new Set([...ids.character, ...ids.weapon]);
  const unknown = Object.keys(appearance.icons.byId).find((id) => !known.has(id));
  if (unknown !== undefined) {
    return err(invalidConfig(`icons.byId.${unknown}`, `${ICON_UNKNOWN_ID} (${unknown})`));
  }
  return ok(iconCatalog(appearance.icons, ids));
}

/**
 * Valida el contenido de juego, los datos de aspecto (con las hojas registradas en la nota de
 * procedencia), su cruce y la guía del menú. Ante el primer error lo informa y devuelve `null`:
 * no se crea ni el menú ni la partida. Sin motor ni DOM (se prueba en Node). `generated` (0034) son
 * las rutas de la lista de imágenes con IA: las únicas que valen como icono.
 */
export function bootContent(
  raw: RawBoot,
  report: (error: DomainError) => void,
  registered: readonly string[],
  generated: readonly string[] = [],
): BootedContent | null {
  const content = parseContent(raw.content);
  if (!content.ok) {
    report(content.error);
    return null;
  }
  const { config, maxView, mobile } = content.value;
  const appearance = parseAppearance(raw.appearance, registered, generated);
  if (!appearance.ok) {
    report(appearance.error);
    return null;
  }
  const refs = checkAppearanceRefs(appearance.value, config);
  if (!refs.ok) {
    report(refs.error);
    return null;
  }
  const icons = checkIconRefs(appearance.value, config);
  if (!icons.ok) {
    report(icons.error);
    return null;
  }
  const scales = checkTileScales(appearance.value, config.map.cellSize);
  if (!scales.ok) {
    report(scales.error);
    return null;
  }
  // La guía va la última: sus marcadores leen la config ya validada (design 0028 §1).
  const guide = parseGuide(raw.guide, config);
  if (!guide.ok) {
    report(guide.error);
    return null;
  }
  return {
    config,
    maxView,
    mobile,
    appearance: appearance.value,
    guide: guide.value,
    icons: icons.value,
  };
}
