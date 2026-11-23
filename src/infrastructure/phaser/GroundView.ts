import type { StillLook } from './art/looks';
import type { WorldSize } from './CameraRig';
import type { SpriteCount } from './PlayerView';
import { RenderLayers, type RenderParts } from './RenderLayers';
import type { MapArtCanvas } from './TerrainView';

/**
 * Cómo crea la escena el fondo (costura sin motor): un mosaico de un frame de la hoja de suelo o, en
 * reserva, un relleno liso. Ambos desde (0, 0) con origen (0, 0), del tamaño del mundo (0013): la
 * cámara se desplaza sobre él y nunca muestra nada fuera de (0, 0)–(W, H).
 */
export interface GroundFactory {
  tiles(width: number, height: number, texture: string, frame: number, tileScale: number): void;
  rect(width: number, height: number, color: number): void;
}

/** Crea el fondo y devuelve su recuento para la sonda (siempre 1 visible; reserva si no hay hoja). */
export function createGround(
  factory: GroundFactory,
  look: StillLook,
  world: WorldSize,
): SpriteCount {
  if (look.placeholder) {
    factory.rect(world.width, world.height, look.color);
    return { visible: 1, placeholder: 1 };
  }
  factory.tiles(world.width, world.height, look.texture, look.idle.frames[0] ?? 0, look.scale);
  return { visible: 1, placeholder: 0 };
}

/**
 * Cómo crea la escena las dos capas del mapa (costura sin motor, design 0016 §5.4): la baja en una
 * llamada y la alta en otra, para que su orden de creación rodee al de las entidades. La alta
 * devuelve el lienzo de las dos.
 */
export interface MapArtLayers {
  low(): void;
  high(): MapArtCanvas;
}

/**
 * Área de juego de una partida, en orden de pintado: el fondo del mundo (debajo de todo; se mueve
 * con el mundo, sin `scrollFactor`), la capa baja del mapa (agua, orillas, puentes, troncos y
 * fachada), las entidades y la capa alta del mapa (copas y tejado). HUD y overlays, después.
 */
export function createPlayfield(
  parts: RenderParts,
  ground: GroundFactory,
  world: WorldSize,
  mapArt: MapArtLayers,
): { layers: RenderLayers; mapArt: MapArtCanvas } {
  const counts = createGround(ground, parts.looks.ground, world);
  mapArt.low();
  const layers = new RenderLayers(parts, counts);
  return { layers, mapArt: mapArt.high() };
}
