import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import {
  JoystickView,
  type HintText,
  type StickCanvas,
} from '../../src/infrastructure/phaser/touch/JoystickView';
import {
  TouchJoystick,
  type StickState,
} from '../../src/infrastructure/phaser/touch/TouchJoystick';
import { FakeText } from '../support/feedback';
import { DEFAULT_MOBILE } from '../support/builders';
import { FakeInput, FakePointer } from '../support/touch';

/** Doble de `Graphics`: círculos rellenos desde el último `clear()` y recuento de repintados. */
class FakeStickCanvas implements StickCanvas {
  circles: { x: number; y: number; r: number; alpha: number }[] = [];
  clears = 0;
  private alpha = 1;
  clear(): this {
    this.circles = [];
    this.clears += 1;
    return this;
  }
  fillStyle(_color: number, alpha = 1): this {
    this.alpha = alpha;
    return this;
  }
  fillCircle(x: number, y: number, r: number): this {
    this.circles.push({ x, y, r, alpha: this.alpha });
    return this;
  }
}

class FakeHint extends FakeText implements HintText {
  fontSize = 0;
  setFontSize(size: number): this {
    this.fontSize = size;
    return this;
  }
}

const S = 390 / 640;
const FRAME = { width: 1385, height: 640, uiScale: 1.4066 };
const HINT = DEFAULT_MOBILE.joystick.hint;
const IDLE: StickState = { active: false, origin: { x: 0, y: 0 }, vector: { x: 0, y: 0 } };

function view() {
  const canvas = new FakeStickCanvas();
  const text = new FakeHint();
  const v = new JoystickView(canvas, text, HINT, DEFAULT_MOBILE.joystick.radiusPx);
  v.relayout(FRAME, S);
  return { canvas, text, v };
}

// Spec touch-controls (0033), "Indicación en reposo".
describe('JoystickView (0033)', () => {
  it('Scenario: Indicación al empezar (visible con el texto en reposo)', () => {
    const { canvas, text, v } = view();

    v.sync(IDLE, true);

    expect([v.hintVisible, text.visible, text.text]).toEqual([true, true, HINT]);
    expect(text.text).toBe('Arrastra aquí para moverte');
    expect(canvas.circles).toHaveLength(2);
    expect(text.fontSize).toBeCloseTo(14 * FRAME.uiScale, 6);
  });

  it('Scenario: Desaparece con el primer movimiento (no vuelve en 60 frames tras soltar)', () => {
    const { text, v } = view();
    const input = new FakeInput();
    const stick = new TouchJoystick(input, DEFAULT_MOBILE.joystick);
    stick.relayout(FRAME, S);
    stick.setEnabled(true);
    const finger = new FakePointer(1);
    v.sync(stick.state, true);
    // El dedo se apoya sobre la indicación (no es interactiva) y da un input no nulo.
    input.down(finger, 100, 500);
    finger.moveTo(200, 500);
    v.noteInput(stick.read());
    v.sync(stick.state, true);
    finger.isDown = false;
    const shown = Array.from({ length: 60 }, () => {
      v.noteInput(stick.read());
      v.sync(stick.state, true);
      return v.hintVisible || text.visible;
    });

    expect(shown.some(Boolean)).toBe(false);
  });

  it('Scenario: Toque en la zona muerta no la quita (5 px: input nulo, sigue visible)', () => {
    const { v } = view();
    const input = new FakeInput();
    const stick = new TouchJoystick(input, DEFAULT_MOBILE.joystick);
    stick.relayout(FRAME, S);
    stick.setEnabled(true);
    const finger = new FakePointer(1);
    input.down(finger, 100, 500);
    finger.moveTo(100 + 5 / S, 500);
    v.noteInput(stick.read());
    finger.isDown = false;
    v.noteInput(stick.read());

    v.sync(stick.state, true);

    expect(v.hintVisible).toBe(true);
  });

  it('teclado: el primer input no nulo también la quita', () => {
    const { v } = view();
    v.noteInput(PlayerInput.of(1, 0));
    v.sync(IDLE, true);
    expect(v.hintVisible).toBe(false);
  });

  it('Scenario: Vuelve en cada partida nueva (resetHint al reiniciar)', () => {
    const { v } = view();
    v.noteInput(PlayerInput.of(1, 0));
    v.sync(IDLE, true);

    v.resetHint();
    v.sync(IDLE, true);

    expect(v.hintVisible).toBe(true);
  });

  it('oculta en pausa, oferta, tienda, obra o aviso (playing falso)', () => {
    const { canvas, text, v } = view();
    v.sync(IDLE, false);
    expect([v.hintVisible, text.visible, canvas.circles.length]).toEqual([false, false, 0]);
  });

  it('activo: base en el centro y pomo en centro + vector · radio (radio en unidades)', () => {
    const { canvas, v } = view();
    const r = DEFAULT_MOBILE.joystick.radiusPx / S;
    v.sync({ active: true, origin: { x: 300, y: 400 }, vector: { x: 1, y: 0 } }, true);
    expect(canvas.circles.map((c) => [c.x, c.y])).toEqual([
      [300, 400],
      [300 + r, 400],
    ]);
    expect(canvas.circles[0]?.r).toBeCloseTo(r, 9);
  });

  it('solo repinta si cambia el estado', () => {
    const { canvas, v } = view();
    v.sync(IDLE, true);
    v.sync(IDLE, true);
    v.sync(IDLE, true);
    expect(canvas.clears).toBe(1);
  });
});
