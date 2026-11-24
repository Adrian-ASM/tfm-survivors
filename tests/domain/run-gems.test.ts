import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { SCENARIO_PROGRESSION, LINTER, TESTS, aSegment, withWeapons } from '../support/builders';
import { CountingRandom } from '../support/random';
import { aContactConfig, aProbeType, startRun, ticks } from '../support/runs';
import { weaponsOf } from '../support/weapons';

/** Tipos quietos (velocidad ínfima) para colocar bajas donde se quiera. */
const still = (id: string, xp: number, damage = 5) =>
  aProbeType({ id, speed: 1e-6, health: 10, xp, damage });
const STILL_TYPES = [still('goblin-torch', 1), still('goblin-barrel', 2), still('goblin-tnt', 4)];

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
    progression: { ...SCENARIO_PROGRESSION, maxGems: patch.maxGems ?? 300 },
  };
}

const run = (c: RunConfig, setup: RunSetup) =>
  startRun(c, { player: { x: 480, y: 270 }, ...setup });

describe('Suelta de gema por baja', () => {
  it('Scenario: Un goblin-torch abatido suelta una gema (en su posición, con radio 5)', () => {
    const r = run(config([LINTER]), {
      enemies: [{ type: 'goblin-torch', x: 780, y: 270, health: 4 }],
    });
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
      { type: 'goblin-torch', x: 560, y: 270, health: 4 },
      { type: 'goblin-torch', x: 400, y: 270, health: 4 },
      { type: 'goblin-torch', x: 480, y: 190, health: 4 },
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
    const r = run(config([LINTER]), { enemies: [{ type: 'goblin-torch', x: 780, y: 270 }] });
    const snaps = ticks(r, 60);
    expect(snaps.at(-1)?.enemies.map((e) => e.health)).toEqual([4]);
    expect(snaps.every((s) => s.gems.length === 0)).toBe(true);
  });

  it('Scenario: Una baja en el tick de la muerte deja su gema', () => {
    const types = [
      still('goblin-torch', 1),
      aProbeType({ id: 'probe', damage: 10, health: 5, xp: 1 }),
    ];
    const c = config([TESTS], { types, maxHealth: 10 });
    const enemies = [
      { type: 'probe', x: 480, y: 270 },
      { type: 'goblin-torch', x: 560, y: 270, health: 4 },
    ];
    const [first] = ticks(run(c, { enemies }), 1);
    expect(first?.status).toBe('over');
    expect(first?.gems.map((g) => Math.round(g.x))).toEqual([560]);
  });

  it('Scenario: Tope lleno (300 gemas lejos: mismos ids y nada nuevo)', () => {
    const gems = Array.from({ length: 300 }, () => ({ x: 20, y: 20, value: 1 }));
    const enemies = [{ type: 'goblin-torch', x: 560, y: 270, health: 4 }];
    const r = run(config([TESTS]), { gems, enemies });
    const before = r.snapshot().gems.map((g) => g.id);
    const [first] = ticks(r, 1);
    expect(first?.enemies).toEqual([]);
    expect(first?.gems.map((g) => g.id)).toEqual(before);
  });
});

const right = PlayerInput.of(1, 0);

describe('Paso de gemas en el tick (tras el contacto)', () => {
  it('Scenario: Recogida de una gema (valor 1 a 20 px: XP 1)', () => {
    const [first] = ticks(run(config([]), { gems: [{ x: 500, y: 270, value: 1 }] }), 1);
    expect(first?.gems).toEqual([]);
    expect(first?.progression.xp).toBe(1);
  });

  it('Scenario: Gema de una baja junto al jugador (se crea, se atrae y se recoge en el tick n)', () => {
    const enemies = [{ type: 'goblin-torch', x: 490, y: 270, health: 4 }];
    const [first] = ticks(run(config([TESTS]), { enemies }), 1);
    expect(first?.enemies).toEqual([]);
    expect(first?.gems).toEqual([]);
    expect(first?.progression.xp).toBe(1);
  });

  it('Scenario: El imán usa la posición del jugador ya movido (distancia 56,667)', () => {
    const [first] = ticks(run(config([]), { gems: [{ x: 546, y: 270, value: 1 }] }), 1, right);
    const gem = first?.gems[0];
    expect((gem?.x ?? 0) - (first?.player.x ?? 0)).toBeCloseTo(56.667, 3);
  });

  it('Scenario: Enemigos encima de una gema (ni la gema ni la persecución cambian)', () => {
    const enemies = [{ type: 'probe', x: 800, y: 270 }];
    const types = [aProbeType({ health: 1e6 })];
    const c = config([], { types });
    const withGem = ticks(run(c, { enemies, gems: [{ x: 700, y: 270, value: 1 }] }), 150);
    const without = ticks(run(c, { enemies }), 150);
    expect(withGem.map((s) => s.enemies)).toEqual(without.map((s) => s.enemies));
    expect(withGem.at(-1)?.gems).toMatchObject([{ id: 0, x: 700, y: 270, radius: 5 }]);
  });

  it('Scenario: Muerte y subida de nivel en el mismo tick (terminada, nivel 1, XP 4, gema)', () => {
    const types = [aProbeType({ damage: 10, health: 1e6 })];
    const c = config([], { types, maxHealth: 10 });
    const setup = {
      enemies: [{ type: 'probe', x: 480, y: 270 }],
      gems: [{ x: 480, y: 270, value: 1 }],
      experience: { level: 1, xp: 4 },
    };
    const [first] = ticks(run(c, setup), 1);
    expect(first?.status).toBe('over');
    expect(first?.player.health).toBe(0);
    expect(first?.offer).toEqual([]);
    expect(first?.progression).toMatchObject({ level: 1, xp: 4 });
    expect(first?.gems).toHaveLength(1);
  });

  it('Scenario: Gemas congeladas al terminar (gema atraída a 30 px)', () => {
    const types = [aProbeType({ damage: 10, health: 1e6 })];
    const c = config([], { types, maxHealth: 10 });
    const setup = {
      enemies: [{ type: 'probe', x: 480, y: 270 }],
      gems: [{ x: 510, y: 270, value: 1, attracted: true }],
    };
    const r = run(c, setup);
    const [first] = ticks(r, 1);
    const later = ticks(r, 600, PlayerInput.of(1, 1)).at(-1);
    expect(first?.status).toBe('over');
    expect(later?.gems).toEqual(first?.gems);
    expect(later?.progression).toEqual(first?.progression);
    expect(later?.offer).toEqual([]);
  });

  it('Scenario: Las gemas no consumen azar (10 gemas más, mismo azar tras el tick)', () => {
    const c = {
      ...config([]),
      waves: aContactConfig({ segments: [aSegment(['goblin-torch'], 5)] }).waves,
    };
    const gems = Array.from({ length: 10 }, (_, i) => ({ x: 20 + i, y: 20, value: 1 }));
    const a = new CountingRandom(new Mulberry32RandomGenerator(9));
    const b = new CountingRandom(new Mulberry32RandomGenerator(9));
    const ra = startRun(c, {}, a);
    const rb = startRun(c, { gems }, b);
    ticks(ra, 400);
    ticks(rb, 400);
    expect(a.calls).toBeGreaterThan(0);
    expect(b.calls).toBe(a.calls);
    expect(rb.snapshot().enemies).toEqual(ra.snapshot().enemies);
  });
});

describe('XP de cada tipo al recoger su gema', () => {
  /** El tipo muere en el pulso del tick 1 a 80 px; el jugador va a por la gema. */
  function xpOf(types: ReturnType<typeof still>[], type: string): number {
    const enemies = [{ type, x: 560, y: 270, health: 4 }];
    const snaps = ticks(run(config([TESTS], { types }), { enemies }), 20, right);
    expect(snaps[0]?.gems).toHaveLength(1);
    expect(snaps.at(-1)?.gems).toEqual([]);
    return snaps.at(-1)?.progression.xp ?? -1;
  }

  it.each([
    ['goblin-torch', 1],
    ['goblin-barrel', 2],
    ['goblin-tnt', 4],
  ])('Scenario: Valor según el tipo (%s: %s XP)', (type, xp) => {
    expect(xpOf(STILL_TYPES, type)).toBe(xp);
  });

  it('Scenario: Valores de cada tipo llegan al dominio (bug con xp 3: gema de 3 XP)', () => {
    expect(xpOf([still('goblin-torch', 3)], 'goblin-torch')).toBe(3);
  });

  it('Scenario: Tope lleno (al recoger la más antigua suma 2 de XP)', () => {
    const gems = [
      { x: 480, y: 100, value: 1 },
      ...Array.from({ length: 299 }, () => ({ x: 20, y: 20, value: 1 })),
    ];
    const enemies = [{ type: 'goblin-torch', x: 560, y: 270, health: 4 }];
    const r = run(config([TESTS]), { gems, enemies });
    ticks(r, 1);
    const snaps = ticks(r, 40, PlayerInput.of(0, -1));
    const picked = snaps.find((s) => s.gems.length === 299);
    expect(picked?.progression.xp).toBe(2);
  });

  it('Scenario: Varias bajas con el tope lleno (maxGems 1: g1 suma 1 + 1 + 2 + 4 = 8)', () => {
    const enemies = [
      { type: 'goblin-torch', x: 560, y: 270, health: 4 },
      { type: 'goblin-barrel', x: 400, y: 270, health: 4 },
      { type: 'goblin-tnt', x: 480, y: 190, health: 4 },
    ];
    const gems = [{ x: 480, y: 100, value: 1 }];
    const r = run(config([TESTS], { maxGems: 1 }), { gems, enemies });
    const [first] = ticks(r, 1);
    expect(first?.gems.map((g) => g.id)).toEqual([0]);
    const end = ticks(r, 40, PlayerInput.of(0, -1)).at(-1);
    expect(end?.gems).toEqual([]);
    expect(end?.progression).toMatchObject({ level: 2, xp: 3 });
  });
});
