/** Tamaño del mundo en px (la `arena` del contenido: 1.920 × 1.080 por defecto). */
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
 * `setBounds`, `startFollow(target, roundPixels, lerpX, lerpY)` y `worldView`.
 */
export interface FollowCamera {
  setBounds(x: number, y: number, width: number, height: number): unknown;
  startFollow(target: object, roundPixels: boolean, lerpX: number, lerpY: number): unknown;
  readonly worldView: CameraView;
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

  constructor(
    private readonly camera: FollowCamera,
    world: WorldSize,
  ) {
    camera.setBounds(0, 0, world.width, world.height);
    camera.startFollow(this.target, ROUND_PIXELS, DIRECT_FOLLOW, DIRECT_FOLLOW);
  }

  /** Lleva el objetivo a la posición del jugador del snapshot que se va a pintar. */
  track(player: { readonly x: number; readonly y: number }): void {
    this.target.x = player.x;
    this.target.y = player.y;
  }

  /** Copia del rectángulo visible del último frame pintado (para la sonda E2E). */
  view(): CameraView {
    const { x, y, width, height } = this.camera.worldView;
    return { x, y, width, height };
  }
}
