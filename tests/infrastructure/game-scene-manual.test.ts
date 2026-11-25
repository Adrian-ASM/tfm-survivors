import { describe, expect, it, vi } from 'vitest';
import type { StartedRun } from '../../src/application/StartRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { ManualStepper } from '../../src/infrastructure/e2e/ManualStepper';
import { GameScene, type GameSceneDeps } from '../../src/infrastructure/phaser/GameScene';
import { startDefault } from '../support/frameDriver';

// Phaser no arranca en Node: la escena solo necesita la clase base para construirse. `update` no
// toca el motor (lee los widgets inyectados abajo), así que se prueba su rama manual de verdad
// con frames de la `delta` que se quiera (spec simulation-loop, "Sin avance por tiempo real").
vi.mock('phaser', () => ({
  default: {
    Scene: class {
      constructor(readonly key: unknown) {}
    },
  },
}));

const FRAME_60HZ = 16.667;
const LONG_FRAME_MS = 5000;

/** Escena con widgets falsos y la partida dada; `advanced` recoge el reloj de render. */
interface SceneHarness {
  readonly scene: GameScene;
  readonly started: StartedRun;
  readonly advanced: number[];
  /** Un frame del motor: `update` con la `delta` dada y, como en la composición, POST_RENDER. */
  frame(deltaMs: number): void;
}

function sceneWith(started: StartedRun, manual: ManualStepper | undefined): SceneHarness {
  const advanced: number[] = [];
  const deps = {
    progress: { sync: () => undefined, leave: () => undefined },
    pause: { takeAction: () => null, setVisible: () => undefined },
    shop: { takeAction: () => null, setVisible: () => undefined, sync: () => undefined },
    manual,
  } as unknown as GameSceneDeps;
  const scene = new GameScene(deps);
  const none = { read: () => false };
  Object.assign(scene, {
    started,
    w: {
      layers: {
        advance: (ms: number) => advanced.push(ms),
        render: () => undefined,
        clear: () => undefined,
        counts: {},
      },
      hud: { sync: () => undefined },
      offer: { sync: () => undefined, takeClicked: () => null },
      results: { sync: () => undefined, view: null },
      move: { read: () => PlayerInput.NONE },
      choice: { read: () => null },
      restart: none,
      esc: none,
    },
  });
  return {
    scene,
    started,
    advanced,
    frame: (deltaMs) => {
      scene.update(0, deltaMs);
      manual?.afterRender();
    },
  };
}

/** `step(n)` con frames de `deltaMs` hasta que resuelve; devuelve los ticks ejecutados. */
async function stepWith(h: SceneHarness, m: ManualStepper, n: number, deltaMs: number) {
  let result: number | undefined;
  void m.request(n).then((v) => {
    result = v;
  });
  for (let i = 0; i < 100 && result === undefined; i += 1) {
    h.frame(deltaMs);
    await Promise.resolve();
  }
  return result;
}

describe('GameScene en modo manual con frames inyectados', () => {
  it('Scenario: Frames largos sin step (600 frames de 16,667 ms y 1 de 5.000 ms)', async () => {
    const manual = new ManualStepper();
    const h = sceneWith(startDefault(42), manual);
    await stepWith(h, manual, 10, FRAME_60HZ);
    const atN = h.started.tickRun.snapshot();
    h.advanced.length = 0;

    for (let i = 0; i < 600; i += 1) h.frame(FRAME_60HZ);
    h.frame(LONG_FRAME_MS);

    expect(h.started.tickRun.snapshot()).toStrictEqual(atN);
    expect(h.advanced.every((ms) => ms === 0)).toBe(true);
    const ticks = await stepWith(h, manual, 1, FRAME_60HZ);
    expect(ticks).toBe(1);
    expect(h.started.tickRun.snapshot().tick).toBe(atN.tick + 1);
  });

  it('control: sin modo manual, el mismo arnés sí avanza con la delta del frame', () => {
    const h = sceneWith(startDefault(42), undefined);

    h.frame(FRAME_60HZ);

    expect(h.started.tickRun.snapshot().tick).toBe(1);
  });

  it('Scenario: Independiente de la duración de los frames (semilla 7, step(30))', async () => {
    const short = new ManualStepper();
    const long = new ManualStepper();
    const a = sceneWith(startDefault(7), short);
    const b = sceneWith(startDefault(7), long);

    const ticksA = await stepWith(a, short, 30, 1);
    const ticksB = await stepWith(b, long, 30, LONG_FRAME_MS);

    expect(ticksA).toBe(30);
    expect(ticksB).toBe(30);
    const snapA = a.started.tickRun.snapshot();
    expect(snapA.status).toBe('running');
    expect(snapA.tick).toBe(30);
    expect(b.started.tickRun.snapshot()).toStrictEqual(snapA);
  });
});
