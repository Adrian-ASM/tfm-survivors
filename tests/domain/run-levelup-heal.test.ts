import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  aDefaultConfig,
  aSegment,
  aWavesConfig,
  withPlayer,
  withScenarioCurve,
} from '../support/builders';
import { CountingRandom } from '../support/random';
import { startRun, ticks } from '../support/runs';
import { withPlayerStat } from '../support/upgrades';

// Spec leveling (0024), "Curación por subida sin mejoras": cada subida pendiente sin mejoras de
// personaje disponibles cura max(1, ⌊% × máx / 100⌋) con tope, sin oferta, pausa ni azar.

const CENTER = { x: 480, y: 270 };

/**
 * Contenido por defecto (curva 5/5) sin oleadas, curación por subida `percent` (valor de
 * escenario) y una sola mejora de personaje (`context-window`, nivel máximo 1) que el `RunSetup`
 * pone al máximo: no hay ninguna disponible y la vida máxima no cambia.
 */
const exhausted = (percent: number, maxHealth = 100): RunConfig => {
  const base = withScenarioCurve(aDefaultConfig());
  return withPlayerStat(
    withPlayer(
      {
        ...base,
        progression: { ...base.progression, levelUpHealPercent: percent },
        waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves,
      },
      { maxHealth },
    ),
    'context-window',
    32,
  );
};

/** Jugador en el centro con `health` y una gema de `value` que recoge en el tick 1. */
const levelUp = (health: number, value: number, experience = { level: 1, xp: 0 }): RunSetup => ({
  player: { ...CENTER, health },
  gems: [{ x: 500, y: 270, value }],
  experience,
  upgrades: { 'context-window': 1 },
});

describe('Curación por subida sin mejoras (leveling 0024)', () => {
  it('Scenario: Una subida sin mejoras (50 de 100, 10 %: 60, sin oferta y en curso)', () => {
    const [n] = ticks(startRun(exhausted(10), levelUp(50, 1, { level: 1, xp: 4 })), 1);

    expect([n?.progression.level, n?.progression.pendingLevelUps]).toEqual([2, 0]);
    expect([n?.player.health, n?.offer, n?.status]).toEqual([60, [], 'running']);
  });

  it('Scenario: Dos subidas en el mismo tick (30 de 100: 50)', () => {
    const [n] = ticks(startRun(exhausted(10), levelUp(30, 15)), 1);

    expect([n?.progression.level, n?.player.health]).toEqual([3, 50]);
  });

  it('Scenario: Tope y mínimo (95 → 100; con 1 % y 10 de 60, 11)', () => {
    const [capped] = ticks(startRun(exhausted(10), levelUp(95, 1, { level: 1, xp: 4 })), 1);
    const [floor] = ticks(startRun(exhausted(1, 60), levelUp(10, 1, { level: 1, xp: 4 })), 1);

    expect([capped?.player.health, floor?.player.health, floor?.player.maxHealth]).toEqual([
      100, 11, 60,
    ]);
  });

  it('la curación por subida no cambia la vida máxima ni la invulnerabilidad', () => {
    const [n] = ticks(startRun(exhausted(10), levelUp(50, 1, { level: 1, xp: 4 })), 1);

    expect([n?.player.maxHealth, n?.player.invulnerable]).toEqual([100, false]);
  });

  it('Scenario: Sin azar (2 subidas sin mejoras frente a ninguna: mismo estado del azar)', () => {
    const calls = (value: number) => {
      const random = new CountingRandom(new Mulberry32RandomGenerator(7));
      startRun(exhausted(10), levelUp(50, value), random).tick(PlayerInput.NONE);
      return random.calls;
    };

    expect(calls(15)).toBe(calls(1));
  });
});

// Spec upgrades (0024), "Oferta de mejoras": una subida sin mejoras disponibles cura.
describe('Subidas sin mejoras de personaje disponibles (upgrades 0024)', () => {
  it('Scenario: Ninguna disponible (nivel 7 a 1 del umbral: nivel 8, sin oferta, vida 60)', () => {
    const run = startRun(exhausted(10), levelUp(50, 1, { level: 7, xp: 34 }));
    const [n, next] = ticks(run, 2);

    expect(n?.progression).toEqual({ level: 8, xp: 0, xpToNext: 40, pendingLevelUps: 0 });
    expect([n?.offer, n?.status, n?.player.health]).toEqual([[], 'running', 60]);
    expect([next?.tick, next?.status]).toEqual([2, 'running']);
  });

  it('Scenario: La disponibilidad se recalcula entre ofertas encoladas (cura la segunda: 60)', () => {
    const base = exhausted(10);
    const config = withPlayerStat(base, 'context-window', 32, 1);
    // `context-window` a nivel 0 de 1: la primera subida la ofrece y la segunda ya no tiene nada.
    const run = startRun(config, { ...levelUp(50, 15), upgrades: {} });
    const [n] = ticks(run, 1);
    expect([n?.progression.pendingLevelUps, n?.offer.map((o) => o.id)]).toEqual([
      2,
      ['context-window'],
    ]);

    expect(run.chooseUpgrade(0).ok).toBe(true);

    const s = run.snapshot();
    expect([s.status, s.offer, s.progression.pendingLevelUps]).toEqual(['running', [], 0]);
    expect(s.player.health).toBe(60);
  });
});
