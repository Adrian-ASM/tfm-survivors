import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { STILL_LIMIT_TICKS } from '../support/balanceSeeds';
import { driveFrames, outcomeOf, startDefault } from '../support/frameDriver';

// Spec simulation-loop, "Mismo resultado con cualquier velocidad". Partidas completas con el
// contenido por defecto: cada `it` lleva su propio timeout (design 0008, Riesgos).
const FRAME_60HZ = 16.667;
const IRREGULAR = [8.334, 16.667, 33.334];
const LONG = 15_000;

/** Desenlace de una partida a la velocidad dada, con la política de elección fija. */
const playAt = (seed: number, speed: number, framesMs = [FRAME_60HZ], input = PlayerInput.NONE) =>
  outcomeOf(driveFrames(startDefault(seed), { speed, framesMs, input }));

describe('Mismo resultado con cualquier velocidad', () => {
  it(
    'Scenario: Derrota equivalente con la semilla 42 (velocidades 1, 4, 8 y 15)',
    () => {
      const [base, ...rest] = [1, 4, 8, 15].map((speed) => playAt(42, speed));

      expect(base?.status).toBe('over');
      expect(rest).toStrictEqual([base, base, base]);
    },
    LONG,
  );

  it(
    'Scenario: Derrota equivalente con otra semilla del conjunto (semilla 7, velocidades 1 y 8)',
    () => {
      const base = playAt(7, 1);

      expect(base).toMatchObject({ status: 'over', outcome: 'lost' });
      expect(base.tick).toBeLessThan(STILL_LIMIT_TICKS);
      expect(playAt(7, 8)).toStrictEqual(base);
    },
    LONG,
  );

  it(
    'Scenario: Equivalencia con frames irregulares (semilla 7, input (1, 0))',
    () => {
      const right = PlayerInput.of(1, 0);
      const base = playAt(7, 1, IRREGULAR, right);

      expect(playAt(7, 8, IRREGULAR, right)).toStrictEqual(base);
    },
    LONG,
  );

  it(
    'Scenario: Snapshots iguales tick a tick (tick 1.200, velocidades 1 y 8)',
    () => {
      const options = { framesMs: [FRAME_60HZ], untilTick: 1200 };
      const slow = driveFrames(startDefault(42), { ...options, speed: 1 });

      const fast = driveFrames(startDefault(42), { ...options, speed: 8 });

      expect(slow.tick).toBe(1200);
      expect(fast).toStrictEqual(slow);
    },
    LONG,
  );
});
