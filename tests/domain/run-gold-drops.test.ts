import { describe, expect, it } from 'vitest';
import type { RunSetup } from '../../src/domain/run/Run';
import { buildRunRules, type RunConfig } from '../../src/domain/run/RunConfig';
import type { PickupSnapshot, RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { RESOURCE_GOLD_PER_KILL_INVALID } from '../../src/domain/resource/ResourceRules';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  CONTENT_RESOURCES,
  aBarrelType,
  aDefaultConfig,
  aDynamite,
  aStillType,
  withDrops,
  withGoldPerKill,
  withWeapons,
} from '../support/builders';
import { HOUSE_AT_20_10, aCampScenario, startDeclared } from '../support/camps';
import { CountingRandom } from '../support/random';
import { aBehaviorConfig, startRun, ticks } from '../support/runs';
import { aLinter, aPulse, weaponsOf } from '../support/weapons';

// Spec resources (0024), "Oro por enemigo abatido", y simulation-loop, paso 3.3. Mapa vacío, sin
// oleadas; jugador de radio 16 con radio de recogida 1 en (1.000, 1.000).

const P = { x: 1000, y: 1000 };
const TORCH = aStillType({ id: 'goblin-torch', health: 10, xp: 1 });
const TNT = aStillType({ id: 'goblin-tnt', health: 4, xp: 2 });
const LINTER = weaponsOf([aLinter()]);
const PULSE = weaponsOf([aPulse()]);

const at = (snaps: readonly RunSnapshot[], k: number): RunSnapshot => {
  const s = snaps[k - 1];
  if (!s) throw new Error(`sin snapshot del tick ${String(k)}`);
  return s;
};
const drops = (s: RunSnapshot | undefined) =>
  (s?.pickups ?? []).map((p): [PickupSnapshot['kind'], number] => [p.kind, p.value]);
/** Primer tick (desde 1) sin enemigos vivos. */
const lastKill = (snaps: readonly RunSnapshot[]) => snaps.findIndex((s) => !s.enemies.length) + 1;

const config = (gold: Record<string, number>, weapons = LINTER): RunConfig =>
  withGoldPerKill(
    withDrops(withWeapons(aBehaviorConfig([TORCH, TNT, aBarrelType()]), weapons), { wood: 2 }),
    gold,
  );
const run = (c: RunConfig, setup: RunSetup) => startRun(c, { player: P, ...setup });

describe('Oro por enemigo abatido (resources 0024)', () => {
  it('Scenario: Oro de una baja por armas (gema y gold 2 en su punto, la gema antes)', () => {
    const r = run(config({ 'goblin-torch': 2 }), {
      enemies: [{ type: 'goblin-torch', x: 1200, y: 1000, health: 4 }],
    });
    const snaps = ticks(r, 120);
    const n = lastKill(snaps);
    const s = at(snaps, n);
    const [gem, gold] = s.pickups;

    expect(at(snaps, n - 1).pickups).toEqual([]);
    expect(drops(s)).toEqual([
      ['xp', 1],
      ['gold', 2],
    ]);
    expect([gold?.x, gold?.y]).toEqual([gem?.x, gem?.y]);
    expect((gem?.id ?? 0) < (gold?.id ?? 0)).toBe(true);
    expect(s.resources.gold).toBe(0);
  });

  it('Scenario: Orden con el barril abatido (gema, wood 2 y gold 3)', () => {
    const still = aBarrelType({ speed: 1e-6 });
    const c = withGoldPerKill(
      withDrops(withWeapons(aBehaviorConfig([TORCH, still]), LINTER), { wood: 2 }),
      { 'goblin-barrel': 3 },
    );
    const snaps = ticks(
      run(c, { enemies: [{ type: 'goblin-barrel', x: 1200, y: 1000, health: 4 }] }),
      120,
    );

    expect(drops(at(snaps, lastKill(snaps)))).toEqual([
      ['xp', 2],
      ['wood', 2],
      ['gold', 3],
    ]);
  });

  it('Scenario: El barril que explota no suelta oro (1 gema, ningún gold)', () => {
    const r = run(config({ 'goblin-barrel': 3 }), {
      enemies: [{ type: 'goblin-barrel', x: 1100, y: 1000 }],
    });
    const s = at(ticks(r, 82), 82);

    expect(s.blasts).toHaveLength(1);
    expect(drops(s).map(([kind]) => kind)).toEqual(['xp']);
  });

  it('Scenario: Baja por explosión ajena (torch de vida 10 y dinamita de 25: gema y gold 2)', () => {
    const T = { x: 1500, y: 1000 };
    const r = run(config({ 'goblin-torch': 2 }, weaponsOf([])), {
      enemies: [{ type: 'goblin-torch', ...T }],
      dynamites: [aDynamite(T, 5, { damage: 25 })],
    });
    const s = at(ticks(r, 5), 5);

    expect(s.enemies).toEqual([]);
    expect(drops(s)).toEqual([
      ['xp', 1],
      ['gold', 2],
    ]);
  });

  it('Scenario: Tipo sin oro (goblin-tnt 0: 1 gema y ningún gold)', () => {
    const r = run(config({ 'goblin-torch': 2, 'goblin-tnt': 0 }), {
      enemies: [{ type: 'goblin-tnt', x: 1200, y: 1000 }],
    });
    const snaps = ticks(r, 120);

    expect(drops(at(snaps, lastKill(snaps)))).toEqual([['xp', 2]]);
  });

  it('Scenario: El oro por baja no consume azar (0 frente al contenido, 3 bajas en el tick)', () => {
    const setup: RunSetup = {
      enemies: [
        { type: 'goblin-torch', x: 1040, y: 1000, health: 4 },
        { type: 'goblin-tnt', x: 960, y: 1000 },
        { type: 'goblin-torch', x: 1000, y: 1040, health: 4 },
      ],
    };
    const calls = (gold: Record<string, number>) => {
      const random = new CountingRandom(new Mulberry32RandomGenerator(7));
      const [s] = ticks(startRun(config(gold, PULSE), { player: P, ...setup }, random), 1);
      return { kills: s?.kills, calls: random.calls, next: random.next() };
    };
    const without = calls({});
    const withGold = calls({ 'goblin-torch': 2, 'goblin-tnt': 2 });

    expect(without.kills).toBe(3);
    expect(withGold).toEqual(without);
  });
});

describe('Tabla de oro por baja (dominio)', () => {
  const table = (goldPerKill: Record<string, number>): RunConfig => {
    const base = aDefaultConfig();
    return {
      ...base,
      resources: { ...base.resources, drops: { ...base.resources.drops, goldPerKill } },
    };
  };
  const failure = (c: RunConfig) => {
    const r = buildRunRules(c);
    if (r.ok) throw new Error('se esperaba un error');
    return r.error;
  };
  const complete = {
    'goblin-torch': 1,
    'goblin-tnt': 2,
    'goblin-barrel': 1,
    'goblin-tnt-guard': 2,
  };

  it('acepta la tabla completa del contenido', () => {
    expect(buildRunRules(table(complete)).ok).toBe(true);
  });

  it.each([
    [
      'falta goblin-tnt-guard',
      { 'goblin-torch': 1, 'goblin-tnt': 2, 'goblin-barrel': 1 },
      'goblin-tnt-guard',
    ],
    ['sobra goblin-ogre', { ...complete, 'goblin-ogre': 3 }, 'goblin-ogre'],
    ['goblin-torch −1', { ...complete, 'goblin-torch': -1 }, 'goblin-torch'],
    ['goblin-torch 1,5', { ...complete, 'goblin-torch': 1.5 }, 'goblin-torch'],
  ])('Scenario: Tabla de oro por baja inválida (%s)', (_name, goldPerKill, id) => {
    const e = failure(table(goldPerKill));

    expect(e.field).toBe(`resources.drops.goldPerKill.${id}`);
    expect(e.message).toContain(RESOURCE_GOLD_PER_KILL_INVALID);
    expect(e.message).toContain(id);
  });
});

describe('Oro de las estructuras por defecto (resources 0024)', () => {
  it('Scenario: Oro de estructuras por defecto (casa > 5, torre > 8; vetas sin cambios)', () => {
    const { structures } = CONTENT_RESOURCES.drops;

    expect(structures['goblin-house']?.gold ?? 0).toBeGreaterThan(5);
    expect(structures['goblin-tower']?.gold ?? 0).toBeGreaterThan(8);
    expect([CONTENT_RESOURCES.goldVeins.count, CONTENT_RESOURCES.goldVeins.gold]).toEqual([3, 10]);
  });

  it('el contenido por defecto da oro por baja ≥ 1 a algún tipo', () => {
    const gold = Object.values(CONTENT_RESOURCES.drops.goldPerKill ?? {});

    expect(gold.some((g) => g >= 1)).toBe(true);
  });
});

// Spec simulation-loop (0024), paso 3: bajas (gema y oro) antes que las estructuras.
describe('Oro de la baja en el paso de armas (simulation-loop)', () => {
  it('Scenario: Oro de la baja tras su gema en el paso de armas (gema, gold 2 y gold de la torre)', () => {
    const c = withGoldPerKill(
      withDrops(withWeapons(aCampScenario({ types: [TORCH], tower: { health: 4 } }), PULSE), {
        tower: 8,
      }),
      { 'goblin-torch': 2 },
    );
    const tower = { ...HOUSE_AT_20_10, type: 'goblin-tower' };
    const r = startDeclared(c, [tower], {
      player: { x: 1260, y: 760 },
      enemies: [{ type: 'goblin-torch', x: 1300, y: 760, health: 4 }],
    });
    const [s] = ticks(r, 1);

    expect(s?.structures[0]).toMatchObject({ destroyed: true });
    expect(drops(s)).toEqual([
      ['xp', 1],
      ['gold', 2],
      ['gold', 8],
    ]);
  });
});
