import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from '../../src/application/FixedStepLoop';
import { RecordRun } from '../../src/application/RecordRun';
import { TickRun } from '../../src/application/TickRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { EMPTY_PROGRESS } from '../../src/domain/progress/Progress';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { PauseGate } from '../../src/infrastructure/phaser/PauseGate';
import { TICK_MS } from '../support/builders';
import { FixedClock } from '../support/FixedClock';
import { startDefault } from '../support/frameDriver';
import { InMemoryProgressRepository } from '../support/InMemoryProgressRepository';
import { randomInputs } from '../support/inputs';
import { aContactConfig, startRun } from '../support/runs';

const CENTER = { x: 480, y: 270 };

/** Partida sin enemigos ni armas: no abre ofertas ni termina en los próximos cientos de ticks. */
function quiet(): { loop: FixedStepLoop; tickRun: TickRun } {
  const loop = new FixedStepLoop();
  return { loop, tickRun: new TickRun(startRun(aContactConfig(), { player: CENTER }), loop) };
}

describe('PauseGate.step (spec main-menu, "Pausa con Esc")', () => {
  it('Scenario: Pausar y reanudar con Esc (Esc en curso pausa y descarta el sobrante)', () => {
    const { loop, tickRun } = quiet();
    tickRun.execute(25, PlayerInput.NONE);
    const gate = new PauseGate();

    const routed = gate.step(true, null, 'running', tickRun);

    expect([routed, gate.paused, loop.accumulatedMs]).toEqual([null, true, 0]);
  });

  it('Scenario: Pausar y reanudar con Esc (otra pulsación de Esc reanuda)', () => {
    const { tickRun } = quiet();
    const gate = new PauseGate();
    gate.step(true, null, 'running', tickRun);

    gate.step(true, null, 'running', tickRun);

    expect(gate.paused).toBe(false);
  });

  it('Scenario: Reanudar con el botón (resume en pausa reanuda)', () => {
    const { tickRun } = quiet();
    const gate = new PauseGate();
    gate.step(true, null, 'running', tickRun);

    const routed = gate.step(false, 'resume', 'running', tickRun);

    expect([routed, gate.paused]).toEqual([null, false]);
  });

  it.each(['choosing', 'over'] as const)(
    'Scenario: Esc mientras se elige mejora / con la partida terminada (%s: no hace nada)',
    (status) => {
      const { tickRun } = quiet();
      const gate = new PauseGate();

      const routed = gate.step(true, null, status, tickRun);

      expect([routed, gate.paused]).toEqual([null, false]);
    },
  );

  it('Volver al menú solo en pausa devuelve menu', () => {
    const { tickRun } = quiet();
    const gate = new PauseGate();
    const unpaused = gate.step(false, 'menu', 'running', tickRun);
    gate.step(true, null, 'running', tickRun);

    const paused = gate.step(false, 'menu', 'running', tickRun);

    expect([unpaused, paused]).toEqual([null, 'menu']);
  });

  it('resume sin pausa no hace nada', () => {
    const { tickRun } = quiet();
    const gate = new PauseGate();

    const routed = gate.step(false, 'resume', 'running', tickRun);

    expect([routed, gate.paused]).toEqual([null, false]);
  });

  it('Scenario: Esc y R en el mismo frame (queda en pausa: la escena descarta R en pausa)', () => {
    const { tickRun } = quiet();
    const gate = new PauseGate();

    gate.step(true, null, 'running', tickRun);

    expect([gate.paused, tickRun.status]).toEqual([true, 'running']);
  });
});

const FRAME_60HZ = 16.667;
const FRAME_120HZ = 8.334;

/** Partida sin oferta ni fin próximos, en el tick n, con la puerta ya en pausa. */
function pausedAt(n: number): { gate: PauseGate; tickRun: TickRun } {
  const { tickRun } = quiet();
  for (let i = 0; i < n; i++) tickRun.execute(TICK_MS, PlayerInput.NONE);
  const gate = new PauseGate();
  gate.step(true, null, 'running', tickRun);
  return { gate, tickRun };
}

const frames = (gate: PauseGate, run: TickRun, n: number, ms: number, speed = 1): RunSnapshot[] =>
  Array.from({ length: n }, () => gate.frame(run, ms, PlayerInput.of(1, 1), speed));

describe('PauseGate.frame (spec simulation-loop, "Sin tiempo acumulado durante la pausa")', () => {
  it('Scenario: Frames durante la pausa (300 de 16,667 ms y 1 de 5.000: 0 ticks, mismo snapshot)', () => {
    const { gate, tickRun } = pausedAt(500);
    const before = tickRun.snapshot();

    const during = [...frames(gate, tickRun, 300, FRAME_60HZ), ...frames(gate, tickRun, 1, 5000)];

    expect(during.every((s) => JSON.stringify(s) === JSON.stringify(before))).toBe(true);
    expect(tickRun.snapshot()).toStrictEqual(before);
  });

  it('Scenario: Primer frame tras reanudar (16,667 ms: exactamente 1 tick)', () => {
    const { gate, tickRun } = pausedAt(500);
    frames(gate, tickRun, 300, FRAME_60HZ);
    gate.step(true, null, 'running', tickRun);

    expect(gate.frame(tickRun, FRAME_60HZ, PlayerInput.NONE, 1).tick).toBe(501);
  });

  it('Scenario: Frame largo durante la pausa (5.000 ms: 0 ticks; tras reanudar, 1 tick)', () => {
    const { gate, tickRun } = pausedAt(500);
    const long = gate.frame(tickRun, 5000, PlayerInput.NONE, 1);
    gate.step(false, 'resume', 'running', tickRun);

    const next = gate.frame(tickRun, FRAME_60HZ, PlayerInput.NONE, 1);

    expect([long.tick, next.tick]).toEqual([500, 501]);
  });

  it('Scenario: Reanudar con el botón (tras reanudar, 8,334 ms dan 0 ticks)', () => {
    const { gate, tickRun } = pausedAt(500);
    gate.step(false, 'resume', 'running', tickRun);

    expect(gate.frame(tickRun, FRAME_120HZ, PlayerInput.NONE, 1).tick).toBe(500);
  });

  it('Scenario: Reanudar a velocidad 8 (0 ticks en pausa; luego n + 8 y n + 16)', () => {
    const { gate, tickRun } = pausedAt(100);
    const during = frames(gate, tickRun, 300, FRAME_60HZ, 8);
    gate.step(true, null, 'running', tickRun);

    const after = frames(gate, tickRun, 2, FRAME_60HZ, 8).map((s) => s.tick);

    expect(during.every((s) => s.tick === 100)).toBe(true);
    expect(after).toEqual([108, 116]);
  });

  it('Scenario: Pausa a velocidad 15 con frame largo (5.000 ms: 0 ticks)', () => {
    const { gate, tickRun } = pausedAt(100);

    expect(gate.frame(tickRun, 5000, PlayerInput.NONE, 15).tick).toBe(100);
  });

  it('Scenario: HUD en pausa (600 frames: el snapshot pintado no cambia)', () => {
    const { gate, tickRun } = pausedAt(600);
    const before = tickRun.snapshot();

    const during = frames(gate, tickRun, 600, FRAME_60HZ);

    expect(during.every((s) => JSON.stringify(s) === JSON.stringify(before))).toBe(true);
  });

  it('Scenario: Pausa sin guardado (pausa, 300 frames y reanudar: 0 escrituras)', () => {
    const { gate, tickRun } = pausedAt(500);
    const session = { progress: EMPTY_PROGRESS, persistent: true, corruptPending: false };
    const repo = new InMemoryProgressRepository();
    const record = new RecordRun(session, repo, new FixedClock(0), () => 42);

    for (let i = 0; i < 300; i++) {
      gate.frame(tickRun, FRAME_60HZ, PlayerInput.NONE, 1);
      record.execute(tickRun);
    }
    gate.step(true, null, 'running', tickRun);
    record.execute(tickRun);

    expect([repo.writes, repo.saveAttempts]).toEqual([0, 0]);
  });
});

/** Política de elección fija (opción 0) e inputs por tick; pausa 300 frames en los ticks dados. */
function playWithPauses(pauseTicks: readonly number[]): Map<number, string> {
  const s = startDefault(42);
  const inputs = randomInputs(1200, 7);
  const gate = new PauseGate();
  const pending = new Set(pauseTicks);
  const byTick = new Map<number, string>();
  let snap = s.tickRun.snapshot();
  while (snap.status !== 'over' && snap.tick < 1200) {
    while (s.tickRun.status === 'choosing') s.chooseUpgrade.execute(0);
    if (pending.delete(snap.tick)) {
      gate.step(true, null, s.tickRun.status, s.tickRun);
      for (let i = 0; i < 300; i++) gate.frame(s.tickRun, FRAME_60HZ, PlayerInput.of(1, 1), 1);
      gate.step(true, null, s.tickRun.status, s.tickRun);
    }
    const input = inputs[snap.tick] ?? PlayerInput.NONE;
    snap = gate.frame(s.tickRun, TICK_MS, input, 1);
    byTick.set(snap.tick, JSON.stringify(snap));
  }
  return byTick;
}

describe('PauseGate · la pausa no altera la simulación', () => {
  it('Scenario: La pausa no altera la simulación (semilla 42, pausas en 100, 400 y 900)', () => {
    const plain = playWithPauses([]);
    const paused = playWithPauses([100, 400, 900]);

    expect(plain.size).toBeGreaterThan(900);
    expect(paused).toStrictEqual(plain);
  });
});
