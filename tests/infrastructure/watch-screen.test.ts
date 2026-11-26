import { describe, expect, it } from 'vitest';
import { screenFrame, type ScreenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
import { mobileFrameRule } from '../../src/infrastructure/phaser/ui/mobileFrame';
import {
  RESIZE_EVENT,
  SHUTDOWN_EVENT,
  watchScreen,
  type ResizeListener,
  type ScaleLike,
  type SceneEventsLike,
} from '../../src/infrastructure/phaser/ui/watchScreen';

/** ScaleManager falso (global del juego): guarda escuchas y emite RESIZE con el gameSize nuevo. */
class FakeScale implements ScaleLike {
  gameSize = { width: 1280, height: 720 };
  displaySize = { width: 1280, height: 720 };
  listeners: ResizeListener[] = [];
  on(event: string, fn: ResizeListener): this {
    if (event === RESIZE_EVENT) this.listeners.push(fn);
    return this;
  }
  off(event: string, fn: ResizeListener): this {
    if (event === RESIZE_EVENT) this.listeners = this.listeners.filter((l) => l !== fn);
    return this;
  }
  /** RESIZE con el tamaño lógico y el mostrado (por defecto iguales, como en RESIZE). */
  resize(width: number, height: number, display = { width, height }): void {
    this.gameSize = { width, height };
    this.displaySize = display;
    for (const l of [...this.listeners]) l(this.gameSize);
  }
}

/** Eventos de una escena falsa: SHUTDOWN al salir (Volver al menú). */
class FakeSceneEvents implements SceneEventsLike {
  private shutdown: (() => void)[] = [];
  once(event: string, fn: () => void): this {
    if (event === SHUTDOWN_EVENT) this.shutdown.push(fn);
    return this;
  }
  emitShutdown(): void {
    const list = this.shutdown;
    this.shutdown = [];
    for (const l of list) l();
  }
}

// Spec world-camera (0017), "Redimensionado de la ventana" (design D6).
describe('watchScreen (0017)', () => {
  it('llama al entrar con el frame del gameSize actual', () => {
    const calls: ScreenFrame[] = [];
    watchScreen(new FakeScale(), new FakeSceneEvents(), (f) => calls.push(f));

    expect(calls).toEqual([screenFrame(1280, 720)]);
  });

  it('una llamada por RESIZE con el gameSize nuevo', () => {
    const scale = new FakeScale();
    const calls: ScreenFrame[] = [];
    watchScreen(scale, new FakeSceneEvents(), (f) => calls.push(f));

    scale.resize(1000, 600);
    scale.resize(2560, 1440);

    expect(calls.slice(1)).toEqual([screenFrame(1000, 600), screenFrame(2560, 1440)]);
  });

  it('ninguna llamada tras SHUTDOWN', () => {
    const scale = new FakeScale();
    const events = new FakeSceneEvents();
    const calls: ScreenFrame[] = [];
    watchScreen(scale, events, (f) => calls.push(f));

    events.emitShutdown();
    scale.resize(1000, 600);

    expect(calls).toHaveLength(1);
    expect(scale.listeners).toEqual([]);
  });

  it('Scenario: Muchos cambios seguidos (tras dos entradas en la escena, una sola escucha)', () => {
    const scale = new FakeScale();
    const events = new FakeSceneEvents();
    const calls: number[] = [];
    watchScreen(scale, events, () => calls.push(1));
    events.emitShutdown();
    watchScreen(scale, events, () => calls.push(2));

    scale.resize(1000, 600);

    expect(scale.listeners).toHaveLength(1);
    expect(calls).toEqual([1, 2, 2]);
  });
});

// Spec mobile-display (0033): la regla del frame y los px CSS por unidad (design §3).
describe('watchScreen con regla de frame (0033)', () => {
  it('en escritorio, 1 px CSS por unidad y el frame de siempre', () => {
    const calls: [ScreenFrame, number][] = [];
    watchScreen(new FakeScale(), new FakeSceneEvents(), (f, s) => calls.push([f, s]));

    expect(calls).toEqual([[screenFrame(1280, 720), 1]]);
  });

  it('Scenario: Factor al redimensionar (844 × 390 → 1.024 × 768: k 1,4066 → 1)', () => {
    const scale = new FakeScale();
    scale.resize(1385.03, 640, { width: 844, height: 390 });
    const calls: [ScreenFrame, number][] = [];
    watchScreen(scale, new FakeSceneEvents(), (f, s) => calls.push([f, s]), mobileFrameRule(12));

    scale.resize(960, 720, { width: 1024, height: 768 });

    expect(calls[0]?.[0].uiScale).toBeCloseTo(1.4066, 3);
    expect(calls[0]?.[1]).toBeCloseTo(390 / 640, 9);
    expect(calls[1]?.[0]).toEqual({ width: 960, height: 720, uiScale: 1 });
  });

  it('Scenario: Redimensionado en móvil (915 × 412: frame 1.421 × 640 desde el RESIZE)', () => {
    const scale = new FakeScale();
    scale.resize(1385.03, 640, { width: 844, height: 390 });
    const calls: ScreenFrame[] = [];
    watchScreen(scale, new FakeSceneEvents(), (f) => calls.push(f), mobileFrameRule(12));

    scale.resize(1421.36, 640, { width: 915, height: 412 });

    expect([calls[1]?.width, calls[1]?.height]).toEqual([1421, 640]);
  });

  it('Scenario: Ventana a cero en móvil (sin errores, k = 1, y vuelta a 844 × 390)', () => {
    const scale = new FakeScale();
    const calls: [ScreenFrame, number][] = [];
    watchScreen(scale, new FakeSceneEvents(), (f, s) => calls.push([f, s]), mobileFrameRule(12));

    scale.resize(0, 0, { width: 0, height: 0 });
    scale.resize(1385.03, 640, { width: 844, height: 390 });

    expect(calls[1]).toEqual([{ width: 1, height: 1, uiScale: 1 }, 0]);
    expect([calls[2]?.[0].width, calls[2]?.[0].height]).toEqual([1385, 640]);
  });
});
