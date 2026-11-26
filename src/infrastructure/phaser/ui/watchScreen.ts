import { displayScale } from './mobileFrame';
import { desktopFrameRule, type FrameRule, type ScreenFrame } from './screenFrame';

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
  /** Tamaño mostrado del lienzo en px CSS (0033: en EXPAND difiere del `gameSize`). */
  readonly displaySize: Size;
  on(event: string, fn: ResizeListener): unknown;
  off(event: string, fn: ResizeListener): unknown;
}

/** Lo que se usa de los eventos de la escena. */
export interface SceneEventsLike {
  once(event: string, fn: () => void): unknown;
}

/** Aplica el frame y los px CSS por unidad lógica del lienzo (1 en escritorio; 0033). */
export type ApplyFrame = (frame: ScreenFrame, cssPerUnit: number) => void;

/**
 * Aplica el frame del lienzo al entrar y en cada RESIZE, y quita la escucha en SHUTDOWN (design
 * 0017 D6): el `ScaleManager` es global, así que sin `off` cada vuelta del menú sumaría una escucha.
 * El frame sale de `rule` (0033: la de escritorio por defecto, la móvil con k fraccionario) con el
 * `gameSize` del evento y el `displaySize` del gestor, que el motor actualiza antes de emitir.
 */
export function watchScreen(
  scale: ScaleLike,
  sceneEvents: SceneEventsLike,
  apply: ApplyFrame,
  rule: FrameRule = desktopFrameRule,
): void {
  const applyFor = (game: Size): void => {
    const display = scale.displaySize;
    apply(rule(game, display), displayScale(game, display));
  };
  const onResize = (size: Size): void => {
    applyFor(size);
  };
  applyFor(scale.gameSize);
  scale.on(RESIZE_EVENT, onResize);
  sceneEvents.once(SHUTDOWN_EVENT, () => {
    scale.off(RESIZE_EVENT, onResize);
  });
}
