import type { StillLook } from './art/looks';
import type { SpriteCount } from './PlayerView';
import { RenderLayers, type RenderParts } from './RenderLayers';

/**
 * Cómo crea la escena el fondo (costura sin motor): un mosaico de un frame de la hoja de suelo o, en
 * reserva, un relleno liso. Ambos desde (0, 0) con origen (0, 0), del tamaño de la vista.
 */
export interface GroundFactory {
  tiles(width: number, height: number, texture: string, frame: number, tileScale: number): void;
  rect(width: number, height: number, color: number): void;
}

export interface ViewSize {
  readonly width: number;
  readonly height: number;
}

/** Crea el fondo y devuelve su recuento para la sonda (siempre 1 visible; reserva si no hay hoja). */
export function createGround(factory: GroundFactory, look: StillLook, view: ViewSize): SpriteCount {
  if (look.placeholder) {
    factory.rect(view.width, view.height, look.color);
    return { visible: 1, placeholder: 1 };
  }
  factory.tiles(view.width, view.height, look.texture, look.idle.frames[0] ?? 0, look.scale);
  return { visible: 1, placeholder: 0 };
}

/**
 * Área de juego de una partida: el fondo primero (debajo de todo, sin cámara que siga al jugador) y
 * después las capas, en orden de pintado.
 */
export function createPlayfield(
  parts: RenderParts,
  ground: GroundFactory,
  view: ViewSize,
): { layers: RenderLayers } {
  const counts = createGround(ground, parts.looks.ground, view);
  return { layers: new RenderLayers(parts, counts) };
}
