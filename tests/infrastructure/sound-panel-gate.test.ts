import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from '../../src/application/FixedStepLoop';
import { TickRun } from '../../src/application/TickRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { pressedOnce } from '../../src/infrastructure/dom/TouchBar';
import { PauseGate } from '../../src/infrastructure/phaser/PauseGate';
import {
  SoundPanelGate,
  type FrameKeys,
  type SoundPanelLike,
} from '../../src/infrastructure/phaser/SoundPanelGate';
import { TICK_MS } from '../support/builders';
import { aContactConfig, startRun } from '../support/runs';

// Spec main-menu y touch-controls (0035), el panel Sonido abierto desde la pausa en la escena:
// `SoundPanelGate` antes de `PauseGate`, como en `GameScene.update` (sin motor).

class FakePanel implements SoundPanelLike {
  open = true;
  closes = 0;
  close(): void {
    if (this.open) this.closes += 1;
    this.open = false;
  }
}

class FakeCapture {
  readonly calls: string[] = [];
  enableGlobalCapture(): void {
    this.calls.push('on');
  }
  disableGlobalCapture(): void {
    this.calls.push('off');
  }
}

const CENTER = { x: 480, y: 270 };
const keys = (over: Partial<FrameKeys> = {}): FrameKeys => ({
  esc: false,
  action: null,
  restart: false,
  index: -1,
  ...over,
});

/** Partida en pausa en el tick 500 con el panel abierto, y un frame como el de la escena. */
function pausedAt500() {
  const run = new TickRun(startRun(aContactConfig(), { player: CENTER }), new FixedStepLoop());
  for (let t = 0; t < 500; t++) run.execute(TICK_MS, PlayerInput.NONE);
  const pause = new PauseGate();
  pause.step(true, null, 'running', run);
  const panel = new FakePanel();
  const capture = new FakeCapture();
  const gate = new SoundPanelGate(panel, capture);
  const frame = (k: FrameKeys = keys()) => {
    const f = gate.step(k);
    const route = pause.step(f.esc, f.action, run.status, run);
    const snapshot = pause.frame(run, TICK_MS, PlayerInput.NONE, 1);
    return { f, route, tick: snapshot.tick };
  };
  return { run, pause, panel, capture, frame };
}

describe('SoundPanelGate (spec main-menu 0035)', () => {
  it('Scenario: Esc con el panel Sonido abierto', () => {
    const { pause, panel, frame } = pausedAt500();

    const first = frame(keys({ esc: true }));
    // Esc mantenido: PauseKey solo da la primera pulsación; los 60 frames siguientes no traen Esc.
    let tick = first.tick;
    for (let i = 0; i < 60; i++) tick = frame().tick;
    const stillPaused = pause.paused;
    frame(keys({ esc: true }));

    expect([panel.open, panel.closes, stillPaused, tick]).toEqual([false, 1, true, 500]);
    expect(pause.paused).toBe(false);
  });

  it('Scenario: Abrir desde la pausa (Esc cierra el panel y la pausa sigue en el tick 500)', () => {
    const { pause, frame } = pausedAt500();

    frame(keys({ esc: true }));
    let tick = 0;
    for (let i = 0; i < 60; i++) tick = frame().tick;

    expect([pause.paused, tick]).toEqual([true, 500]);
  });

  it('Scenario: Cerrar con la × desde el menú y desde la pausa (desde la pausa, tick 500)', () => {
    // 0036: la × llama a `close()` del panel (como Esc desde el menú); la escena no ve ningún Esc.
    const { pause, panel, frame } = pausedAt500();

    panel.close();
    let tick = 0;
    for (let i = 0; i < 60; i++) tick = frame().tick;
    const stillPaused = pause.paused;
    frame(keys({ esc: true }));

    expect([panel.open, stillPaused, tick]).toEqual([false, true, 500]);
    expect(pause.paused).toBe(false);
  });

  it('Scenario: Volver al menú bloqueado con el panel Sonido', () => {
    const { pause, panel, frame } = pausedAt500();

    const r = frame(keys({ action: 'menu' }));

    expect([r.route, panel.open, pause.paused, r.tick]).toEqual([null, true, true, 500]);
  });

  it('Scenario: Botones de debajo bloqueados (Reanudar, R y 1 descartados en la escena)', () => {
    const { pause, frame } = pausedAt500();

    const r = frame(keys({ action: 'resume', restart: true, index: 0 }));

    expect(r.f).toEqual(keys());
    expect(pause.paused).toBe(true);
  });

  it('Scenario: ⏸ con el panel Sonido abierto', () => {
    const { pause, panel, frame } = pausedAt500();

    const r = frame(keys({ esc: pressedOnce(false, true) }));

    expect([panel.open, pause.paused, r.tick]).toEqual([false, true, 500]);
  });

  it('captura global del teclado apagada mientras está abierto y encendida al cerrar', () => {
    const { capture, frame } = pausedAt500();

    frame();
    frame();
    frame(keys({ esc: true }));
    frame();

    expect(capture.calls).toEqual(['off', 'on']);
  });

  it('sin panel (escritorio de antes), deja pasar todas las entradas', () => {
    const gate = new SoundPanelGate(undefined, new FakeCapture());
    const k = keys({ esc: true, action: 'resume', restart: true, index: 2 });

    expect(gate.step(k)).toBe(k);
  });
});
