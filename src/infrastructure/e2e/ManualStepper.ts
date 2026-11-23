import { PlayerInput } from '../../domain/player/PlayerInput';
import type { StepRequester } from './stepRequest';

/** Plan de un frame en modo manual: ticks a ejecutar e input de la petición. */
export interface StepPlan {
  readonly ticks: number;
  readonly input: PlayerInput;
}

/** Una llamada a `step(n)` en curso o en espera. */
interface StepRequestState {
  remaining: number;
  done: number;
  servedThisFrame: boolean;
  finished: boolean;
  readonly resolve: (ticks: number) => void;
}

const IDLE: StepPlan = { ticks: 0, input: PlayerInput.NONE };

/**
 * Cola de peticiones `step(n)` del modo manual (spec simulation-loop, "Avance manual con step").
 * Solo la cabeza está activa; las llamadas simultáneas se atienden una tras otra, en orden.
 * `GameScene` pide el plan y declara lo servido en cada `update`; la composición llama a
 * `afterRender` en `POST_RENDER`, con el frame ya pintado, y ahí se resuelven las promesas.
 * Sin import del motor: se prueba en Node (patrón de `PauseGate`).
 */
export class ManualStepper implements StepRequester {
  private readonly queue: StepRequestState[] = [];

  /** Encola n ticks (ya validados por `requestStep`) y resuelve con los ejecutados. */
  request(ticks: number): Promise<number> {
    return new Promise((resolve) => {
      this.queue.push({
        remaining: ticks,
        done: 0,
        servedThisFrame: false,
        finished: false,
        resolve,
      });
    });
  }

  /** Ticks de este frame (0 sin petición) e input de la petición. Una vez por `update`. */
  plan(readInput: () => PlayerInput): StepPlan {
    const head = this.queue[0];
    if (head === undefined) return IDLE;
    head.servedThisFrame = true;
    return { ticks: head.remaining, input: readInput() };
  }

  /** Ticks ejecutados de verdad y si la petición puede seguir en el siguiente frame. */
  served(executed: number, canContinue: boolean): void {
    const head = this.queue[0];
    if (head === undefined) return;
    head.done += executed;
    head.remaining -= executed;
    if (head.remaining === 0 || !canContinue) head.finished = true;
  }

  /**
   * Final de cada frame del juego, haya o no partida. Resuelve la cabeza si ha terminado o si no
   * se ha atendido en este frame (no hay `GameScene` activa: menú, arranque).
   */
  afterRender(): void {
    const head = this.queue[0];
    if (head === undefined) return;
    if (head.finished || !head.servedThisFrame) {
      this.queue.shift();
      head.resolve(head.done);
      return;
    }
    head.servedThisFrame = false;
  }
}
