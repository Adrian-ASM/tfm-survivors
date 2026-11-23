import type { Appearance, MapAppearance, SheetRect } from '../../content/appearanceSchema';
import type { FrameCount } from '../art/looks';

// Aspectos del mapa resueltos contra las texturas cargadas (design 0016 §5.3 y §12.2 B6): arte o
// reserva **por elemento**, independientes. Misma regla que `resolveLooks` (0012): una hoja que no
// está o un frame usado que no existe ⇒ reserva. Puro: sin motor.

/** Colores de reserva de las celdas del mapa (`terrain` de los datos de aspecto). */
export type MapColors = Appearance['terrain'];

/** ¿Tiene la textura `key` el marco con nombre `name`? (marcos del puente, `BootScene`). */
export type HasFrame = (key: string, name: string) => boolean;

/** Nombres de los marcos del puente que `BootScene` añade a su imagen si caben en ella. */
export const BRIDGE_FRAME_NAMES = {
  northSouth: 'bridge-north-south',
  eastWest: 'bridge-east-west',
} as const;

type Off = { readonly art: false };
type On<T> = { readonly art: true; readonly texture: string } & T;

export interface MapLooks {
  readonly water: On<{ readonly aspect: MapAppearance['water'] }> | Off;
  readonly shore: On<{ readonly aspect: MapAppearance['shore'] }> | Off;
  readonly foam: On<{ readonly aspect: MapAppearance['foam'] }> | Off;
  readonly trees: On<{ readonly aspect: MapAppearance['trees'] }> | Off;
  readonly bridges:
    | On<{
        readonly aspect: MapAppearance['bridges'];
        readonly frames: Readonly<Record<keyof typeof BRIDGE_FRAME_NAMES, string>>;
        readonly rects: Readonly<Record<keyof typeof BRIDGE_FRAME_NAMES, SheetRect>>;
      }>
    | Off;
  readonly castle: On<{ readonly aspect: MapAppearance['castle'] }> | Off;
  readonly colors: MapColors;
}

const OFF: Off = Object.freeze({ art: false });

/** ¿Está la hoja `file` y existen todos los frames usados? */
function fits(frames: FrameCount, file: string, used: readonly number[]): boolean {
  const count = frames(file);
  return count !== null && used.every((i) => i < count);
}

function regular<A extends { readonly sheet: { readonly file: string } }>(
  aspect: A,
  frames: FrameCount,
  used: readonly number[],
): On<{ readonly aspect: A }> | Off {
  return fits(frames, aspect.sheet.file, used)
    ? { art: true, texture: aspect.sheet.file, aspect }
    : OFF;
}

/**
 * Arte o reserva de cada elemento del mapa. La orilla usa la hoja del fondo (`Tilemap_Flat`): si esa
 * hoja falla, tampoco hay orillas. El puente necesita su imagen y los dos marcos con nombre.
 */
export function resolveMapLooks(
  map: MapAppearance,
  colors: MapColors,
  frames: FrameCount,
  hasFrame: HasFrame,
): MapLooks {
  const { image } = map.bridges;
  const bridgesOk =
    frames(image) !== null &&
    hasFrame(image, BRIDGE_FRAME_NAMES.northSouth) &&
    hasFrame(image, BRIDGE_FRAME_NAMES.eastWest);
  return {
    water: regular(map.water, frames, [map.water.frame]),
    shore: regular(map.shore, frames, Object.values(map.shore.cases)),
    foam: regular(map.foam, frames, map.foam.idle.frames),
    trees: regular(
      map.trees,
      frames,
      map.trees.models.map((m) => m.frame),
    ),
    bridges: bridgesOk
      ? {
          art: true,
          texture: image,
          aspect: map.bridges,
          frames: BRIDGE_FRAME_NAMES,
          rects: map.bridges.frames,
        }
      : OFF,
    castle: regular(map.castle, frames, [map.castle.frame]),
    colors,
  };
}
