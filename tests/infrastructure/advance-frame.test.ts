import { seededRun } from '../../src/composition/seedSource';
import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from '../../src/application/FixedStepLoop';
import { RestartRun } from '../../src/application/RestartRun';
import { StartRun, type StartedRun } from '../../src/application/StartRun';
import { TickRun } from '../../src/application/TickRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { Run } from '../../src/domain/run/Run';
import { advanceFrame } from '../../src/infrastructure/phaser/advanceFrame';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { resolveSpeed } from '../../src/infrastructure/url/resolveSpeed';
import {
  aDefaultConfig,
  withScenarioCurve,
  aSegment,
  aWavesConfig,
  withDuration,
} from '../support/builders';
import { lethalConfig } from '../support/finishedRuns';
import { driveFrames } from '../support/frameDriver';
import { aContactConfig, startRun } from '../support/runs';

const FRAME_60HZ = 16.667;
const FRAME_120HZ = 8.334;
const CENTER = { x: 480, y: 270 };
/** Paso del jugador por tick a 200 px/s (px). */
const STEP_PX = 200 / 60;

/** Partida sin enemigos ni armas: no abre ofertas ni termina en los próximos 225 ticks. */
function quiet(): { run: Run; loop: FixedStepLoop; tickRun: TickRun } {
  const run = startRun(aContactConfig(), { player: CENTER });
  const loop = new FixedStepLoop();
  return { run, loop, tickRun: new TickRun(run, loop) };
}

/** Partida que abre una oferta en el 3.er tick que ejecuta (gema a 36 px con XP 4 de 5). */
function offeringAtThird(): { run: Run; loop: FixedStepLoop; tickRun: TickRun } {
  const base = withScenarioCurve(aDefaultConfig());
  const config = {
    ...base,
    waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves,
  };
  const run = startRun(config, {
    player: CENTER,
    gems: [{ x: 516, y: 270, value: 1 }],
    experience: { level: 1, xp: 4 },
  });
  const loop = new FixedStepLoop();
  return { run, loop, tickRun: new TickRun(run, loop) };
}

/** Partida de 1 s (60 ticks) sin enemigos, ya en el tick 59: gana en el primer tick que ejecute. */
function aboutToWin(): { loop: FixedStepLoop; tickRun: TickRun } {
  const run = startRun(withDuration(aContactConfig(), 1));
  for (let i = 0; i < 59; i++) run.tick(PlayerInput.NONE);
  const loop = new FixedStepLoop();
  return { loop, tickRun: new TickRun(run, loop) };
}

describe('advanceFrame · avance acelerado por frame', () => {
  it('Scenario: Un frame de 1/60 s a velocidad 8', () => {
    const { tickRun } = quiet();
    expect(advanceFrame(tickRun, FRAME_60HZ, PlayerInput.NONE, 8).tick).toBe(8);
  });

  it('Scenario: Monitor de 120 Hz a velocidad 8 (4 ticks, igual que 8 frames a velocidad 1)', () => {
    const fast = quiet();
    const slow = quiet();

    const snap = advanceFrame(fast.tickRun, FRAME_120HZ, PlayerInput.NONE, 8);
    for (let i = 0; i < 8; i++) advanceFrame(slow.tickRun, FRAME_120HZ, PlayerInput.NONE, 1);

    expect([snap.tick, slow.tickRun.snapshot().tick]).toEqual([4, 4]);
  });

  it('Scenario: Velocidad máxima con frame congelado (5.000 ms a velocidad 15: 225 ticks)', () => {
    const { tickRun } = quiet();
    expect(advanceFrame(tickRun, 5000, PlayerInput.NONE, 15).tick).toBe(225);
  });

  it.each([-10, Number.NaN])('Scenario: Tiempo negativo o no numérico a velocidad 8 (%s)', (ms) => {
    const { loop, tickRun } = quiet();
    advanceFrame(tickRun, 10, PlayerInput.NONE, 1);
    const before = loop.accumulatedMs;

    const snap = advanceFrame(tickRun, ms, PlayerInput.NONE, 8);

    expect([snap.tick, loop.accumulatedMs]).toEqual([0, before]);
  });

  it('Scenario: Velocidad 1 sin cambios (600 frames: snapshots iguales a execute directo)', () => {
    const direct = quiet().tickRun;
    const viaAdapter = quiet().tickRun;
    const right = PlayerInput.of(1, 0);
    const frames = Array.from({ length: 600 }, () => FRAME_60HZ);

    const a = frames.map((ms) => direct.execute(ms, right));
    const b = frames.map((ms) => advanceFrame(viaAdapter, ms, right, 1));

    expect(b).toStrictEqual(a);
    expect(b.at(-1)?.tick).toBe(600);
  });

  it('Scenario: Input único por frame (8 ticks con el input leído al empezar el frame)', () => {
    const { tickRun } = quiet();
    // El teclado se lee una vez: aunque la tecla se suelte antes de que acabe el frame, el valor
    // leído es el que reciben los 8 ticks.
    const keyboard = [PlayerInput.of(1, 0), PlayerInput.NONE];
    const input = keyboard[0] ?? PlayerInput.NONE;

    const snap = advanceFrame(tickRun, FRAME_60HZ, input, 8);

    expect(snap.tick).toBe(8);
    expect(snap.player.x).toBeCloseTo(CENTER.x + 8 * STEP_PX, 2);
  });
});

describe('advanceFrame · corte del frame', () => {
  it('Scenario: Oferta a mitad de frame acelerado (3 ticks, eligiendo, acumulador a 0)', () => {
    const { run, loop, tickRun } = offeringAtThird();

    const snap = advanceFrame(tickRun, FRAME_60HZ, PlayerInput.NONE, 8);

    expect([snap.tick, snap.status, loop.accumulatedMs]).toEqual([3, 'choosing', 0]);
    expect(run.chooseUpgrade(0).ok).toBe(true);
    expect(advanceFrame(tickRun, FRAME_120HZ, PlayerInput.NONE, 8).tick).toBe(3 + 4);
  });

  it('Scenario: Fin de partida a mitad de frame acelerado (50 ms a velocidad 15: 1 tick)', () => {
    const { loop, tickRun } = aboutToWin();

    const snap = advanceFrame(tickRun, 50, PlayerInput.NONE, 15);

    expect([snap.tick, snap.status, loop.accumulatedMs]).toEqual([60, 'over', 0]);
  });

  it('Scenario: Frames durante la elección a velocidad 15 (600 frames: 0 ticks)', () => {
    const { loop, tickRun } = offeringAtThird();
    const n = advanceFrame(tickRun, FRAME_60HZ, PlayerInput.NONE, 8).tick;

    const frames = Array.from({ length: 600 }, () =>
      advanceFrame(tickRun, FRAME_60HZ, PlayerInput.of(1, 1), 15),
    );

    expect(frames.every((s) => s.tick === n && s.status === 'choosing')).toBe(true);
    expect(loop.accumulatedMs).toBe(0);
  });

  it('Scenario: Frames con la partida terminada a velocidad 15 (600 frames: 0 ticks)', () => {
    const { loop, tickRun } = aboutToWin();
    const ended = advanceFrame(tickRun, FRAME_60HZ, PlayerInput.NONE, 15);

    const frames = Array.from({ length: 600 }, () =>
      advanceFrame(tickRun, FRAME_60HZ, PlayerInput.NONE, 15),
    );

    expect(frames.every((s) => s.tick === ended.tick && s.status === 'over')).toBe(true);
    expect(loop.accumulatedMs).toBe(0);
  });
});

/** Partida con el contenido por defecto que muere en su primer tick (bug letal encima). */
function doomed(): StartedRun {
  const r = new StartRun().execute(lethalConfig(), new Mulberry32RandomGenerator(42), {
    player: CENTER,
    enemies: [{ type: 'goblin-torch', ...CENTER }],
  });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** RestartRun con el contenido por defecto y la semilla 42 en cada partida nueva. */
const restartRun = (): RestartRun =>
  new RestartRun(withScenarioCurve(aDefaultConfig()), () => seededRun(42));

describe('advanceFrame · reinicio', () => {
  it('Scenario: La velocidad se mantiene al reiniciar (R y 1 frame a velocidad 8: tick 8)', () => {
    const { speed } = resolveSpeed('?e2e&speed=8');
    const first = doomed();
    advanceFrame(first.tickRun, FRAME_60HZ, PlayerInput.NONE, speed);
    const next = restartRun().execute(first.tickRun);
    if (!next.ok) throw new Error('el reinicio debía proceder');

    const snap = advanceFrame(next.value.tickRun, FRAME_60HZ, PlayerInput.NONE, speed);

    expect([first.tickRun.status, snap.tick]).toEqual(['over', 8]);
  });

  it('Scenario: Reinicio tras una velocidad inválida (3 R: 1 tick por frame y 1 aviso)', () => {
    const warnings: string[] = [];
    const resolved = resolveSpeed('?e2e&speed=abc');
    if (resolved.warning) warnings.push(resolved.warning);
    const restart = restartRun();
    let current = doomed();
    advanceFrame(current.tickRun, FRAME_60HZ, PlayerInput.NONE, resolved.speed);
    const firstFrameTicks: number[] = [];

    for (let r = 0; r < 3; r++) {
      const next = restart.execute(current.tickRun);
      if (!next.ok) throw new Error('el reinicio debía proceder');
      current = next.value;
      firstFrameTicks.push(
        advanceFrame(current.tickRun, FRAME_60HZ, PlayerInput.NONE, resolved.speed).tick,
      );
      driveFrames(current, { speed: resolved.speed, framesMs: [FRAME_60HZ] });
    }

    expect(firstFrameTicks).toEqual([1, 1, 1]);
    expect(current.tickRun.status).toBe('over');
    expect(warnings).toHaveLength(1);
  });
});
