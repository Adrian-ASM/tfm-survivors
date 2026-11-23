import { describe, expect, it } from 'vitest';
import type { StartedRun } from '../../src/application/StartRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { advanceTicks } from '../../src/infrastructure/phaser/advanceFrame';
import { MAX_DRIVE_TICKS, driveFrames, outcomeOf, startDefault } from '../support/frameDriver';

// Spec simulation-loop, "Mismo resultado en avance manual". Partidas completas con el contenido
// por defecto: cada `it` lleva su propio timeout (como speed-equivalence).
const FRAME_60HZ = 16.667;
const LONG = 15_000;

/**
 * Harness del modo manual: llamadas a `advanceTicks(chunk)` con la política de elección fija
 * (opción 0 mientras haya oferta) hasta el fin o hasta `untilTick`, sin pasarse de él.
 */
function driveSteps(s: StartedRun, chunk: number, untilTick = MAX_DRIVE_TICKS): RunSnapshot {
  let snap = s.tickRun.snapshot();
  while (snap.status !== 'over' && snap.tick < untilTick) {
    while (s.tickRun.status === 'choosing') s.chooseUpgrade.execute(0);
    const n = Math.min(chunk, untilTick - snap.tick);
    snap = advanceTicks(s.tickRun, n, PlayerInput.NONE).snapshot;
  }
  return snap;
}

describe('Mismo resultado en avance manual', () => {
  it(
    'Scenario: Manual frente a tiempo real (semilla 42, frames de 16,667 ms frente a step(60))',
    () => {
      const realtime = outcomeOf(
        driveFrames(startDefault(42), { speed: 1, framesMs: [FRAME_60HZ] }),
      );

      const manual = outcomeOf(driveSteps(startDefault(42), 60));

      expect(realtime.status).toBe('over');
      expect(manual).toStrictEqual(realtime);
    },
    LONG,
  );

  it(
    'Scenario: Reparto distinto de los ticks (semilla 7, step(1) frente a step(1200) hasta 1.200)',
    () => {
      const byOne = driveSteps(startDefault(7), 1, 1200);

      const byBlock = driveSteps(startDefault(7), 1200, 1200);

      expect(byOne.tick).toBe(1200);
      expect(byBlock).toStrictEqual(byOne);
    },
    LONG,
  );
});
