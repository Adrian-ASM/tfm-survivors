import type { UiPiece } from '../../content/appearanceSchema';
import { nineSliceGeometry, uiMargins, type SliceMargins } from './nineSlice';
import type { CenteredRect } from './uiLayout';

// Piezas de UI en Phaser (0032, design §5): un `NineSlice` por carta y por panel del HUD, creado
// una vez y recolocado solo con `place`. API de Phaser 4.2.1 comprobada en los tipos instalados:
// `add.nineslice(x, y, texture, frame, w, h, left, right, top, bottom)`; `setSize` no escala los
// márgenes (por eso `setScale(k)` + `setSize(w / k, h / k)`) y solo pinta con WebGL.

/** `Phaser.WEBGL` (4.2.1, `src/const.js`): sin importar el motor, este módulo se prueba en Node. */
export const WEBGL_RENDERER = 2;

/** Costura de una pieza en Phaser: la real (`NineSlicePanel`) o el objeto nulo de la reserva. */
export interface UiPanelPart {
  setVisible(visible: boolean): unknown;
  place(rect: CenteredRect, uiScale: number): void;
}

/** Reserva: sin marco (el aspecto actual del HUD; en la carta, su `Rectangle` de siempre). */
export const NO_PANEL: UiPanelPart = {
  setVisible: () => undefined,
  place: () => undefined,
};

/** Lo que se usa del `NineSlice` del motor (doble en los tests). */
export interface NineSliceLike {
  setPosition(x: number, y: number): unknown;
  setScale(scale: number): unknown;
  setSize(width: number, height: number): unknown;
  setVisible(visible: boolean): unknown;
}

/** Pieza real: `place` coloca el centro, escala k y tamaño sin escalar (esquina = margen × k). */
export class NineSlicePanel implements UiPanelPart {
  constructor(
    private readonly slice: NineSliceLike,
    private readonly margins: SliceMargins,
  ) {}

  setVisible(visible: boolean): void {
    this.slice.setVisible(visible);
  }

  place(rect: CenteredRect, uiScale: number): void {
    const g = nineSliceGeometry(rect, uiScale, this.margins);
    this.slice.setPosition(g.x, g.y);
    this.slice.setScale(g.scale);
    this.slice.setSize(g.width, g.height);
  }
}

/** Lo que `createUiPanel` necesita de la escena (también del doble de los tests). */
export interface UiPanelScene {
  readonly textures: { exists(key: string): boolean };
  readonly game: { readonly renderer: { readonly type: number } };
  readonly add: {
    nineslice(
      x: number,
      y: number,
      texture: string,
      frame: string | number | undefined,
      width: number,
      height: number,
      leftWidth: number,
      rightWidth: number,
      topHeight: number,
      bottomHeight: number,
    ): NineSliceLike & {
      setScrollFactor(f: number): unknown;
      setDepth(d: number): unknown;
    };
  };
}

/**
 * Crea la pieza si su textura existe y el renderizador es WebGL (en Canvas `NineSlice` no pinta
 * nada); si no, `null` y el llamador usa la reserva. Fija a la cámara y en la profundidad dada.
 */
export function createUiPanel(
  scene: UiPanelScene,
  piece: UiPiece,
  depth: number,
): NineSlicePanel | null {
  if (!scene.textures.exists(piece.image)) return null;
  if (scene.game.renderer.type !== WEBGL_RENDERER) return null;
  const m = uiMargins(piece);
  const slice = scene.add.nineslice(
    0,
    0,
    piece.image,
    undefined,
    m.left + m.right,
    m.top + m.bottom,
    m.left,
    m.right,
    m.top,
    m.bottom,
  );
  slice.setScrollFactor(0);
  slice.setDepth(depth);
  return new NineSlicePanel(slice, m);
}
