import { describe, expect, expectTypeOf, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import {
  MAX_STEP_TICKS_PER_FRAME,
  ManualStepper,
  type StepPlan,
} from '../../src/infrastructure/e2e/ManualStepper';
import { TickRun } from '../../src/application/TickRun';
import { PauseGate } from '../../src/infrastructure/phaser/PauseGate';
import { aBehaviorConfig, aProbeType } from '../support/runs';
import { startAtDoor } from '../support/shop';

/**
 * Partida falsa que hace de `GameScene` en modo manual: ejecuta los ticks planificados hasta
 * `stopAt` (oferta o fin), donde deja de estar en curso.
 */
class FakeScene {
  tick = 0;
  constructor(private readonly stopAt = Number.POSITIVE_INFINITY) {}

  /** Un `update` de la escena: plan → ticks → served (design §3.4). */
  update(stepper: ManualStepper, readInput: () => PlayerInput = () => PlayerInput.NONE): number {
    const plan = stepper.plan(readInput);
    const executed = Math.max(0, Math.min(plan.ticks, this.stopAt - this.tick));
    this.tick += executed;
    stepper.served(executed, this.tick < this.stopAt);
    return plan.ticks;
  }
}

/** Promesa con su estado observable (sin esperar a que resuelva). */
function track(p: Promise<number>): { value: number | undefined; done: () => boolean } {
  const state: { value: number | undefined; settled: boolean } = {
    value: undefined,
    settled: false,
  };
  void p.then((v) => {
    state.value = v;
    state.settled = true;
  });
  return {
    get value() {
      return state.value;
    },
    done: () => state.settled,
  };
}

/** Vacía la cola de microtareas para que las promesas resueltas notifiquen. */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('ManualStepper · cola FIFO y resolución en afterRender (design 0014 §3.2)', () => {
  it('request no resuelve hasta afterRender', async () => {
    const stepper = new ManualStepper();
    const scene = new FakeScene();
    const p = track(stepper.request(60));

    scene.update(stepper);
    await flush();
    const beforeRender = p.done();
    stepper.afterRender();
    await flush();

    expect([beforeRender, p.done(), p.value, scene.tick]).toEqual([false, true, 60, 60]);
  });

  it('Scenario: Step en el menú (un frame sin plan resuelve 0)', async () => {
    const stepper = new ManualStepper();
    const p = stepper.request(60);

    stepper.afterRender();

    await expect(p).resolves.toBe(0);
  });

  it('Scenario: Llamadas simultáneas (dos request(30), en orden, en frames seguidos)', async () => {
    const stepper = new ManualStepper();
    const scene = new FakeScene();
    const first = track(stepper.request(30));
    const second = track(stepper.request(30));

    scene.update(stepper);
    stepper.afterRender();
    await flush();
    const afterFirstFrame = [first.value, second.done(), scene.tick];
    scene.update(stepper);
    stepper.afterRender();
    await flush();

    expect(afterFirstFrame).toEqual([30, false, 30]);
    expect([second.value, scene.tick]).toEqual([30, 60]);
  });

  it('Scenario: Llamada simultánea que encuentra la oferta (oferta en 20: [20, 0])', async () => {
    const stepper = new ManualStepper();
    const scene = new FakeScene(20);
    const first = stepper.request(30);
    const second = stepper.request(30);

    scene.update(stepper);
    stepper.afterRender();
    scene.update(stepper);
    stepper.afterRender();

    await expect(Promise.all([first, second])).resolves.toEqual([20, 0]);
    expect(scene.tick).toBe(20);
  });

  it('sin peticiones, plan devuelve 0 ticks', () => {
    const stepper = new ManualStepper();

    const plan = stepper.plan(() => PlayerInput.of(1, 0));
    stepper.served(0, true);
    stepper.afterRender();

    expect(plan.ticks).toBe(0);
  });
});

/** Frames (update + pintado) hasta que la promesa resuelve; devuelve los ticks de cada uno. */
async function framesUntil(
  stepper: ManualStepper,
  scene: FakeScene,
  p: ReturnType<typeof track>,
  readInput?: () => PlayerInput,
): Promise<number[]> {
  const perFrame: number[] = [];
  while (!p.done()) {
    const before = scene.tick;
    scene.update(stepper, readInput);
    stepper.afterRender();
    perFrame.push(scene.tick - before);
    await flush();
  }
  return perFrame;
}

describe('ManualStepper · varios frames, input congelado y parada (design 0014 §3.2)', () => {
  it('el tope por frame es 600 ticks', () => {
    expect(MAX_STEP_TICKS_PER_FRAME).toBe(600);
  });

  it('request(1500) se reparte en 600 + 600 + 300 y resuelve tras el tercer frame', async () => {
    const stepper = new ManualStepper();
    const scene = new FakeScene();
    const p = track(stepper.request(1500));

    const perFrame = await framesUntil(stepper, scene, p);

    expect(perFrame).toEqual([600, 600, 300]);
    expect([p.value, scene.tick]).toEqual([1500, 1500]);
  });

  it('Scenario: Input leído al empezar el step (readInput una vez por petición)', async () => {
    const stepper = new ManualStepper();
    const scene = new FakeScene();
    const inputs = [PlayerInput.of(1, 0), PlayerInput.NONE, PlayerInput.of(-1, 0)];
    let reads = 0;
    const seen: PlayerInput[] = [];
    const readInput = () => inputs[reads++] ?? PlayerInput.NONE;
    const spyPlan = stepper.plan.bind(stepper);
    stepper.plan = (read) => {
      const plan = spyPlan(read);
      if (plan.ticks > 0) seen.push(plan.input);
      return plan;
    };

    await framesUntil(stepper, scene, track(stepper.request(1500)), readInput);
    await framesUntil(stepper, scene, track(stepper.request(10)), readInput);

    expect(reads).toBe(2);
    expect(seen).toEqual([inputs[0], inputs[0], inputs[0], inputs[1]]);
  });

  it('canContinue = false a mitad (pausa) resuelve con los ticks hechos', async () => {
    const stepper = new ManualStepper();
    const p = track(stepper.request(1500));

    stepper.plan(() => PlayerInput.NONE);
    stepper.served(600, true);
    stepper.afterRender();
    stepper.plan(() => PlayerInput.NONE);
    stepper.served(0, false);
    stepper.afterRender();
    await flush();

    expect(p.value).toBe(600);
  });

  it('executed < planificado termina la petición', async () => {
    const stepper = new ManualStepper();
    const p = track(stepper.request(1500));

    stepper.plan(() => PlayerInput.NONE);
    stepper.served(450, true);
    stepper.afterRender();
    await flush();

    expect(p.value).toBe(450);
  });

  it('Scenario: n muy grande (MAX_SAFE_INTEGER termina cuando served para)', async () => {
    const stepper = new ManualStepper();
    const scene = new FakeScene(36_000);
    const p = track(stepper.request(Number.MAX_SAFE_INTEGER));

    const perFrame = await framesUntil(stepper, scene, p);

    expect([p.value, scene.tick, perFrame.length]).toEqual([36_000, 36_000, 60]);
  });

  it('Scenario: Independiente de la duración de los frames (la API no la admite)', () => {
    expectTypeOf<Parameters<ManualStepper['plan']>>().toEqualTypeOf<
      [readInput: () => PlayerInput]
    >();
    expectTypeOf<ReturnType<ManualStepper['plan']>>().toEqualTypeOf<StepPlan>();
    expectTypeOf<Parameters<ManualStepper['served']>>().toEqualTypeOf<
      [executed: number, canContinue: boolean]
    >();
    expectTypeOf<Parameters<ManualStepper['afterRender']>>().toEqualTypeOf<[]>();
    const stepper = new ManualStepper();
    expect([stepper.plan.length, stepper.served.length, stepper.afterRender.length]).toEqual([
      1, 2, 0,
    ]);
  });
});

// Spec simulation-loop (0024), "Tienda a mitad de step": la escena en modo manual con una partida
// real (`PauseGate.manualFrame` + `TickRun`) que abre la tienda en el tick 7.
describe('ManualStepper con la tienda (0024)', () => {
  it('Scenario: Tienda a mitad de step (step(20) = 7 y en tienda; step(10) = 0; tras salir, 10)', async () => {
    const run = startAtDoor(aBehaviorConfig([aProbeType()]), {
      player: { x: 1039 + 7 * 3.5, y: 1000 },
    });
    const tickRun = new TickRun(run);
    const gate = new PauseGate();
    const stepper = new ManualStepper();
    const frame = () => {
      const plan = stepper.plan(() => PlayerInput.of(-1, 0));
      const r = gate.manualFrame(tickRun, plan.ticks, plan.input);
      stepper.served(r.ticks, tickRun.status === 'running');
      stepper.afterRender();
    };
    const step = async (n: number) => {
      const p = stepper.request(n);
      for (let i = 0; i < 5; i++) frame();
      return p;
    };

    const first = await step(20);
    const atShop = run.snapshot();
    const blocked = await step(10);
    run.leaveShop();
    const after = await step(10);

    expect([first, atShop.tick, atShop.status]).toEqual([7, 7, 'shopping']);
    expect([blocked, after, run.snapshot().tick]).toEqual([0, 10, 17]);
  });
});
