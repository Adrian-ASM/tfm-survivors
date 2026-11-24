import type { Appearance, SheetRect } from '../content/appearanceSchema';
import { aspectsOf, structureAspectsOf } from '../content/loadAppearance';
import { BRIDGE_FRAME_NAMES } from './map/mapLooks';
import { GAME_SCENE_KEY, MENU_SCENE_KEY } from './sceneKeys';

/** Una hoja a cargar: la clave de textura es su `file` (design D3). */
export interface SheetLoad {
  readonly key: string;
  readonly file: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
}

/** Una imagen no regular a cargar entera (la del puente, change 0016). */
export interface ImageLoad {
  readonly key: string;
  readonly file: string;
}

/** Hojas regulares de los aspectos del mapa (la orilla comparte la del fondo). */
function mapSheets(appearance: Appearance) {
  const { water, shore, foam, trees, castle } = appearance.map;
  return [water.sheet, shore.sheet, foam.sheet, trees.sheet, castle.sheet];
}

/** Una carga por `file` distinto: aspectos, mapa y estructuras (0021), en ese orden. Puro. */
export function sheetsToLoad(appearance: Appearance): SheetLoad[] {
  const byFile = new Map<string, SheetLoad>();
  const sheets = [
    ...aspectsOf(appearance).map(([, a]) => a.sheet),
    ...mapSheets(appearance),
    ...structureAspectsOf(appearance).map(([, a]) => a.sheet),
  ];
  for (const { file, frameWidth, frameHeight } of sheets) {
    if (!byFile.has(file)) byFile.set(file, { key: file, file, frameWidth, frameHeight });
  }
  return [...byFile.values()];
}

/** Imágenes enteras: la del puente, cuyos marcos se añaden con nombre tras cargarla. */
export function imagesToLoad(appearance: Appearance): ImageLoad[] {
  const { image } = appearance.map.bridges;
  return [{ key: image, file: image }];
}

/** Lo que `addBridgeFrames` necesita de las texturas del motor (costura sin motor). */
export interface TextureBook {
  /** Tamaño de la imagen fuente de una textura cargada, o `null` si no está. */
  size(key: string): { readonly width: number; readonly height: number } | null;
  add(key: string, name: string, rect: SheetRect): void;
}

/**
 * Añade los marcos con nombre del puente (design 0016 §5.3) solo si su recorte cabe en la imagen; si
 * la imagen no cargó o un recorte no cabe, ese marco no existe y el puente cae a reserva al pintar,
 * sin excepción.
 */
export function addBridgeFrames(textures: TextureBook, appearance: Appearance): void {
  const { image, frames } = appearance.map.bridges;
  const size = textures.size(image);
  if (!size) return;
  for (const key of ['northSouth', 'eastWest'] as const) {
    const r = frames[key];
    if (r.x + r.width <= size.width && r.y + r.height <= size.height) {
      textures.add(image, BRIDGE_FRAME_NAMES[key], r);
    }
  }
}

/** Tras la carga: con `?e2e`, la partida (arranque de antes, ADR-0011); sin él, el menú. */
export function nextSceneKey(e2e: boolean): string {
  return e2e ? GAME_SCENE_KEY : MENU_SCENE_KEY;
}
