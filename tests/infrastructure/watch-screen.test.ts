import { describe, expect, it } from 'vitest';
import { screenFrame, type ScreenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
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
  listeners: ResizeListener[] = [];
  on(event: string, fn: ResizeListener): this {
    if (event === RESIZE_EVENT) this.listeners.push(fn);
    return this;
  }
  off(event: string, fn: ResizeListener): this {
    if (event === RESIZE_EVENT) this.listeners = this.listeners.filter((l) => l !== fn);
    return this;
  }
  resize(width: number, height: number): void {
    this.gameSize = { width, height };
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
