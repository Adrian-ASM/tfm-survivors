import { PlayerInput } from '../../domain/player/PlayerInput';
import type { StepRequester } from './stepRequest';

/**
 * Ticks máximos por frame del motor en modo manual (configuración de pruebas, no contenido): un
 * `step` grande se reparte en frames para no bloquear la página. El reparto depende del número de
 * ticks, nunca de la duración del frame.
 */
export const MAX_STEP_TICKS_PER_FRAME = 600;

/** Plan de un frame en modo manual: ticks a ejecutar e input congelado de la petición. */
export interface StepPlan {
  readonly ticks: number;
  readonly input: PlayerInput;
}

/** Una llamada a `step(n)` en curso o en espera. */
interface StepRequestState {
  remaining: number;
  done: number;
  /** Input leído en el primer frame de la petición; vale para todos sus ticks. */
  input: PlayerInput | undefined;
  /** Ticks planificados en el frame actual (0 si no se ha atendido en este frame). */
  planned: number;
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
 * Ninguna operación recibe la duración del frame: sin `step` no hay ticks, dure lo que dure.
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
        input: undefined,
        planned: 0,
        servedThisFrame: false,
        finished: false,
        resolve,
      });
    });
  }

  /**
   * Ticks de este frame (0 sin petición, como mucho `MAX_STEP_TICKS_PER_FRAME`) e input de la
   * petición, leído con `readInput` solo en su primer frame. Una vez por `update`.
   */
  plan(readInput: () => PlayerInput): StepPlan {
    const head = this.queue[0];
    if (head === undefined) return IDLE;
    head.input ??= readInput();
    head.planned = Math.min(head.remaining, MAX_STEP_TICKS_PER_FRAME);
    head.servedThisFrame = true;
    return { ticks: head.planned, input: head.input };
  }

  /**
   * Ticks ejecutados de verdad y si la petición puede seguir en el siguiente frame. Termina si no
   * quedan ticks, si no puede seguir (pausa, oferta o fin) o si se ejecutaron menos de los
   * planificados.
   */
  served(executed: number, canContinue: boolean): void {
    const head = this.queue[0];
    if (head === undefined || !head.servedThisFrame) return;
    head.done += executed;
    head.remaining -= executed;
    if (head.remaining === 0 || !canContinue || executed < head.planned) head.finished = true;
  }

  /**
   * Final de cada frame del juego, haya o no partida. Resuelve la cabeza si ha terminado o si no
   * se ha atendido en este frame (no hay `GameScene` activa: menú, arranque); la siguiente
   * petición empieza en el frame siguiente.
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
