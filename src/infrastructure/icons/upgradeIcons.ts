// Iconos de mejora y de la curación (change 0034, design D2/D3). Presentación pura: no los lee ningún
// flujo de azar ni ninguna colocación, y no dependen del snapshot, del tick ni del reloj.
import type { IconsAppearance } from '../content/appearanceSchema';

/** Categoría de un icono: su reserva. La curación usa la de arma (design D2). */
export type IconCategory = 'character' | 'weapon';
/** Estado del icono pintado (spec "Resolución del icono"). */
export type IconState = 'painted' | 'fallback' | 'none';

export interface IconEntry {
  /** Fichero propio (relativo a `public/assets/icons/`) o `null` si el id no tiene entrada. */
  readonly file: string | null;
  readonly category: IconCategory;
}

/** Catálogo congelado: todos los ids válidos con su fichero y categoría, más las reservas. */
export interface IconCatalog {
  readonly entries: ReadonlyMap<string, IconEntry>;
  readonly fallback: Readonly<Record<IconCategory, string | null>>;
}

/** Lo que se pinta para un id: estado, clave de textura y fichero (los dos `null` en `none`). */
export interface IconChoice {
  readonly state: IconState;
  readonly key: string | null;
  readonly file: string | null;
}

/** Prefijo de las claves de textura de icono: no chocan con las de hoja (ruta en `tiny-swords/`). */
export const ICON_KEY_PREFIX = 'icon:';

/** Clave de textura de un fichero de icono. */
export function iconKey(file: string): string {
  return ICON_KEY_PREFIX + file;
}

/** Ids por categoría del contenido (mejoras de personaje; de arma y la curación). */
export type IconIds = Readonly<Record<IconCategory, readonly string[]>>;

/**
 * Catálogo de los ids del contenido con los datos de iconos (`undefined` = sin datos: ningún
 * fichero ni reserva, todo `none`; lo usan los dobles). No valida los ids: eso lo hace `checkIconRefs` en el arranque.
 */
export function iconCatalog(icons: IconsAppearance | undefined, ids: IconIds): IconCatalog {
  const entries = new Map<string, IconEntry>();
  for (const category of ['character', 'weapon'] as const) {
    for (const id of ids[category]) {
      entries.set(id, { file: icons?.byId[id] ?? null, category });
    }
  }
  return Object.freeze({
    entries,
    fallback: Object.freeze({
      character: icons?.fallback.character ?? null,
      weapon: icons?.fallback.weapon ?? null,
    }),
  });
}

const NONE: IconChoice = Object.freeze({ state: 'none', key: null, file: null });

/**
 * Regla única para Phaser y DOM (design D3): su icono si está cargado (`painted`); si no, la
 * reserva de su categoría si está cargada (`fallback`); si no, ninguno (`none`). Un id fuera del
 * catálogo se trata como `character` sin fichero.
 */
export function resolveIcon(
  catalog: IconCatalog,
  id: string,
  loaded: ReadonlySet<string>,
): IconChoice {
  const entry = catalog.entries.get(id) ?? { file: null, category: 'character' };
  if (entry.file !== null && loaded.has(iconKey(entry.file))) {
    return { state: 'painted', key: iconKey(entry.file), file: entry.file };
  }
  const fallback = catalog.fallback[entry.category];
  if (fallback !== null && loaded.has(iconKey(fallback))) {
    return { state: 'fallback', key: iconKey(fallback), file: fallback };
  }
  return NONE;
}

/**
 * Catálogo más el conjunto de iconos cargados, que rellena una vez la carga de `BootScene`
 * (`onIconsLoaded`). Antes de la carga todo es `none`. Costura de la composición para la carta
 * (Phaser) y la fila de la tienda (DOM).
 */
export class IconBook {
  private loaded: ReadonlySet<string> = new Set();

  constructor(readonly catalog: IconCatalog) {}

  /** Claves de textura de icono que existen tras la carga. */
  setLoaded(keys: Iterable<string>): void {
    this.loaded = new Set(keys);
  }

  resolve(id: string): IconChoice {
    return resolveIcon(this.catalog, id, this.loaded);
  }
}
