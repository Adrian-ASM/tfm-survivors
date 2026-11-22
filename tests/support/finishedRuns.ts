import type { FinishedRunSource } from '../../src/application/RecordRun';
import { StartRun, type StartedRun } from '../../src/application/StartRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';
import { TICK_MS, aDefaultConfig } from './builders';
import { startRun } from './runs';

/** Snapshot en curso del contenido por defecto en el tick dado. */
export const runningAt = (tick = 0): RunSnapshot => ({
  ...startRun(aDefaultConfig()).snapshot(),
  tick,
});

/** Snapshot terminado por *spread* (patrón de results-overlay.test.ts). */
export const overAt = (
  tick: number,
  level: number,
  kills: number,
  outcome: 'won' | 'lost' = 'lost',
): RunSnapshot => ({
  ...runningAt(tick),
  status: 'over',
  outcome,
  kills,
  progression: { ...runningAt().progression, level },
});

/** Doble de partida (`FinishedRunSource`) que cuenta cuántas veces se pide el snapshot. */
export function aRunSource(snapshot: RunSnapshot): FinishedRunSource & { snapshots: number } {
  const source = {
    snapshots: 0,
    status: snapshot.status,
    snapshot: (): RunSnapshot => {
      source.snapshots += 1;
      return snapshot;
    },
  };
  return source;
}

const CENTER = { x: 480, y: 270 };

/** Contenido por defecto con un bug letal. */
export const lethalConfig = (): RunConfig => {
  const base = aDefaultConfig();
  const types = base.enemies.types.map((t) =>
    t.id === 'goblin-torch' ? { ...t, damage: 1e6 } : t,
  );
  return { ...base, enemies: { types } };
};

/** `StartRun` que pone un bug letal encima del jugador: la partida muere en su primer tick. */
export class DoomedStartRun extends StartRun {
  override execute(config: RunConfig, random: RandomGenerator) {
    return super.execute(config, random, {
      player: CENTER,
      enemies: [{ type: 'goblin-torch', ...CENTER }],
    });
  }
}

/** Ejecuta frames de 1 tick hasta que la partida termina (como mucho `n`). */
export function playToEnd(s: StartedRun, n = 600): void {
  for (let i = 0; i < n && s.tickRun.status !== 'over'; i++) {
    while (s.tickRun.status === 'choosing') s.chooseUpgrade.execute(0);
    s.tickRun.execute(TICK_MS, PlayerInput.NONE);
  }
}
