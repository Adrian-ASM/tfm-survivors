import type { PlayerInput } from '../domain/player/PlayerInput';
import type { Run } from '../domain/run/Run';
import type { RunSnapshot } from '../domain/run/RunSnapshot';
import type { RunStatus } from '../domain/run/RunStatus';
import { FixedStepLoop } from './FixedStepLoop';

/** Caso de uso: avanzar la partida el tiempo real de un frame y devolver lo que hay que pintar. */
export class TickRun {
  constructor(
    private readonly run: Run,
    private readonly loop: FixedStepLoop = new FixedStepLoop(),
  ) {}

  /**
   * Con la partida eligiendo mejora o terminada no avanza ni acumula tiempo (spec simulation-loop):
   * al elegir, el siguiente frame sigue con las reglas normales, sin ráfaga de recuperación. Si un
   * tick abre una oferta a mitad de frame, el resto del frame se descarta.
   */
  execute(elapsedMs: number, input: PlayerInput): RunSnapshot {
    if (this.run.status !== 'running') {
      this.loop.reset();
      return this.run.snapshot();
    }
    this.loop.advance(elapsedMs, () => {
      this.run.tick(input);
      return this.run.status === 'running';
    });
    return this.run.snapshot();
  }

  /**
   * Descarta el tiempo sobrante del acumulador sin ejecutar ticks. Lo usa la pausa del adaptador
   * (spec simulation-loop, "Sobrante descartado al pausar"); no cambia ninguna regla de `Run`.
   */
  discardPending(): void {
    this.loop.reset();
  }

  /** Estado de la partida (lectura barata, sin snapshot; lo usa `RestartRun`). */
  get status(): RunStatus {
    return this.run.status;
  }

  snapshot(): RunSnapshot {
    return this.run.snapshot();
  }
}
