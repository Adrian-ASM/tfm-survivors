import type { MobileDisplay } from '../infrastructure/content/schemas';
import { FullscreenControl, type FullscreenLike } from '../infrastructure/dom/FullscreenControl';
import { RotateNotice, isPortrait } from '../infrastructure/dom/RotateNotice';
import { TouchBar } from '../infrastructure/dom/TouchBar';
import { DESKTOP_VIEWPORT, type ViewportMode } from '../infrastructure/e2e/viewportProbe';
import type { SceneTouch } from '../infrastructure/phaser/GameScene';
import { mobileFrameRule } from '../infrastructure/phaser/ui/mobileFrame';
import {
  screenFrame,
  type FrameRule,
  type FrameSize,
  type ScreenFrame,
} from '../infrastructure/phaser/ui/screenFrame';

/** Clase del documento con el modo móvil: todas las reglas táctiles de `styles.css` cuelgan de ella. */
export const MOBILE_CLASS = 'is-mobile';
/** Punteros táctiles del motor en modo móvil: el joystick y otro dedo (cartas, barra, paneles). */
export const MOBILE_ACTIVE_POINTERS = 2;

/** Lo que la composición le da al cableado: DOM y la Fullscreen API (costuras para los tests). */
export interface MobileEnv {
  readonly doc: Document;
  /** Contenedor `#game`: la barra y el aviso van dentro, junto a los paneles. */
  readonly root: HTMLElement;
  /** `classList` de `<html>` (CSSOM: lo permite la CSP). */
  readonly classes: { toggle(token: string, force: boolean): unknown };
  readonly fullscreen: FullscreenLike;
}

/** Dependencias de `GameScene` que solo existen en modo móvil (vacías en escritorio). */
export interface MobileSceneDeps {
  readonly frameRule?: FrameRule;
  readonly touch?: SceneTouch;
  readonly hold?: () => boolean;
}

/** Lo que el modo de la carga cambia en la composición (ADR-0029). */
export interface MobileSetup {
  readonly on: boolean;
  readonly sceneDeps: MobileSceneDeps;
  /** Config de input del juego: multitoque solo en móvil (en escritorio, la de siempre). */
  readonly input?: { readonly activePointers: number };
  readonly viewport: ViewportMode;
  /** Frame de la escala de los paneles DOM: en móvil, 1 siempre; en escritorio, el escalón. */
  domFrame(game: FrameSize): ScreenFrame;
  /** Con el tamaño del padre (al cargar y en cada RESIZE): aviso de orientación en móvil. */
  orient(parent: FrameSize): void;
}

const DESKTOP: MobileSetup = {
  on: false,
  sceneDeps: {},
  viewport: DESKTOP_VIEWPORT,
  domFrame: (game) => screenFrame(game.width, game.height),
  orient: () => undefined,
};

/**
 * Cableado del modo móvil (spec mobile-display y touch-controls 0033, design §1, §4 y §5). Sin modo
 * móvil no crea ningún nodo ni dependencia: la escena y la página son las de siempre. Con él: clase
 * `is-mobile`, barra ⏸ ↻ (⛶ si hay pantalla completa), aviso «Gira el móvil» como retención,
 * regla de frame con k fraccionario, escala DOM 1 y dos punteros táctiles.
 */
export function wireMobile(on: boolean, mobile: MobileDisplay, env: MobileEnv): MobileSetup {
  env.classes.toggle(MOBILE_CLASS, on);
  if (!on) return DESKTOP;
  const fullscreen = new FullscreenControl(env.fullscreen);
  const bar = new TouchBar(env.doc, env.root, fullscreen.available ? fullscreen : undefined);
  const notice = new RotateNotice(env.doc, env.root);
  const frameRule = mobileFrameRule(mobile.minTextPx);
  let portrait = false;
  return {
    on: true,
    sceneDeps: {
      frameRule,
      touch: { joystick: mobile.joystick, bar },
      hold: () => portrait,
    },
    input: { activePointers: MOBILE_ACTIVE_POINTERS },
    viewport: { mobile: true, rule: frameRule },
    domFrame: (game) => ({ ...screenFrame(game.width, game.height), uiScale: 1 }),
    orient: (parent) => {
      portrait = isPortrait(parent);
      notice.setVisible(portrait);
    },
  };
}
