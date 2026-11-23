import { screenFrame, type ScreenFrame } from './screenFrame';

/** `Phaser.Scale.Events.RESIZE` en Phaser 4.2.1 (`src/scale/events/RESIZE_EVENT.js`). */
export const RESIZE_EVENT = 'resize';
/** `Phaser.Scenes.Events.SHUTDOWN` en Phaser 4.2.1 (`src/scene/events/SHUTDOWN_EVENT.js`). */
export const SHUTDOWN_EVENT = 'shutdown';

type Size = { readonly width: number; readonly height: number };
/** Escucha de RESIZE: recibe el `gameSize` nuevo. */
export type ResizeListener = (size: Size) => void;

/** Lo que se usa del `ScaleManager` (global del juego): costura sin motor. */
export interface ScaleLike {
  readonly gameSize: Size;
  on(event: string, fn: ResizeListener): unknown;
  off(event: string, fn: ResizeListener): unknown;
}

/** Lo que se usa de los eventos de la escena. */
export interface SceneEventsLike {
  once(event: string, fn: () => void): unknown;
}

/**
 * Aplica el frame del lienzo al entrar y en cada RESIZE, y quita la escucha en SHUTDOWN (design
 * 0017 D6): el `ScaleManager` es global, así que sin `off` cada vuelta del menú sumaría una escucha.
 * El motor emite RESIZE como mucho una vez por frame (en `PRE_STEP`).
 */
export function watchScreen(
  scale: ScaleLike,
  sceneEvents: SceneEventsLike,
  apply: (frame: ScreenFrame) => void,
): void {
  const onResize = (size: Size): void => {
    apply(screenFrame(size.width, size.height));
  };
  apply(screenFrame(scale.gameSize.width, scale.gameSize.height));
  scale.on(RESIZE_EVENT, onResize);
  sceneEvents.once(SHUTDOWN_EVENT, () => {
    scale.off(RESIZE_EVENT, onResize);
  });
}
