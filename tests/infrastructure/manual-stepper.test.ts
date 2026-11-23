import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { ManualStepper } from '../../src/infrastructure/e2e/ManualStepper';

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

  it('Scenario: Llamadas simultáneas (dos request(30): en orden, la segunda en el frame siguiente)', async () => {
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
