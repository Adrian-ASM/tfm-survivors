import type { StillLook } from './art/looks';
import type { WorldSize } from './CameraRig';
import type { SpriteCount } from './PlayerView';
import { RenderLayers, type RenderParts } from './RenderLayers';
import type { TerrainCanvas } from './TerrainView';

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
 * Área de juego de una partida: el fondo del mundo primero (debajo de todo; se mueve con el mundo,
 * sin `scrollFactor`), después la textura del mapa (0015: encima del fondo y debajo del resto) y
 * después las capas, en orden de pintado.
 */
export function createPlayfield(
  parts: RenderParts,
  ground: GroundFactory,
  world: WorldSize,
  terrain: () => TerrainCanvas,
): { layers: RenderLayers; terrain: TerrainCanvas } {
  const counts = createGround(ground, parts.looks.ground, world);
  const canvas = terrain();
  return { layers: new RenderLayers(parts, counts), terrain: canvas };
}
