import type { StartedRun } from '../../src/application/StartRun';
import { StartRun } from '../../src/application/StartRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { loadRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import { advanceFrame } from '../../src/infrastructure/phaser/advanceFrame';
import { seededRun } from '../../src/composition/seedSource';

/** Tope de las partidas de equivalencia: 10 min (36.000 ticks), la duración del contenido. */
export const MAX_DRIVE_TICKS = 36_000;

/**
 * Partida con el contenido por defecto (content/*.json, lo que carga el juego) y la semilla dada,
 * sembrada como en producción (`seededRun`: mapa generado por la semilla).
 */
export function startDefault(seed: number): StartedRun {
  const config = loadRunConfig();
  if (!config.ok) throw new Error(config.error.message);
  const { random, terrain } = seededRun(seed);
  const started = new StartRun().execute(config.value, random, undefined, terrain);
  if (!started.ok) throw new Error(started.error.message);
  return started.value;
}

export interface DriveOptions {
  /** Velocidad de simulación del adaptador (1..15). */
  readonly speed: number;
  /** Duraciones de frame que se repiten en ciclo (ms). */
  readonly framesMs: readonly number[];
  readonly input?: PlayerInput;
  /** Para en este tick: la velocidad del último frame baja a `min(speed, objetivo − tick)`. */
  readonly untilTick?: number;
}

/**
 * Harness de Node del adaptador (design 0008): informa frames como lo haría Phaser, con la
 * POLÍTICA DE ELECCIÓN FIJA (opción 0 antes de cada frame mientras haya oferta) y `advanceFrame`
 * a la velocidad dada. Para al terminar la partida o al llegar a `untilTick`.
 */
export function driveFrames(s: StartedRun, options: DriveOptions): RunSnapshot {
  const { speed, framesMs, input = PlayerInput.NONE, untilTick = MAX_DRIVE_TICKS } = options;
  let snap = s.tickRun.snapshot();
  for (let frame = 0; snap.status !== 'over' && snap.tick < untilTick; frame += 1) {
    while (s.tickRun.status === 'choosing') s.chooseUpgrade.execute(0);
    const ms = framesMs[frame % framesMs.length] ?? 0;
    snap = advanceFrame(s.tickRun, ms, input, Math.min(speed, untilTick - snap.tick));
  }
  return snap;
}

/** Lo que la spec compara entre velocidades: resultado, tick, nivel, bajas y mejoras. */
export const outcomeOf = (snap: RunSnapshot) => ({
  status: snap.status,
  outcome: snap.status === 'over' ? snap.outcome : null,
  tick: snap.tick,
  level: snap.progression.level,
  kills: snap.kills,
  upgrades: snap.upgrades,
});
