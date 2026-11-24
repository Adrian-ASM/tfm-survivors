import type { ScreenFrame } from './ui/screenFrame';

/** Tamaño del mundo en px (la `arena` del contenido: 3.840 × 2.160 por defecto). */
export interface WorldSize {
  readonly width: number;
  readonly height: number;
}

/** Rectángulo visible en coordenadas de mundo (esquina superior izquierda y tamaño de la vista). */
export interface CameraView {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Lo que `CameraRig` usa de la cámara de Phaser 4.2.1 (costura sin motor, como `GroundFactory`):
 * `setBounds`, `setSize` (BaseCamera), `startFollow(target, roundPixels, lerpX, lerpY)` y `worldView`.
 */
export interface FollowCamera {
  setBounds(x: number, y: number, width: number, height: number): unknown;
  setSize(width: number, height: number): unknown;
  startFollow(target: object, roundPixels: boolean, lerpX: number, lerpY: number): unknown;
  readonly worldView: CameraView;
  /** Tamaño de la vista (BaseCamera `width`/`height`), ya el de este frame tras `setSize`. */
  readonly width: number;
  readonly height: number;
}

const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);

/**
 * Rectángulo visible del frame que se va a pintar (0018, design D1): la fórmula del `preRender` de
 * la cámara con origen 0,5, zoom 1 y límites (0, 0, W, H). Se calcula en `update`, antes del
 * `preRender`, cuando el `worldView` aún es el del frame anterior.
 */
export function followView(
  target: { readonly x: number; readonly y: number },
  size: { readonly width: number; readonly height: number },
  world: WorldSize,
): CameraView {
  const { width, height } = size;
  return {
    x: clamp(target.x - width / 2, 0, Math.max(0, world.width - width)),
    y: clamp(target.y - height / 2, 0, Math.max(0, world.height - height)),
    width,
    height,
  };
}

/** Sin redondeo a píxel entero: como hasta 0013 (sin `pixelArt`; riesgo R4 del design). */
const ROUND_PIXELS = false;
/** Lerp 1: la cámara salta al objetivo en el mismo frame (seguimiento directo, sin suavizado). */
const DIRECT_FOLLOW = 1;

/**
 * Cámara que sigue al jugador dentro del mundo (spec world-camera, design D2). Sigue a un objetivo
 * plano propio, no al sprite: `track` copia la posición del snapshot y el motor, en el `preRender`
 * de la cámara, la centra y recorta el scroll a [0, W − V_w] × [0, H − V_h].
 */
export class CameraRig {
  private readonly target = { x: 0, y: 0 };
  private size = '';

  constructor(
    private readonly camera: FollowCamera,
    private readonly world: WorldSize,
  ) {
    camera.setBounds(0, 0, world.width, world.height);
    camera.startFollow(this.target, ROUND_PIXELS, DIRECT_FOLLOW, DIRECT_FOLLOW);
  }

  /**
   * Vista del tamaño del lienzo (0017, design D4): explícito, sin depender de la heurística de
   * `CameraManager.onResize`. Con el mismo tamaño no hace nada.
   */
  resize(frame: ScreenFrame): void {
    const size = `${String(frame.width)}x${String(frame.height)}`;
    if (size === this.size) return;
    this.size = size;
    this.camera.setSize(frame.width, frame.height);
  }

  /** Lleva el objetivo a la posición del jugador del snapshot que se va a pintar. */
  track(player: { readonly x: number; readonly y: number }): void {
    this.target.x = player.x;
    this.target.y = player.y;
  }

  /** Rectángulo visible que pintará el próximo `preRender` (objetivo de `track`, tamaño actual). */
  nextView(): CameraView {
    return followView(this.target, this.camera, this.world);
  }

  /** Copia del rectángulo visible del último frame pintado (para la sonda E2E). */
  view(): CameraView {
    const { x, y, width, height } = this.camera.worldView;
    return { x, y, width, height };
  }
}
