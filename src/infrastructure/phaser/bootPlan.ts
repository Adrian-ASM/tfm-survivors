import type { Appearance, SheetRect } from '../content/appearanceSchema';
import {
  aspectsOf,
  pickupSpawnSheetsOf,
  uiSheetsOf,
  sheepSheetsOf,
  siteAspectsOf,
  structureAspectsOf,
  veinAspectsOf,
} from '../content/loadAppearance';
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

/** Hojas regulares de los aspectos del mapa (la orilla comparte la del fondo) y de la decoración. */
function mapSheets(appearance: Appearance) {
  const { water, shore, foam, trees, castle, decor } = appearance.map;
  return [
    water.sheet,
    shore.sheet,
    foam.sheet,
    trees.sheet,
    castle.sheet,
    ...decor.items.map((item) => item.sheet),
  ];
}

/** Una carga por `file` distinto: aspectos, mapa, estructuras, vetas, ovejas y solares. Puro. */
export function sheetsToLoad(appearance: Appearance): SheetLoad[] {
  const byFile = new Map<string, SheetLoad>();
  const sheets = [
    ...aspectsOf(appearance).map(([, a]) => a.sheet),
    ...mapSheets(appearance),
    ...structureAspectsOf(appearance).map(([, a]) => a.sheet),
    ...veinAspectsOf(appearance).map(([, a]) => a.sheet),
    ...sheepSheetsOf(appearance).map(([, sheet]) => sheet),
    ...siteAspectsOf(appearance).map(([, a]) => a.sheet),
    ...pickupSpawnSheetsOf(appearance).map(([, sheet]) => sheet),
  ];
  for (const { file, frameWidth, frameHeight } of sheets) {
    if (!byFile.has(file)) byFile.set(file, { key: file, file, frameWidth, frameHeight });
  }
  return [...byFile.values()];
}

/** Imágenes de las 8 piezas de UI (0032): enteras, clave = su `image`, una por fichero distinto. */
export function uiImagesOf(appearance: Appearance): ImageLoad[] {
  const files = new Set(uiSheetsOf(appearance).map(([, file]) => file));
  return [...files].map((file) => ({ key: file, file }));
}

/**
 * Imágenes enteras: la del puente, cuyos marcos se añaden con nombre tras cargarla, y (0032) las de
 * las piezas de UI, que pintan los NineSlice de Phaser y el `border-image` del DOM (misma URL).
 */
export function imagesToLoad(appearance: Appearance): ImageLoad[] {
  const { image } = appearance.map.bridges;
  return [{ key: image, file: image }, ...uiImagesOf(appearance)];
}

/** Lo que `finishBoot` necesita de la escena y de la composición (costura sin motor). */
export interface BootFinish {
  /** Fuente de la interfaz: `true` si cargó a tiempo (como mucho `FONT_WAIT_MS`). */
  readonly fontReady: Promise<boolean>;
  readonly fontFamily: string;
  /** Claves de las piezas de UI que se pidieron. */
  readonly uiKeys: readonly string[];
  /** Si existe la textura de una clave (las que fallaron no existen). */
  exists(key: string): boolean;
  /** Anota una clave que no cargó (diagnóstico). */
  fail(key: string): void;
  /** Avisa de las piezas de UI cargadas (la composición publica las variables CSS). */
  onUiLoaded(loaded: ReadonlySet<string>): void;
  /** Arranca el menú o la partida. */
  start(): void;
}

/**
 * Final del arranque (0032, design Flujo 3): tras la carga de las hojas, espera la fuente (que ya
 * trae su plazo), anota la familia si no llegó, avisa de las piezas de UI cuya textura existe y
 * solo entonces arranca la escena siguiente. Nunca rechaza.
 */
export async function finishBoot(f: BootFinish): Promise<void> {
  const ok = await f.fontReady.catch(() => false);
  if (!ok) f.fail(f.fontFamily);
  f.onUiLoaded(new Set(f.uiKeys.filter((key) => f.exists(key))));
  f.start();
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
