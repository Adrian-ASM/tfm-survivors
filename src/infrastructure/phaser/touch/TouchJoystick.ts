import { PlayerInput } from '../../../domain/player/PlayerInput';
import type { ScreenFrame } from '../ui/screenFrame';
import type { MoveSource } from './preferKeyboard';
import { STICK_REST, stickVector, type Point } from './stickVector';

/**
 * `Phaser.Input.Events.POINTER_DOWN` en Phaser 4.2.1 (`src/input/events/POINTER_DOWN_EVENT.js`):
 * el `InputPlugin` de la escena lo emite con `(pointer, currentlyOver)` solo si el dedo bajó sobre
 * el lienzo, tras los eventos de los objetos interactivos que haya debajo.
 */
export const POINTER_DOWN_EVENT = 'pointerdown';

/** Lo que se usa de un `Phaser.Input.Pointer`: id, si sigue apoyado y su posición en el lienzo. */
export interface PointerLike {
  readonly id: number;
  readonly isDown: boolean;
  readonly x: number;
  readonly y: number;
}

/** Escucha del `pointerdown`: el puntero y los objetos interactivos que tiene debajo. */
export type PointerDownListener = (pointer: PointerLike, currentlyOver: readonly unknown[]) => void;

/** Lo que se usa del `InputPlugin` de la escena (costura sin motor). */
export interface InputLike {
  on(event: typeof POINTER_DOWN_EVENT, fn: PointerDownListener): unknown;
  off(event: typeof POINTER_DOWN_EVENT, fn: PointerDownListener): unknown;
}

/** Joystick del contenido (`arena.mobile.joystick`): radio en px CSS, zona muerta y zona. */
export interface JoystickSettings {
  readonly radiusPx: number;
  readonly deadZone: number;
  readonly zoneFraction: number;
}

/** Estado para pintar: activo, centro en unidades del lienzo y vector (módulo ≤ 1). */
export interface StickState {
  readonly active: boolean;
  readonly origin: Point;
  readonly vector: Point;
}

const IDLE: StickState = { active: false, origin: STICK_REST, vector: STICK_REST };

/**
 * Joystick flotante (spec touch-controls 0033, design §4.1): adaptador de input hermano de
 * `KeyboardInput`. Captura por evento (un `pointerdown` habilitado, sin otro dedo capturado, sin
 * objeto interactivo debajo y dentro de la zona de arrastre) y lee por sondeo (`isDown`, `x`, `y` del
 * puntero capturado en cada `read`), así el valor no depende del orden de los eventos. El centro no
 * se mueve; el vector se calcula en px CSS. Sin reglas de juego ni azar.
 */
export class TouchJoystick implements MoveSource {
  private pointer: PointerLike | null = null;
  private origin: Point = STICK_REST;
  private enabled = false;
  private zoneRight = 0;
  private cssPerUnit = 1;
  private last: StickState = IDLE;
  private readonly onDown: PointerDownListener = (pointer, over) => {
    this.capture(pointer, over);
  };

  constructor(
    private readonly input: InputLike,
    private readonly settings: JoystickSettings,
  ) {
    input.on(POINTER_DOWN_EVENT, this.onDown);
  }

  /** Zona de arrastre y px CSS por unidad del frame nuevo; el centro capturado no cambia. */
  relayout(frame: ScreenFrame, cssPerUnit: number): void {
    this.zoneRight = this.settings.zoneFraction * frame.width;
    this.cssPerUnit = Number.isFinite(cssPerUnit) && cssPerUnit > 0 ? cssPerUnit : 1;
  }

  /** Deshabilitado suelta el dedo; al volver a habilitarse hace falta un toque nuevo. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.release();
  }

  /** Input de esta lectura: (0, 0) sin dedo capturado o si el dedo ya se levantó. */
  read(): PlayerInput {
    const p = this.pointer;
    if (!p) return PlayerInput.NONE;
    if (!p.isDown) {
      this.release();
      return PlayerInput.NONE;
    }
    const k = this.cssPerUnit;
    const v = stickVector(
      { x: this.origin.x * k, y: this.origin.y * k },
      { x: p.x * k, y: p.y * k },
      this.settings.radiusPx,
      this.settings.deadZone,
    );
    this.last = { active: true, origin: this.origin, vector: v };
    return PlayerInput.of(v.x, v.y);
  }

  /** Estado de la última lectura (para `JoystickView`). */
  get state(): StickState {
    return this.last;
  }

  /** Quita la escucha (al salir de la escena). */
  destroy(): void {
    this.input.off(POINTER_DOWN_EVENT, this.onDown);
    this.release();
  }

  private capture(pointer: PointerLike, over: readonly unknown[]): void {
    if (!this.enabled || this.pointer !== null || over.length > 0) return;
    if (!(pointer.x < this.zoneRight)) return;
    this.pointer = pointer;
    this.origin = { x: pointer.x, y: pointer.y };
    this.last = { active: true, origin: this.origin, vector: STICK_REST };
  }

  private release(): void {
    this.pointer = null;
    this.last = IDLE;
  }
}
