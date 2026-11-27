import type Phaser from 'phaser';
import appearanceJson from '../../content/appearance.json';
import type { UiAppearance } from '../../src/infrastructure/content/appearanceSchema';
import { WEBGL_RENDERER } from '../../src/infrastructure/phaser/ui/uiPanel';
import { repoAppearance } from './mapArt';

// Escena falsa de Phaser para los widgets con piezas de UI (0032): registra cada objeto creado
// (rectángulos, textos, imágenes y `nineslice`) y su estado tras las llamadas de los widgets.

/** Estado de un objeto creado por la escena falsa. */
export interface UiMade {
  readonly kind: 'rectangle' | 'text' | 'image' | 'nineslice';
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  visible: boolean;
  depth: number | null;
  scrollFactor: number | null;
  /** Rectángulo: relleno, opacidad del relleno y trazo (null si no tiene). */
  fill: number | null;
  fillAlpha: number;
  stroke: number | null;
  /** Texto: estilo inicial, tamaño de letra, color y origen. */
  style: Record<string, unknown> | null;
  fontSize: number | string | null;
  originX: number;
  originY: number;
  texture: string | null;
  /** NineSlice: márgenes (l, r, t, b) de la creación. */
  slices: [number, number, number, number] | null;
  interactive: boolean;
  handlers: Map<string, () => void>;
  /** Imagen (0036): frame de la creación, recorte (`setCrop`) y si se le pidió una animación. */
  frame: number | string | null;
  crop: [number, number, number, number] | null;
  played: boolean;
}

export interface FakeUiSceneOptions {
  readonly view: { width: number; height: number };
  /** Texturas que existen (por clave); por defecto todas. */
  readonly textures?: ((key: string) => boolean) | undefined;
  /** Renderizador WebGL (por defecto) o Canvas. */
  readonly webgl?: boolean | undefined;
}

function blank(kind: UiMade['kind'], x: number, y: number): UiMade {
  return {
    kind,
    x,
    y,
    width: 0,
    height: 0,
    scale: 1,
    visible: true,
    depth: null,
    scrollFactor: null,
    fill: null,
    fillAlpha: 1,
    stroke: null,
    style: null,
    fontSize: null,
    originX: 0.5,
    originY: 0.5,
    texture: null,
    slices: null,
    interactive: false,
    handlers: new Map(),
    frame: null,
    crop: null,
    played: false,
  };
}

/** Escena falsa con `scale`, `textures`, `game.renderer` y `add.*`; `made` lista lo creado. */
export function fakeUiScene(options: FakeUiSceneOptions): {
  scene: Phaser.Scene;
  made: UiMade[];
} {
  const made: UiMade[] = [];
  const wrap = (state: UiMade): unknown => {
    made.push(state);
    const self: unknown = new Proxy(state, {
      get(target, prop) {
        const set =
          (fn: (...a: never[]) => void) =>
          (...a: never[]) => (fn(...a), self);
        switch (prop) {
          case 'setPosition':
            return set((x: number, y: number) => ((target.x = x), (target.y = y)));
          case 'setSize':
            return set((w: number, h: number) => ((target.width = w), (target.height = h)));
          case 'setDisplaySize':
            return set((w: number, h: number) => ((target.width = w), (target.height = h)));
          case 'setScale':
            return set((s: number) => (target.scale = s));
          case 'setTexture':
            return set((key: string) => (target.texture = key));
          case 'setVisible':
            return set((v: boolean) => (target.visible = v));
          case 'setDepth':
            return set((d: number) => (target.depth = d));
          case 'setScrollFactor':
            return set((f: number) => (target.scrollFactor = f));
          case 'setStrokeStyle':
            return set((_w: number, c: number) => (target.stroke = c));
          case 'setFontSize':
            return set((s: number) => (target.fontSize = s));
          case 'setOrigin':
            return set(
              (ox: number, oy?: number) => ((target.originX = ox), (target.originY = oy ?? ox)),
            );
          case 'setCrop':
            return set(
              (x: number, y: number, w: number, h: number) => (target.crop = [x, y, w, h]),
            );
          case 'play':
          case 'playAfterDelay':
            return set(() => (target.played = true));
          case 'setInteractive':
            return set(() => (target.interactive = true));
          case 'on':
            return set((event: string, fn: () => void) => target.handlers.set(event, fn));
          default:
            if (prop in target) return target[prop as keyof UiMade];
            return () => self;
        }
      },
    });
    return self;
  };
  const exists = options.textures ?? (() => true);
  const scene = {
    scale: options.view,
    textures: { exists },
    game: { renderer: { type: options.webgl === false ? 1 : WEBGL_RENDERER } },
    add: {
      rectangle: (x: number, y: number, w: number, h: number, fill?: number, alpha?: number) => {
        const s = blank('rectangle', x, y);
        s.width = w;
        s.height = h;
        s.fill = fill ?? null;
        s.fillAlpha = alpha ?? 1;
        return wrap(s);
      },
      text: (x: number, y: number, _t: string, style: Record<string, unknown>) => {
        const s = blank('text', x, y);
        s.style = style;
        s.fontSize = (style.fontSize as number | string | undefined) ?? null;
        s.originX = 0;
        s.originY = 0;
        return wrap(s);
      },
      image: (x: number, y: number, texture: string, frame?: number | string) => {
        const s = blank('image', x, y);
        s.texture = texture;
        s.frame = frame ?? null;
        return wrap(s);
      },
      nineslice: (
        x: number,
        y: number,
        texture: string,
        _frame: unknown,
        w: number,
        h: number,
        l: number,
        r: number,
        t: number,
        b: number,
      ) => {
        const s = blank('nineslice', x, y);
        s.texture = texture;
        s.width = w;
        s.height = h;
        s.slices = [l, r, t, b];
        return wrap(s);
      },
    },
  };
  return { scene: scene as unknown as Phaser.Scene, made };
}

/** Interfaz de los datos del repositorio, validada. */
export const repoUi = (): UiAppearance => repoAppearance().ui;

/** Interfaz del repositorio con la pieza `role` sustituida por márgenes de prueba (l, t, r, b). */
export function uiWithMargins(
  role: 'button' | 'panel',
  m: { left: number; top: number; right: number; bottom: number },
): UiAppearance {
  const ui = repoUi();
  return { ...ui, pieces: { ...ui.pieces, [role]: { ...ui.pieces[role], slice: { ...m } } } };
}

/** `ui` cruda del repositorio (para editar antes de validar). */
export const rawRepoUi = () => structuredClone(appearanceJson.ui);
