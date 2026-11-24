import {
  RUIN_COLOR_KEY,
  type Appearance,
  type MapAppearance,
  type SheetRect,
  type StructureAspect,
} from '../../content/appearanceSchema';
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
  /** Casas y torres (0021): arte o reserva por tipo y aspecto, y sus colores de reserva. */
  readonly structures: StructureLooks;
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
  structures: StructureLooks,
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
    structures,
  };
}

/** Arte de un aspecto de estructura (0021) o su reserva. */
export type StructureLook = On<{ readonly aspect: StructureAspect }> | Off;

/**
 * Aspectos de las estructuras resueltos (0021): por tipo, el intacto y el de ruina, cada uno con
 * arte o reserva por separado; y los colores de reserva por tipo y de ruina.
 */
export interface StructureLooks {
  readonly types: Readonly<
    Record<string, { readonly intact: StructureLook; readonly ruin: StructureLook }>
  >;
  /** Color de reserva de cada tipo intacto. */
  readonly colors: Readonly<Record<string, number>>;
  /** Color de reserva de las ruinas. */
  readonly ruinColor: number;
}

/** Arte o reserva de cada aspecto de estructura: hoja cargada y su frame `idle[0]` dentro. */
export function resolveStructureLooks(appearance: Appearance, frames: FrameCount): StructureLooks {
  const look = (aspect: StructureAspect): StructureLook =>
    regular(aspect, frames, aspect.idle.frames.slice(0, 1));
  const types = Object.fromEntries(
    Object.entries(appearance.structures).map(([id, a]) => [
      id,
      { intact: look(a.intact), ruin: look(a.ruin) },
    ]),
  );
  const { [RUIN_COLOR_KEY]: ruinColor = 0, ...colors } = appearance.structureColors;
  return { types, colors, ruinColor };
}
