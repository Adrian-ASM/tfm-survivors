import { describe, expect, it } from 'vitest';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { DEFAULT_PROGRESSION, LINTER, TESTS, withWeapons } from '../support/builders';
import { aContactConfig, aProbeType, startRun, ticks } from '../support/runs';
import { weaponsOf } from '../support/weapons';

/** Tipos quietos (velocidad ínfima) para colocar bajas donde se quiera. */
const still = (id: string, xp: number, damage = 5) =>
  aProbeType({ id, speed: 1e-6, health: 10, xp, damage });
const STILL_TYPES = [still('bug', 1), still('merge-conflict', 2), still('memory-leak', 4)];

function config(
  weapons: readonly (typeof LINTER)[],
  patch: { maxGems?: number; maxHealth?: number; types?: ReturnType<typeof still>[] } = {},
): RunConfig {
  const base = aContactConfig({
    types: patch.types ?? STILL_TYPES,
    player: { maxHealth: patch.maxHealth ?? 100 },
  });
  return {
    ...withWeapons(base, weaponsOf(weapons)),
    progression: { ...DEFAULT_PROGRESSION, maxGems: patch.maxGems ?? 300 },
  };
}

const run = (c: RunConfig, setup: RunSetup) =>
  startRun(c, { player: { x: 480, y: 270 }, ...setup });

describe('Suelta de gema por baja', () => {
  it('Scenario: Un bug abatido suelta una gema (en su posición, con radio 5)', () => {
    const r = run(config([LINTER]), { enemies: [{ type: 'bug', x: 780, y: 270, health: 4 }] });
    const snaps = ticks(r, 60);
    const n = snaps.findIndex((s) => s.enemies.length === 0);
    expect(n).toBeGreaterThan(0);
    expect(snaps[n - 1]?.gems).toEqual([]);
    expect(snaps[n]?.gems).toHaveLength(1);
    const gem = snaps[n]?.gems[0];
    expect(gem?.radius).toBe(5);
    expect(gem?.x).toBeCloseTo(780, 3);
    expect(gem?.y).toBe(270);
  });

  it('Scenario: Varias bajas en el mismo tick (a1, a2, a3 en un pulso: ids en ese orden)', () => {
    const enemies = [
      { type: 'bug', x: 560, y: 270, health: 4 },
      { type: 'bug', x: 400, y: 270, health: 4 },
      { type: 'bug', x: 480, y: 190, health: 4 },
    ];
    const [first] = ticks(run(config([TESTS]), { enemies }), 1);
    expect(first?.enemies).toEqual([]);
    expect(first?.gems.map((g) => [g.id, Math.round(g.x), Math.round(g.y)])).toEqual([
      [0, 560, 270],
      [1, 400, 270],
      [2, 480, 190],
    ]);
  });

  it('Scenario: Sin baja no hay gema (bug con vida 10 que queda en 4)', () => {
    const r = run(config([LINTER]), { enemies: [{ type: 'bug', x: 780, y: 270 }] });
    const snaps = ticks(r, 60);
    expect(snaps.at(-1)?.enemies.map((e) => e.health)).toEqual([4]);
    expect(snaps.every((s) => s.gems.length === 0)).toBe(true);
  });

  it('Scenario: Una baja en el tick de la muerte deja su gema', () => {
    const types = [still('bug', 1), aProbeType({ id: 'probe', damage: 10, health: 5, xp: 1 })];
    const c = config([TESTS], { types, maxHealth: 10 });
    const enemies = [
      { type: 'probe', x: 480, y: 270 },
      { type: 'bug', x: 560, y: 270, health: 4 },
    ];
    const [first] = ticks(run(c, { enemies }), 1);
    expect(first?.status).toBe('over');
    expect(first?.gems.map((g) => Math.round(g.x))).toEqual([560]);
  });

  it('Scenario: Tope lleno (300 gemas lejos: mismos ids y nada nuevo)', () => {
    const gems = Array.from({ length: 300 }, () => ({ x: 20, y: 20, value: 1 }));
    const enemies = [{ type: 'bug', x: 560, y: 270, health: 4 }];
    const r = run(config([TESTS]), { gems, enemies });
    const before = r.snapshot().gems.map((g) => g.id);
    const [first] = ticks(r, 1);
    expect(first?.enemies).toEqual([]);
    expect(first?.gems.map((g) => g.id)).toEqual(before);
  });
});
