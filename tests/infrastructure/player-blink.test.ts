import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { BLINK_PERIOD_TICKS, playerVisible } from '../../src/infrastructure/phaser/playerBlink';
import { aContactConfig, startRun, ticks } from '../support/runs';

const snap = (tick: number, invulnerable: boolean, status: RunSnapshot['status'] = 'running') => ({
  tick,
  status,
  player: { x: 0, y: 0, radius: 16, health: 50, maxHealth: 100, invulnerable },
});

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('playerVisible · indicación visual de invulnerabilidad', () => {
  it('el periodo por defecto es de 4 ticks', () => {
    expect(BLINK_PERIOD_TICKS).toBe(4);
  });

  it('Sin invulnerabilidad el jugador se ve siempre (600 snapshots reales sin golpes)', () => {
    const snaps = ticks(startRun(aContactConfig()), 600);
    expect(snaps.every((s) => playerVisible(s, 4))).toBe(true);
  });

  it('Parpadeo durante la invulnerabilidad (golpe real en el tick 1, N = 30)', () => {
    const run = startRun(aContactConfig(), { enemies: [{ type: 'probe', x: 480, y: 270 }] });
    const snaps = ticks(run, 30);
    const visibleTicks = snaps.filter((s) => playerVisible(s, 4)).map((s) => s.tick);
    expect(visibleTicks).toEqual([
      ...range(1, 3),
      ...range(8, 11),
      ...range(16, 19),
      ...range(24, 27),
    ]);
    const hidden = snaps.filter((s) => !playerVisible(s, 4)).map((s) => s.tick);
    expect(hidden).toEqual([...range(4, 7), ...range(12, 15), ...range(20, 23), ...range(28, 30)]);
  });

  it('Primer tick de invulnerabilidad: golpe en el tick 12 → oculto', () => {
    expect(playerVisible(snap(12, true), 4)).toBe(false);
  });

  it('Último tick de invulnerabilidad y fin del parpadeo: 30 oculto, 31 visible', () => {
    expect(playerVisible(snap(30, true), 4)).toBe(false);
    expect(playerVisible(snap(31, false), 4)).toBe(true);
  });

  it('Partida terminada estando invulnerable: visible en el tick 13 y 60 frames más', () => {
    const over = snap(13, true, 'over');
    const frames = Array.from({ length: 61 }, () => playerVisible(over, 4));
    expect(frames.every(Boolean)).toBe(true);
  });

  it('usa BLINK_PERIOD_TICKS si no se pasa periodo', () => {
    expect([playerVisible(snap(3, true)), playerVisible(snap(4, true))]).toEqual([true, false]);
  });
});
