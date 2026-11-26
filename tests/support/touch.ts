import type {
  InputLike,
  PointerDownListener,
  PointerLike,
} from '../../src/infrastructure/phaser/touch/TouchJoystick';

// Dobles del input táctil de Phaser (0033): `InputPlugin` con su `pointerdown` y punteros mutables.

/** Puntero mutable con el contrato de `Phaser.Input.Pointer` (id, apoyado y posición en el lienzo). */
export class FakePointer implements PointerLike {
  isDown = false;
  constructor(
    readonly id: number,
    public x = 0,
    public y = 0,
  ) {}

  moveTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }
}

/** `InputPlugin` falso: guarda las escuchas de `pointerdown` y emite toques con lo que hay debajo. */
export class FakeInput implements InputLike {
  listeners: PointerDownListener[] = [];

  on(_event: 'pointerdown', fn: PointerDownListener): this {
    this.listeners.push(fn);
    return this;
  }

  off(_event: 'pointerdown', fn: PointerDownListener): this {
    this.listeners = this.listeners.filter((l) => l !== fn);
    return this;
  }

  /** Un dedo que se apoya en (x, y) con `over` objetos interactivos debajo (las cartas). */
  down(pointer: FakePointer, x: number, y: number, over: readonly unknown[] = []): void {
    pointer.isDown = true;
    pointer.moveTo(x, y);
    for (const l of [...this.listeners]) l(pointer, over);
  }
}
