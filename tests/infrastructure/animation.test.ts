import { describe, expect, it } from 'vitest';
import {
  AnimClock,
  Motion,
  animDone,
  frameAt,
} from '../../src/infrastructure/phaser/art/animation';

// Spec sprite-rendering: "Animación por estado" y "Orientación" (change 0012, design "Comportamiento").
const FRAME_MS = 16.667;
const WALK = { frames: [6, 7, 8, 9], fps: 10, loop: true };
const DEATH = { frames: [1, 2, 3, 4, 5, 6], fps: 15, loop: false };

describe('AnimClock, frameAt y animDone', () => {
  it('Scenario: Avance de la animación (⌊k·16,667/100⌋ mod 4, ±1 frame en cada cambio)', () => {
    const clock = new AnimClock();
    const start = clock.ms;
    for (let k = 0; k < 30; k++) {
      const shown = frameAt(WALK, clock.ms - start);
      const expected = WALK.frames[Math.floor((k * FRAME_MS) / 100) % 4];
      const before = WALK.frames[Math.floor(((k - 1) * FRAME_MS) / 100) % 4];
      const after = WALK.frames[Math.floor(((k + 1) * FRAME_MS) / 100) % 4];
      expect([expected, before, after]).toContain(shown);
      expect(shown).toBe(expected);
      clock.advance(FRAME_MS, false);
    }
  });

  it('Scenario: Mundo detenido (el reloj congelado no avanza)', () => {
    const clock = new AnimClock();
    clock.advance(250, false);
    const frozen = frameAt(WALK, clock.ms);
    for (let i = 0; i < 300; i++) clock.advance(FRAME_MS, true);
    expect(clock.ms).toBe(250);
    expect(frameAt(WALK, clock.ms)).toBe(frozen);
  });

  it('sin bucle se queda en el último frame y termina a los n·1000/fps ms', () => {
    expect(frameAt(DEATH, 0)).toBe(1);
    expect(frameAt(DEATH, 399)).toBe(6);
    expect(frameAt(DEATH, 5000)).toBe(6);
    expect(animDone(DEATH, 399)).toBe(false);
    expect(animDone(DEATH, 400)).toBe(true);
  });

  it('en bucle vuelve al primer frame', () => {
    expect(frameAt(WALK, 400)).toBe(6);
    expect(frameAt(WALK, 399)).toBe(9);
  });

  it('reset vuelve a 0', () => {
    const clock = new AnimClock();
    clock.advance(100, false);
    clock.reset();
    expect(clock.ms).toBe(0);
  });
});

describe('Motion (estado y orientación por Δ entre ticks distintos)', () => {
  it('primer frame: idle y sin voltear', () => {
    const m = new Motion();
    m.update(100, 100, 0);
    expect([m.moving, m.flipX('right')]).toEqual([false, false]);
  });

  it('Scenario: Umbral de movimiento (0,0005 px ⇒ idle)', () => {
    const m = new Motion();
    m.update(100, 100, 1);
    m.update(101, 100, 2);
    expect(m.moving).toBe(true);
    m.update(101.0005, 100, 3);
    expect(m.moving).toBe(false);
  });

  it('Scenario: Jugador que gira (izquierda, abajo conserva, derecha)', () => {
    const m = new Motion();
    let x = 480;
    let y = 270;
    let tick = 0;
    m.update(x, y, tick);
    const flips: boolean[] = [];
    const step = (dx: number, dy: number): void => {
      x += dx;
      y += dy;
      tick += 1;
      m.update(x, y, tick);
      flips.push(m.flipX('right'));
    };
    for (let i = 0; i < 10; i++) step(-3, 0);
    for (let i = 0; i < 10; i++) step(0, 3);
    for (let i = 0; i < 10; i++) step(3, 0);
    expect(flips.slice(0, 20).every(Boolean)).toBe(true);
    expect(flips.slice(20).some(Boolean)).toBe(false);
  });

  it('Scenario: Dibujo que mira a la izquierda (Δx −1,5: nunca volteado; +1,5: desde el 2.º)', () => {
    const left = new Motion();
    const right = new Motion();
    const flipsLeft: boolean[] = [];
    const flipsRight: boolean[] = [];
    for (let f = 0; f < 10; f++) {
      left.update(500 - 1.5 * f, 100, f);
      right.update(500 + 1.5 * f, 100, f);
      flipsLeft.push(left.flipX('left'));
      flipsRight.push(right.flipX('left'));
    }
    expect(flipsLeft.some(Boolean)).toBe(false);
    expect(flipsRight).toEqual([false, ...Array<boolean>(9).fill(true)]);
  });

  it('Scenario: Frames sin tick (120 Hz: un frame repite el tick y conserva walk)', () => {
    const m = new Motion();
    const states: boolean[] = [];
    for (let frame = 0; frame < 120; frame++) {
      const tick = Math.floor(frame / 2);
      m.update(480 + 3 * tick, 270, tick);
      if (frame >= 2) states.push(m.moving && !m.flipX('right'));
    }
    expect(states.every(Boolean)).toBe(true);
    const still = new Motion();
    const idle: boolean[] = [];
    for (let frame = 0; frame < 120; frame++) {
      still.update(480, 270, Math.floor(frame / 2));
      idle.push(still.moving);
    }
    expect(idle.some(Boolean)).toBe(false);
  });

  it('reset: idle y sin voltear, sin heredar la posición anterior', () => {
    const m = new Motion();
    m.update(100, 100, 1);
    m.update(90, 100, 2);
    m.reset();
    m.update(800, 100, 3);
    expect([m.moving, m.flipX('right')]).toEqual([false, false]);
  });
});
