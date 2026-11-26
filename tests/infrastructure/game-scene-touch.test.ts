import { describe, expect, it, vi } from 'vitest';
import type { StartedRun } from '../../src/application/StartRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { TOUCH_LABELS, TouchBar } from '../../src/infrastructure/dom/TouchBar';
import { ManualStepper } from '../../src/infrastructure/e2e/ManualStepper';
import { requestStep } from '../../src/infrastructure/e2e/stepRequest';
import { GameScene, type GameSceneDeps } from '../../src/infrastructure/phaser/GameScene';
import { JoystickView } from '../../src/infrastructure/phaser/touch/JoystickView';
import { preferKeyboard } from '../../src/infrastructure/phaser/touch/preferKeyboard';
import { TouchJoystick } from '../../src/infrastructure/phaser/touch/TouchJoystick';
import { TICK_MS } from '../support/builders';
import { fakeDom, type FakeElement } from '../support/fakeDom';
import { FakeText } from '../support/feedback';
import { startDefault } from '../support/frameDriver';
import { FakeInput, FakePointer } from '../support/touch';

// Spec touch-controls y simulation-loop (0033): `GameScene.update` con las dependencias del modo
// móvil (barra, joystick y retención) y widgets falsos, sin motor (patrón game-scene-manual.test).
vi.mock('phaser', () => ({
  default: {
    Scene: class {
      constructor(readonly key: unknown) {}
    },
  },
}));

const FRAME_60HZ = 16.667;
const S = 390 / 640;
const FRAME = { width: 1385, height: 640, uiScale: 1.4066 };
const JOYSTICK = { radiusPx: 60, deadZone: 0.2, zoneFraction: 0.5, hint: 'Arrastra aquí' };
const css = (v: number): number => v / S;

class FakeHint extends FakeText {
  setFontSize(): this {
    return this;
  }
}
const canvas = { clear: () => undefined, fillStyle: () => undefined, fillCircle: () => undefined };

function harness(started: StartedRun, manual?: ManualStepper) {
  const { doc, root, fake } = fakeDom();
  const bar = new TouchBar(doc, root);
  const pauseShown: boolean[] = [];
  /** Reloj de render por frame: la duración, en negativo si el mundo estaba detenido. */
  const advanced: number[] = [];
  const screen = { portrait: false };
  const keys = { value: PlayerInput.NONE };
  const offer = { clicked: -1 };
  const input = new FakeInput();
  const stick = new TouchJoystick(input, JOYSTICK);
  stick.relayout(FRAME, S);
  const view = new JoystickView(canvas, new FakeHint(), JOYSTICK.hint, JOYSTICK.radiusPx);
  view.relayout(FRAME, S);
  const deps = {
    progress: { sync: () => undefined, leave: () => undefined },
    pause: { takeAction: () => null, setVisible: (v: boolean) => pauseShown.push(v) },
    shop: { takeAction: () => null, setVisible: () => undefined, sync: () => undefined },
    build: { takeAction: () => null, setVisible: () => undefined, sync: () => undefined },
    touch: { joystick: JOYSTICK, bar },
    hold: () => screen.portrait,
    manual,
  } as unknown as GameSceneDeps;
  const scene = new GameScene(deps);
  const none = { read: () => false };
  Object.assign(scene, {
    started,
    w: {
      layers: {
        advance: (ms: number, halted: boolean) => advanced.push(halted ? -ms : ms),
        render: () => undefined,
        clear: () => undefined,
        counts: {},
      },
      hud: { sync: () => undefined },
      offer: {
        sync: () => undefined,
        takeClicked: () => {
          const i = offer.clicked;
          offer.clicked = -1;
          return i;
        },
      },
      results: { sync: () => undefined, view: null },
      move: preferKeyboard({ read: () => keys.value }, stick),
      choice: { read: () => -1 },
      restart: none,
      esc: none,
      touch: { stick, view },
    },
  });
  const nav = fake.children[0] as FakeElement;
  const tap = (label: string) => {
    nav.findAll((e) => e.getAttribute('aria-label') === label)[0]?.click();
  };
  const finger = new FakePointer(1);
  return {
    scene,
    started,
    advanced,
    pauseShown,
    screen,
    offer,
    view,
    stick,
    nav,
    /** Apoya un dedo en (x, y) px CSS y lo arrastra a (tx, ty). */
    drag: (x: number, y: number, tx: number, ty: number, p = finger) => {
      input.down(p, css(x), css(y));
      p.moveTo(css(tx), css(ty));
    },
    finger,
    tapPause: () => {
      tap(TOUCH_LABELS.pause);
    },
    frames: (n: number, ms = FRAME_60HZ) => {
      for (let i = 0; i < n; i++) {
        scene.update(0, ms);
        manual?.afterRender();
      }
    },
    snap: () => started.tickRun.snapshot(),
  };
}

/** Partida por defecto (semilla 42) en el tick n, sin input. */
function at(n: number): StartedRun {
  const started = startDefault(42);
  for (let i = 0; i < n; i++) started.tickRun.execute(TICK_MS, PlayerInput.NONE);
  return started;
}

/** Partida por defecto con la primera oferta abierta. */
function choosing(): StartedRun {
  const started = startDefault(42);
  while (started.tickRun.status === 'running') {
    started.tickRun.execute(TICK_MS, PlayerInput.NONE);
  }
  if (started.tickRun.status !== 'choosing') throw new Error('se esperaba una oferta');
  return started;
}

const hidden = (nav: FakeElement, label: string) =>
  nav.findAll((e) => e.getAttribute('aria-label') === label)[0]?.hidden;

describe('GameScene con controles táctiles (0033)', () => {
  it('Scenario: Pausar y reanudar con ⏸ (300 frames en el tick 500; otro ⏸ y 1 frame: 501)', () => {
    const h = harness(at(500));
    h.frames(1, 0);
    expect([hidden(h.nav, TOUCH_LABELS.pause), hidden(h.nav, TOUCH_LABELS.restart)]).toEqual([
      false,
      true,
    ]);

    h.tapPause();
    h.frames(300);
    const paused = h.pauseShown.slice(-300);
    const tickDuring = h.snap().tick;
    h.tapPause();
    h.frames(1);

    expect(paused.every(Boolean)).toBe(true);
    expect(tickDuring).toBe(500);
    expect([h.pauseShown.at(-1), h.snap().tick]).toEqual([false, 501]);
  });

  it('Scenario: ⏸ eligiendo mejora (la oferta sigue, sin pausa y el mismo tick)', () => {
    const h = harness(choosing());
    const n = h.snap().tick;

    h.tapPause();
    h.frames(1);

    expect([h.snap().status, h.snap().tick, h.pauseShown.some(Boolean)]).toEqual([
      'choosing',
      n,
      false,
    ]);
  });

  it('Scenario: Pausar sin soltar el joystick (⏸ con otro dedo: en pausa y joystick suelto)', () => {
    const h = harness(at(100));
    h.frames(1);
    h.drag(200, 250, 260, 250);
    h.frames(1);
    expect(h.stick.state.active).toBe(true);

    h.tapPause();
    h.frames(1);

    expect([h.pauseShown.at(-1), h.stick.state.active]).toEqual([true, false]);
  });

  it('Scenario: Girar en mitad de la partida (0 ticks, sin pausa; al volver, 1 frame = 1 tick)', () => {
    const h = harness(at(500));
    const before = h.snap();

    h.advanced.length = 0;
    h.screen.portrait = true;
    h.frames(300);
    h.frames(1, 5000);
    const during = h.snap();
    const clock = [...h.advanced];
    h.screen.portrait = false;
    h.frames(1);

    expect(during).toStrictEqual(before);
    expect(h.pauseShown.some(Boolean)).toBe(false);
    expect(h.snap().tick).toBe(501);
    expect(clock).toHaveLength(301);
    expect(clock.every((ms) => ms < 0)).toBe(true);
  });

  it('Scenario: Girar con la oferta, la tienda o la obra abiertas (oferta: misma; carta 1 → 1)', () => {
    const h = harness(choosing());
    const before = h.snap();

    h.screen.portrait = true;
    h.frames(60);
    h.screen.portrait = false;
    h.frames(1);
    const after = h.snap();
    h.offer.clicked = 1;
    h.frames(1);

    expect([after.status, after.tick, after.offer]).toEqual([
      'choosing',
      before.tick,
      before.offer,
    ]);
    expect(h.pauseShown.some(Boolean)).toBe(false);
    const chosen = before.offer[1];
    const level = h.snap().upgrades.find((u) => u.id === chosen?.id)?.level;
    expect(level).toBe((chosen?.level ?? -1) + 1);
  });

  it('Scenario: Joystick activo al girar (30 frames de input 0 tras volver con el dedo apoyado)', () => {
    const h = harness(at(100));
    h.frames(1);
    h.drag(200, 250, 260, 250);
    h.frames(1);

    h.screen.portrait = true;
    h.frames(1);
    h.screen.portrait = false;
    const x0 = h.snap().player.x;
    h.frames(30);

    expect(h.stick.state.active).toBe(false);
    expect(h.snap().player.x).toBe(x0);
  });

  it('Scenario: Toque fuera de la zona de arrastre (60 frames: el jugador sigue en P)', () => {
    const h = harness(at(100));
    const p = h.snap().player;

    h.drag(600, 200, 300, 200);
    h.frames(60);

    expect([h.snap().player.x, h.snap().player.y]).toEqual([p.x, p.y]);
  });

  it('Scenario: Pantallas que bloquean el joystick (pausa: el arrastre no da input al reanudar)', () => {
    const h = harness(at(100));
    h.frames(1);
    h.tapPause();
    h.frames(1);
    h.drag(200, 250, 260, 250);
    h.frames(60);
    h.tapPause();
    const x0 = h.snap().player.x;
    h.frames(30);

    expect(h.stick.state.active).toBe(false);
    expect(h.snap().player.x).toBe(x0);
  });

  it('Scenario: Oferta con el joystick activo (60 ticks a 0 tras elegir; un dedo nuevo vuelve)', () => {
    const started = startDefault(42);
    while (started.tickRun.status === 'running' && started.tickRun.snapshot().tick < 1400) {
      started.tickRun.execute(TICK_MS, PlayerInput.NONE);
    }
    const h = harness(started);
    h.frames(1);
    h.drag(200, 250, 200, 250 + 60);
    while (h.snap().status === 'running') h.frames(1);
    expect(h.snap().status).toBe('choosing');

    h.offer.clicked = 0;
    h.frames(1);
    const y0 = h.snap().player.y;
    h.frames(60);
    const still = h.snap().player.y;
    h.finger.isDown = false;
    h.frames(1);
    h.drag(200, 250, 200, 250 - 60, new FakePointer(2));
    h.frames(10);

    expect(still).toBe(y0);
    expect(h.snap().player.y).toBeLessThan(still);
  });

  it('Scenario: Indicación al empezar (1 frame: visible); el primer arrastre no nulo la quita', () => {
    const h = harness(at(0));
    h.frames(1);
    const shown = h.view.hintVisible;
    h.drag(200, 250, 260, 250);
    h.frames(1);

    expect([shown, h.view.hintVisible]).toEqual([true, false]);
  });

  it('Scenario: Step con el aviso de orientación (0 ticks, reloj quieto y sin avisos; luego 60)', async () => {
    const manual = new ManualStepper();
    const h = harness(at(10), manual);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    h.screen.portrait = true;
    const before = h.snap();
    h.advanced.length = 0;

    const step = (n: number) => {
      let r: number | undefined;
      void requestStep(n, manual, (m) => {
        console.warn(m);
      }).then((v) => (r = v));
      return async () => {
        for (let i = 0; i < 10 && r === undefined; i++) {
          h.frames(1);
          await Promise.resolve();
        }
        return r;
      };
    };
    const held = await step(60)();
    const clock = [...h.advanced];
    h.screen.portrait = false;
    const free = await step(60)();

    expect([held, free]).toEqual([0, 60]);
    expect(clock.every((ms) => ms === 0 || Object.is(ms, -0))).toBe(true);
    expect(h.snap().tick).toBe(before.tick + 60);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
