import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import {
  preferKeyboard,
  type MoveSource,
} from '../../src/infrastructure/phaser/touch/preferKeyboard';
import { stickVector } from '../../src/infrastructure/phaser/touch/stickVector';
import { TouchJoystick } from '../../src/infrastructure/phaser/touch/TouchJoystick';
import { aRunConfig } from '../support/builders';
import { startRun } from '../support/runs';
import { FakeInput, FakePointer } from '../support/touch';

// Spec touch-controls (0033): ventana de 844 × 390 px CSS (lienzo 1.385 × 640), R = 60 px CSS,
// z = 0,2 y zona 0,5. Los toques se dan en px CSS; el motor los pasa a unidades del lienzo (/ s).
const S = 390 / 640;
const FRAME = { width: 1385, height: 640, uiScale: 1.4066 };
const SETTINGS = { radiusPx: 60, deadZone: 0.2, zoneFraction: 0.5 };
const css = (v: number): number => v / S;

function joystick() {
  const input = new FakeInput();
  const stick = new TouchJoystick(input, SETTINGS);
  stick.relayout(FRAME, S);
  stick.setEnabled(true);
  const finger = new FakePointer(1);
  /** Apoya el dedo en (x, y) px CSS. */
  const down = (x: number, y: number, p = finger, over: readonly unknown[] = []) => {
    input.down(p, css(x), css(y), over);
  };
  const move = (x: number, y: number, p = finger) => {
    p.moveTo(css(x), css(y));
  };
  return { input, stick, finger, down, move };
}

const xy = (i: PlayerInput): [number, number] => [i.direction.x, i.direction.y];
const near = (a: [number, number], b: [number, number]) => {
  expect(Math.abs(a[0] - b[0])).toBeLessThanOrEqual(0.001);
  expect(Math.abs(a[1] - b[1])).toBeLessThanOrEqual(0.001);
};

describe('stickVector (0033)', () => {
  it('Scenario: Vector a media distancia ((200, 250) → (230, 250): 0,375)', () => {
    near(
      Object.values(stickVector({ x: 200, y: 250 }, { x: 230, y: 250 }, 60, 0.2)) as [
        number,
        number,
      ],
      [0.375, 0],
    );
  });

  it('módulo 0 sin desplazamiento y nunca > 1', () => {
    expect(stickVector({ x: 1, y: 1 }, { x: 1, y: 1 }, 60, 0.2)).toEqual({ x: 0, y: 0 });
    const far = stickVector({ x: 0, y: 0 }, { x: 900, y: 900 }, 60, 0.2);
    expect(Math.hypot(far.x, far.y)).toBeCloseTo(1, 9);
  });
});

describe('TouchJoystick (0033)', () => {
  it('Scenario: Vector a media distancia (input (0,375, 0))', () => {
    const { stick, down, move } = joystick();
    down(200, 250);
    move(230, 250);
    near(xy(stick.read()), [0.375, 0]);
  });

  it('Scenario: Vector en diagonal ((230, 290): (0,475, 0,6333))', () => {
    const { stick, down, move } = joystick();
    down(200, 250);
    move(230, 290);
    near(xy(stick.read()), [0.475, 0.6333]);
  });

  it('Scenario: Zona muerta y su borde ((205), (212), (212,5): 0, 0 y 0,0104)', () => {
    const { stick, down, move } = joystick();
    down(200, 250);
    const reads = [205, 212, 212.5].map((x) => {
      move(x, 250);
      return xy(stick.read());
    });
    near(reads[0] ?? [9, 9], [0, 0]);
    near(reads[1] ?? [9, 9], [0, 0]);
    near(reads[2] ?? [9, 9], [0.0104, 0]);
  });

  it('Scenario: Saturación en el radio y más allá ((260, 250) → (1, 0); (200, 50) → (0, −1))', () => {
    const { stick, down, move } = joystick();
    down(200, 250);
    move(260, 250);
    const a = stick.read();
    move(200, 50);
    const b = stick.read();
    near(xy(a), [1, 0]);
    near(xy(b), [0, -1]);
    expect(b.direction.length()).toBeLessThanOrEqual(1);
  });

  it('Scenario: El dedo cruza la mitad del lienzo ((400, 200) → (600, 200): mismo centro, (1, 0))', () => {
    const { stick, down, move } = joystick();
    down(400, 200);
    move(600, 200);
    near(xy(stick.read()), [1, 0]);
    expect(stick.state.active).toBe(true);
    expect(stick.state.origin.x * S).toBeCloseTo(400, 6);
  });

  it('Scenario: Toque fuera de la zona de arrastre ((600, 200) → (300, 200), 60 lecturas a 0)', () => {
    const { stick, down, move } = joystick();
    down(600, 200);
    move(300, 200);
    const reads = Array.from({ length: 60 }, () => xy(stick.read()));
    expect(reads.every(([x, y]) => x === 0 && y === 0)).toBe(true);
    expect(stick.state.active).toBe(false);
  });

  it('Scenario: Soltar para el jugador (1 frame tras levantar: input 0 y el jugador quieto)', () => {
    const { stick, finger, down, move } = joystick();
    const run = startRun(aRunConfig(), { player: { x: 480, y: 270 } });
    down(200, 250);
    move(260, 250);
    run.tick(stick.read());
    const before = run.snapshot().player;

    finger.isDown = false;
    const input = stick.read();
    run.tick(input);

    expect(xy(input)).toEqual([0, 0]);
    expect(run.snapshot().player.x).toBe(before.x);
    expect(before.x).toBeGreaterThan(480);
  });

  it('Scenario: Toque cancelado (isDown falso: input 0 y sin joystick activo)', () => {
    const { stick, finger, down, move } = joystick();
    down(200, 250);
    move(260, 250);
    stick.read();

    finger.isDown = false;

    expect(xy(stick.read())).toEqual([0, 0]);
    expect(stick.state.active).toBe(false);
  });

  it('Scenario: Toque en una carta de la zona de arrastre (objeto interactivo debajo: sin joystick)', () => {
    const { stick, down, move } = joystick();
    down(200, 250, undefined, [{ card: 0 }]);
    move(260, 250);
    expect(xy(stick.read())).toEqual([0, 0]);
    expect(stick.state.active).toBe(false);
  });

  it('Scenario: Pantallas que bloquean el joystick (deshabilitado: ni crea ni da input)', () => {
    const { stick, down, move } = joystick();
    stick.setEnabled(false);
    down(200, 250);
    move(260, 250);
    const reads = Array.from({ length: 60 }, () => xy(stick.read()));
    expect(reads.every(([x, y]) => x === 0 && y === 0)).toBe(true);
  });

  it('Scenario: Oferta con el joystick activo (se suelta; con el dedo apoyado no vuelve)', () => {
    const { stick, finger, down, move } = joystick();
    down(200, 250);
    move(260, 250);
    near(xy(stick.read()), [1, 0]);

    stick.setEnabled(false);
    const during = Array.from({ length: 60 }, () => xy(stick.read()));
    stick.setEnabled(true);
    const after = xy(stick.read());
    finger.isDown = false;
    stick.read();
    const fresh = new FakePointer(2);
    down(200, 250, fresh);
    move(260, 250, fresh);

    expect(during.every(([x, y]) => x === 0 && y === 0)).toBe(true);
    expect(after).toEqual([0, 0]);
    near(xy(stick.read()), [1, 0]);
  });

  it('Scenario: Reanudar con el dedo apoyado (30 lecturas a 0 tras volver a habilitar)', () => {
    const { stick, down, move } = joystick();
    down(200, 250);
    move(260, 250);
    stick.read();
    stick.setEnabled(false);
    stick.setEnabled(true);
    const reads = Array.from({ length: 30 }, () => xy(stick.read()));
    expect(reads.every(([x, y]) => x === 0 && y === 0)).toBe(true);
  });

  it('Scenario: Joystick activo al girar (la retención lo deshabilita: 0 hasta un toque nuevo)', () => {
    const { stick, down, move } = joystick();
    down(200, 250);
    move(260, 250);
    stick.read();
    stick.setEnabled(false); // aviso de orientación visible
    stick.relayout({ width: 960, height: 1440, uiScale: 1 }, 390 / 960);
    stick.relayout(FRAME, S);
    stick.setEnabled(true); // vuelta a horizontal
    const reads = Array.from({ length: 30 }, () => xy(stick.read()));
    expect(reads.every(([x, y]) => x === 0 && y === 0)).toBe(true);
  });

  it('Scenario: Segundo dedo en la zona de arrastre (ni otro joystick ni otro centro)', () => {
    const { stick, finger, down, move } = joystick();
    down(200, 250);
    move(230, 250);
    const second = new FakePointer(2);
    down(100, 100, second);
    move(40, 100, second);

    near(xy(stick.read()), [0.375, 0]);
    expect(stick.state.origin.x * S).toBeCloseTo(200, 6);
    finger.isDown = false;
    expect(xy(stick.read())).toEqual([0, 0]);
  });

  it('destroy quita la escucha del pointerdown', () => {
    const { input, stick } = joystick();
    stick.destroy();
    expect(input.listeners).toEqual([]);
  });
});

describe('preferKeyboard (0033)', () => {
  const fixed = (input: { value: PlayerInput }): MoveSource => ({ read: () => input.value });

  it('Scenario: Teclado y joystick a la vez (flecha derecha gana; al soltarla, el joystick)', () => {
    const keys = { value: PlayerInput.of(1, 0) };
    const stick = { value: PlayerInput.of(0, 1) };
    const source = preferKeyboard(fixed(keys), fixed(stick));

    const first = source.read();
    keys.value = PlayerInput.NONE;
    const second = source.read();

    expect(xy(first)).toEqual([1, 0]);
    expect(xy(second)).toEqual([0, 1]);
  });

  it('Scenario: Teclado solo (W y D sin dedo: lo mismo que sin modo móvil)', () => {
    const keys = { value: PlayerInput.of(1, -1) };
    const source = preferKeyboard(fixed(keys), fixed({ value: PlayerInput.NONE }));
    expect(source.read()).toEqual(keys.value);
  });

  it('lee las dos fuentes aunque mande el teclado', () => {
    let reads = 0;
    const touch: MoveSource = {
      read: () => {
        reads += 1;
        return PlayerInput.NONE;
      },
    };
    preferKeyboard(fixed({ value: PlayerInput.of(1, 0) }), touch).read();
    expect(reads).toBe(1);
  });
});
