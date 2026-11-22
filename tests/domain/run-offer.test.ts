import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import {
  DEFAULT_UPGRADE_LIST,
  aDefaultConfig,
  aSegment,
  aWavesConfig,
  withUpgrades,
} from '../support/builders';
import { CountingRandom, StubRandom } from '../support/random';
import { startRun, ticks } from '../support/runs';

const AT_PLAYER = { x: 480, y: 270 };
/** Una gema de `value` que se recoge en el tick 1 (a 20 px del jugador quieto). */
const gemAt = (value: number) => [{ x: 500, y: 270, value }];
const levelUp = (xp: number, value: number, level = 1): RunSetup => ({
  player: AT_PLAYER,
  gems: gemAt(value),
  experience: { level, xp },
});

/** Contenido por defecto sin spawns (solo lo que pone el `RunSetup`). */
const quiet = (base: RunConfig = aDefaultConfig()): RunConfig => ({
  ...base,
  waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves,
});

/** Valores de azar consumidos por el primer tick. */
function randomCalls(config: RunConfig, setup: RunSetup): number {
  const random = new CountingRandom(new StubRandom(0.5));
  startRun(config, setup, random).tick(PlayerInput.NONE);
  return random.calls;
}

describe('Oferta de mejoras', () => {
  it('Scenario: Primera oferta (3 opciones distintas del catálogo, nivel 0 → 1)', () => {
    const [first] = ticks(startRun(quiet(), levelUp(4, 1)), 1);
    expect(first?.status).toBe('choosing');
    expect(first?.offer).toHaveLength(3);
    expect(new Set(first?.offer.map((o) => o.id)).size).toBe(3);
    for (const o of first?.offer ?? []) {
      const content = DEFAULT_UPGRADE_LIST.find((u) => u.id === o.id);
      expect(o).toEqual({
        id: content?.id,
        name: content?.name,
        description: content?.description,
        level: 0,
        nextLevel: 1,
      });
    }
  });

  it('Scenario: Umbral exacto (nivel 2, XP 0, xpToNext 10 y 1 subida pendiente)', () => {
    const [first] = ticks(startRun(quiet(), levelUp(4, 1)), 1);
    expect(first?.progression).toEqual({ level: 2, xp: 0, xpToNext: 10, pendingLevelUps: 1 });
  });

  it('Scenario: Una gema que da dos niveles (nivel 3, XP 1, 2 pendientes, eligiendo)', () => {
    const [first] = ticks(startRun(quiet(), levelUp(0, 16)), 1);
    expect(first?.progression).toEqual({ level: 3, xp: 1, xpToNext: 15, pendingLevelUps: 2 });
    expect(first?.status).toBe('choosing');
    expect(first?.offer).toHaveLength(3);
  });

  it('Scenario: Varias gemas que dan varios niveles (XP 4 + 12 gemas: nivel 3, XP 1, 2)', () => {
    const gems = Array.from({ length: 12 }, () => ({ ...AT_PLAYER, value: 1 }));
    const setup = { player: AT_PLAYER, gems, experience: { level: 1, xp: 4 } };
    const [first] = ticks(startRun(quiet(), setup), 1);
    expect(first?.progression).toMatchObject({ level: 3, xp: 1, pendingLevelUps: 2 });
  });

  it('Scenario: El director actúa antes de abrir la oferta (bug nuevo y oferta en el tick n)', () => {
    const base = aDefaultConfig();
    const config = { ...base, waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 60)] }).waves };
    const [first] = ticks(startRun(config, levelUp(4, 1)), 1);
    expect(first?.enemies).toHaveLength(1);
    expect(first?.status).toBe('choosing');
    expect(first?.offer).toHaveLength(3);
  });

  it('Scenario: Eligiendo mejora (primera mitad: el snapshot del tick n está eligiendo)', () => {
    const [first] = ticks(startRun(quiet(), levelUp(4, 1)), 1);
    expect([first?.tick, first?.status]).toEqual([1, 'choosing']);
  });

  it('abrir la oferta consume 3 valores de azar más que el mismo tick sin subida', () => {
    expect(randomCalls(quiet(), levelUp(4, 1)) - randomCalls(quiet(), levelUp(0, 1))).toBe(3);
  });
});

describe('Sin mejoras disponibles', () => {
  it('Scenario: Ninguna disponible (catálogo vacío: nivel 8, sin oferta, en curso, n + 1 normal)', () => {
    const config = quiet(withUpgrades(aDefaultConfig(), { upgrades: [] }));
    const [n, next] = ticks(startRun(config, levelUp(34, 1, 7)), 2);
    expect(n?.progression).toEqual({ level: 8, xp: 0, xpToNext: 40, pendingLevelUps: 0 });
    expect([n?.status, n?.offer]).toEqual(['running', []]);
    expect([next?.tick, next?.status]).toEqual([2, 'running']);
    expect(randomCalls(config, levelUp(34, 1, 7))).toBe(randomCalls(config, levelUp(0, 1, 7)));
  });

  it('Scenario: Sin pasar por eligiendo si no hay mejoras disponibles', () => {
    const config = quiet(withUpgrades(aDefaultConfig(), { upgrades: [] }));
    const [first] = ticks(startRun(config, levelUp(4, 1)), 1);
    expect(first?.status).toBe('running');
  });
});
