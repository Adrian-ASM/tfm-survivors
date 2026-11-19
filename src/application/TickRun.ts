import type { PlayerInput } from '../domain/player/PlayerInput';
import type { Run } from '../domain/run/Run';
import type { RunSnapshot } from '../domain/run/RunSnapshot';
import { FixedStepLoop } from './FixedStepLoop';

/** Caso de uso: avanzar la partida el tiempo real de un frame y devolver lo que hay que pintar. */
export class TickRun {
  constructor(
    private readonly run: Run,
    private readonly loop: FixedStepLoop = new FixedStepLoop(),
  ) {}

  execute(elapsedMs: number, input: PlayerInput): RunSnapshot {
    this.loop.advance(elapsedMs, () => {
      this.run.tick(input);
    });
    return this.run.snapshot();
  }

  snapshot(): RunSnapshot {
    return this.run.snapshot();
  }
}
