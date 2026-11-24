import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  DEFAULT_HAZARDS,
  SCENARIO_ENEMY_TYPES,
  aBarrelType,
  aDynamite,
  aSegment,
  aStillType,
  aTntType,
  anUpgrade,
  inState,
  withDuration,
  withUpgrades,
  withWeapons,
} from '../support/builders';
import { aBehaviorConfig, enemyById, startRun, ticks } from '../support/runs';
import { aLinter, weaponsOf } from '../support/weapons';

// Orden del tick con peligros (simulation-loop): armas y su removeDead → explosiones → removeDead
// de peligros → lanzamientos → golpe único. Mapa vacío; jugador de radio 16 en (1.000, 1.000).

const P = { x: 1000, y: 1000 };

const at = (snaps: readonly RunSnapshot[], k: number): RunSnapshot => {
  const s = snaps[k - 1];
  if (!s) throw new Error(`sin snapshot del tick ${String(k)}`);
  return s;
};

const TORCH = aStillType({ id: 'goblin-torch', health: 10, xp: 1 });
const config = (
  o: Parameters<typeof aBehaviorConfig>[1] = {},
  extra: RunConfig['enemies']['types'] = [],
) => aBehaviorConfig([TORCH, aBarrelType(), aTntType(), ...extra], o);
const run = (setup: RunSetup, c: RunConfig = config()) => startRun(c, { player: P, ...setup });

/** Con el Linter de contenido, primer tick en que la vida del enemigo 0 baja (sondeo). */
function firstHit(c: RunConfig, setup: RunSetup): number {
  const snaps = ticks(run(setup, c), 120);
  const k = snaps.findIndex(
    (s) => (s.enemies[0]?.health ?? 0) < (snaps[0]?.enemies[0]?.health ?? 0),
  );
  if (k < 0) throw new Error('el Linter no impacta');
  return k + 1;
}

const LINTER = weaponsOf([aLinter()]);

describe('Bajas por explosión y orden del tick', () => {
  it('Scenario: Fuego amigo que mata', () => {
    const victim = aStillType({ id: 'victim', health: 50, xp: 3 });
    const s = at(
      ticks(
        run(
          {
            enemies: [{ type: 'victim', ...P, health: 20 }],
            kills: 5,
            dynamites: [aDynamite({ x: 1020, y: 1000 }, 3)],
          },
          config({ player: { maxHealth: 1e6 } }, [victim]),
        ),
        3,
      ),
      3,
    );
    expect(s.enemies).toEqual([]);
    expect(s.kills).toBe(6);
    // Su gema nace bajo el jugador y se recoge en el paso de gemas del mismo tick: su XP (3) entra.
    expect(s.progression.xp).toBe(3);
  });

  it('Scenario: La dinamita sigue tras morir su lanzador', () => {
    const tnt = { x: 1300, y: 1000 };
    const snaps = ticks(
      run(
        {
          enemies: [{ type: 'goblin-tnt', ...tnt, ...inState('aim', 19) }],
          dynamites: [aDynamite(tnt, 6, { radius: 10, damage: 100 })],
        },
        config({ player: { maxHealth: 1e6 } }),
      ),
      41,
    );
    expect(at(snaps, 1).dynamites.map((d) => d.id)).toEqual([0, 1]);
    expect(at(snaps, 6).enemies).toEqual([]);
    for (let k = 6; k <= 40; k++) expect(at(snaps, k).dynamites.map((d) => d.id)).toEqual([1]);
    expect(at(snaps, 41).dynamites).toEqual([]);
    expect(at(snaps, 41).blasts.at(-1)).toMatchObject({ x: 1000, y: 1000, tick: 41 });
  });

  it('Scenario: Baja por explosión ajena', () => {
    const X = { x: 1200, y: 1000 };
    const s = at(
      ticks(
        run({
          enemies: [{ type: 'goblin-torch', ...X }],
          dynamites: [aDynamite(X, 2, { damage: 25 })],
        }),
        2,
      ),
      2,
    );
    expect(s.enemies).toEqual([]);
    expect(s.kills).toBe(1);
    expect(s.gems).toMatchObject([{ x: 1200, y: 1000 }]);
  });

  it('Scenario: Armas y explosión en el mismo tick', () => {
    const X = { x: 1200, y: 1000 };
    const c = withWeapons(config(), LINTER);
    const h = firstHit(c, { enemies: [{ type: 'goblin-torch', ...X }] });
    const snaps = ticks(
      run(
        { enemies: [{ type: 'goblin-torch', ...X, health: 4 }], dynamites: [aDynamite(X, h)] },
        c,
      ),
      h,
    );
    const s = at(snaps, h);
    expect(at(snaps, h - 1).enemies).toHaveLength(1);
    expect(s.blasts).toHaveLength(1);
    expect([s.enemies.length, s.kills, s.gems.length]).toEqual([0, 1, 1]);
  });

  it('Scenario: Bajas por armas y por explosión en el mismo tick (los dos órdenes)', () => {
    const near = { x: 1200, y: 1000 };
    const far = { x: 1000, y: 1350 };
    const c = withWeapons(config(), LINTER);
    const h = firstHit(c, { enemies: [{ type: 'goblin-torch', ...near }] });
    const gemsOf = (first: { x: number; y: number }, second: { x: number; y: number }) => {
      const byLinter = first === near ? 0 : 1;
      const health = (i: number) => (i === byLinter ? 4 : 10);
      const s = at(
        ticks(
          run(
            {
              enemies: [
                { type: 'goblin-torch', ...first, health: health(0) },
                { type: 'goblin-torch', ...second, health: health(1) },
              ],
              dynamites: [aDynamite(far, h, { radius: 10 })],
            },
            c,
          ),
          h,
        ),
        h,
      );
      return s.gems.map((g) => [g.id, g.x, g.y]);
    };
    // A antes en la lista y abatido por el Linter: su gema primero.
    expect(gemsOf(near, far)).toEqual([
      [0, 1200, 1000],
      [1, 1000, 1350],
    ]);
    // A abatido por la explosión y B por el Linter: la de B primero.
    expect(gemsOf(far, near)).toEqual([
      [0, 1200, 1000],
      [1, 1000, 1350],
    ]);
  });

  it('Scenario: Un enemigo muerto por explosión no golpea en ese tick', () => {
    const biter = aStillType({ id: 'biter', damage: 5, health: 10 });
    const s = at(
      ticks(
        run(
          {
            enemies: [{ type: 'biter', x: 1020, y: 1000 }],
            dynamites: [aDynamite({ x: 1050, y: 1000 }, 1, { radius: 25, damage: 25 })],
          },
          config({}, [biter]),
        ),
        1,
      ),
      1,
    );
    expect([s.enemies.length, s.kills, s.player.health]).toEqual([0, 1, 100]);
  });

  it('Scenario: Lanzamiento con la posición del jugador ya movido', () => {
    const r = run({ enemies: [{ type: 'goblin-tnt', x: 1300, y: 1000, ...inState('aim', 19) }] });
    r.tick(PlayerInput.of(0, 1));
    const [d] = r.snapshot().dynamites;
    expect(d?.targetX).toBe(1000);
    expect(d?.targetY).toBeCloseTo(1003.5, 3);
  });

  it('Scenario: La explosión de la victoria', () => {
    const r = run({ dynamites: [aDynamite(P, 120, { damage: 20 })] }, withDuration(config(), 2));
    const s = at(ticks(r, 120), 120);
    expect([s.player.health, s.status, s.outcome]).toEqual([80, 'over', 'won']);
  });

  it('Scenario: TNT abatido durante la carga no lanza', () => {
    const X = { x: 1150, y: 1000 };
    const c = withWeapons(config(), LINTER);
    const h = firstHit(c, { enemies: [{ type: 'goblin-tnt', ...X, ...inState('aim') }] });
    const r = run(
      { enemies: [{ type: 'goblin-tnt', ...X, health: 6, ...inState('aim', 20 - h) }] },
      c,
    );
    const snaps = ticks(r, h);
    expect(at(snaps, h - 1).enemies[0]?.stateKind).toBe('charge');
    expect(at(snaps, h).dynamites).toEqual([]);
    expect(at(snaps, h).enemies).toEqual([]);
  });
});

describe('Daño por contacto opcional (enemy-spawning)', () => {
  it('Scenario: Daño ausente (un goblin-torch sin damage en contacto 60 ticks no golpea)', () => {
    const base = SCENARIO_ENEMY_TYPES.find((t) => t.id === 'goblin-torch');
    if (!base) throw new Error('sin goblin-torch');
    const { damage: _unused, ...harmless } = { ...base, health: 1e6 };
    expect(_unused).toBe(5);
    const r = startRun(aBehaviorConfig([harmless]), {
      player: P,
      enemies: [{ type: 'goblin-torch', ...P }],
    });
    expect(ticks(r, 60).every((s) => s.player.health === 100 && s.enemies.length === 1)).toBe(true);
  });
});

describe('Mechas que explotan a la vez y gemas', () => {
  const barrelChase = (extra: RunSetup = {}) =>
    run({ enemies: [{ type: 'goblin-barrel', x: 1100, y: 1000 }], ...extra });

  it('Scenario: Barril que explota con otro goblin dentro', () => {
    const snaps = ticks(
      barrelChase({
        enemies: [
          { type: 'goblin-barrel', x: 1100, y: 1000 },
          { type: 'goblin-torch', x: 1039.333, y: 1030 },
        ],
      }),
      82,
    );
    const s = at(snaps, 82);
    expect(s.enemies).toEqual([]);
    expect(s.kills).toBe(2);
    expect(s.gems.map((g) => g.id)).toEqual([0, 1]);
    expect(s.gems[0]?.y).toBe(1000);
    expect(s.gems[1]?.y).toBe(1030);
  });

  it('Scenario: Dos barriles que explotan a la vez', () => {
    const s = at(
      ticks(
        run({
          enemies: [
            { type: 'goblin-barrel', x: 1500, y: 1000, ...inState('fuse', 29) },
            { type: 'goblin-barrel', x: 1530, y: 1000, ...inState('fuse', 29) },
          ],
        }),
        1,
      ),
      1,
    );
    expect(s.blasts).toHaveLength(2);
    expect([s.kills, s.gems.length, s.enemies.length]).toEqual([2, 2, 0]);
  });

  it('Scenario: El barril que explota suelta su gema (en P, valor 2)', () => {
    const at1 = { x: 1500, y: 1000 };
    const r = run({ enemies: [{ type: 'goblin-barrel', ...at1, ...inState('fuse', 29) }] });
    const s = at(ticks(r, 1), 1);
    expect(s.gems).toMatchObject([at1]);
    // Valor 2: al llevar al jugador hasta ella, la XP sube 2.
    const moved = startRun(config({ player: { pickupRadius: 600 } }), {
      player: P,
      enemies: [{ type: 'goblin-barrel', ...at1, ...inState('fuse', 29) }],
    });
    const after = ticks(moved, 120).at(-1);
    expect(after?.progression.xp).toBe(2);
  });
});

describe('Bajas antes del estallido y sin cadenas', () => {
  /** Barril del escenario base con un Linter (radio 40, daño 10, cadencia `cooldown`). */
  const linterBarrel = (cooldown: number) =>
    startRun(
      withWeapons(
        config(),
        weaponsOf([
          aLinter({
            damage: 10,
            cooldownTicks: cooldown,
            targeting: { mode: 'nearest-in-range', range: 40 },
          }),
        ]),
      ),
      { player: P, enemies: [{ type: 'goblin-barrel', x: 1100, y: 1000 }] },
    );

  it('Scenario: Barril abatido durante la mecha no explota', () => {
    const snaps = ticks(linterBarrel(15), 120);
    expect(at(snaps, 69).enemies[0]?.stateKind).toBe('fuse');
    const s70 = at(snaps, 70);
    expect([s70.enemies.length, s70.warnings.length, s70.kills, s70.gems.length]).toEqual([
      0, 0, 1, 1,
    ]);
    expect(snaps.slice(69).every((s) => s.blasts.length === 0 && s.player.health === 100)).toBe(
      true,
    );
  });

  it('Scenario: Barril abatido en el mismo tick en que terminaría la mecha', () => {
    const snaps = ticks(linterBarrel(27), 82);
    expect(at(snaps, 81).enemies[0]?.stateKind).toBe('fuse');
    const s = at(snaps, 82);
    expect([s.blasts.length, s.player.health, s.kills, s.gems.length]).toEqual([0, 100, 1, 1]);
  });

  it('Scenario: Las armas actúan antes que la mecha', () => {
    const X = { x: 1039.333, y: 1000 };
    const c = withWeapons(config(), LINTER);
    const h = firstHit(c, { enemies: [{ type: 'goblin-barrel', ...X, ...inState('fuse') }] });
    const r = run(
      { enemies: [{ type: 'goblin-barrel', ...X, health: 4, ...inState('fuse', 30 - h) }] },
      c,
    );
    const s = at(ticks(r, h), h);
    expect([s.blasts.length, s.player.health, s.kills]).toEqual([0, 100, 1]);
  });

  it('Scenario: Explosión sobre una dinamita en vuelo', () => {
    const snaps = ticks(
      run({
        player: { x: 2000, y: 1000 },
        dynamites: [
          aDynamite(P, 5, { radius: 100 }),
          aDynamite({ x: 1020, y: 1000 }, 25, { from: { x: 1010, y: 1000 } }),
        ],
      }),
      25,
    );
    for (let k = 5; k <= 24; k++) {
      expect(at(snaps, k).dynamites).toMatchObject([{ id: 1, targetX: 1020, explodesAt: 25 }]);
    }
    expect(at(snaps, 25).dynamites).toEqual([]);
    expect(at(snaps, 25).blasts.at(-1)).toMatchObject({ x: 1020, tick: 25 });
  });

  it('Scenario: Explosión sobre un barril en mecha que sobrevive', () => {
    const tough = aBarrelType({ id: 'tough', health: 50 });
    const B = { x: 1500, y: 1000 };
    const snaps = ticks(
      run(
        {
          enemies: [{ type: 'tough', ...B, ...inState('fuse', 20) }],
          dynamites: [aDynamite(B, 5, { damage: 25 })],
        },
        config({}, [tough]),
      ),
      10,
    );
    expect(at(snaps, 5).enemies[0]).toMatchObject({ health: 25, stateKind: 'fuse' });
    expect(at(snaps, 9).enemies).toHaveLength(1);
    expect(at(snaps, 10).enemies).toEqual([]);
    expect(at(snaps, 10).blasts.map((b) => b.tick)).toEqual([5, 10]);
  });

  it('Scenario: Explosión que abate a un barril en mecha', () => {
    const B = { x: 1500, y: 1000 };
    const snaps = ticks(
      run({
        enemies: [{ type: 'goblin-barrel', ...B, ...inState('fuse', 20) }],
        dynamites: [aDynamite(B, 5, { damage: 25 })],
      }),
      15,
    );
    expect([at(snaps, 5).enemies.length, at(snaps, 5).kills, at(snaps, 5).gems.length]).toEqual([
      0, 1, 1,
    ]);
    expect(snaps.slice(5).every((s) => s.blasts.every((b) => b.tick === 5))).toBe(true);
  });

  it('Scenario: Dos lanzadores con tope 1', () => {
    const c = config({ hazards: { maxDynamites: 1 } });
    const r = run(
      {
        enemies: [
          { type: 'goblin-tnt', x: 1300, y: 1000, ...inState('aim', 19) },
          { type: 'goblin-tnt', x: 700, y: 1000, ...inState('aim', 19) },
        ],
      },
      c,
    );
    const snaps: RunSnapshot[] = [];
    for (let k = 1; k <= 41; k++) {
      r.tick(PlayerInput.of(0, 1));
      snaps.push(r.snapshot());
    }
    expect(at(snaps, 1).dynamites.map((d) => d.id)).toEqual([0]);
    for (let k = 1; k <= 40; k++) {
      expect(enemyById(at(snaps, k), 1)).toMatchObject({ x: 700, stateKind: 'charge' });
    }
    const s41 = at(snaps, 41);
    expect(s41.blasts.map((b) => b.tick)).toEqual([41]);
    expect(s41.dynamites).toMatchObject([{ id: 1, targetX: 1000, targetY: s41.player.y }]);
    expect(enemyById(s41, 1).stateKind).toBe('wait');
  });

  it('Scenario: Tope por defecto alcanzado', () => {
    const many = Array.from({ length: DEFAULT_HAZARDS.maxDynamites + 10 }, (_, i) => ({
      type: 'goblin-tnt',
      x: 400 + 100 * (i % 30),
      y: 300 + 1400 * Math.floor(i / 30),
      ...inState('aim', 19),
    }));
    const snaps = ticks(run({ enemies: many }, config({ player: { maxHealth: 1e9 } })), 600);
    expect(Math.max(...snaps.map((s) => s.dynamites.length))).toBe(DEFAULT_HAZARDS.maxDynamites);
  });
});

describe('Bajas y hueco del director', () => {
  it('Scenario: Explosión letal para el jugador y para el barril', () => {
    const near = { x: 1030, y: 1000 };
    const s = at(
      ticks(
        run(
          { kills: 3, enemies: [{ type: 'goblin-barrel', ...near, ...inState('fuse', 29) }] },
          config({ player: { maxHealth: 20 } }),
        ),
        1,
      ),
      1,
    );
    expect([s.status, s.outcome, s.player.health, s.kills]).toEqual(['over', 'lost', 0, 4]);
    expect(s.gems).toMatchObject([near]);
  });

  it('Scenario: Una explosión que mata a varios', () => {
    const B = { x: 1500, y: 1000 };
    const s = at(
      ticks(
        run({
          enemies: [
            { type: 'goblin-barrel', ...B, ...inState('fuse', 29) },
            { type: 'goblin-torch', x: 1510, y: 1000 },
            { type: 'goblin-torch', x: 1490, y: 1000 },
            { type: 'goblin-torch', x: 1500, y: 1020 },
          ],
        }),
        1,
      ),
      1,
    );
    expect(s.kills).toBe(4);
  });

  it('Scenario: La explosión libera hueco para el director (y se repone en el mismo tick)', () => {
    const torch = SCENARIO_ENEMY_TYPES.find((t) => t.id === 'goblin-torch');
    if (!torch) throw new Error('sin goblin-torch');
    const c = aBehaviorConfig([torch, aBarrelType()], {
      maxAlive: 1,
      segments: [aSegment(['goblin-torch'], 60)],
    });
    const r = startRun(c, {
      player: P,
      enemies: [{ type: 'goblin-barrel', x: 1500, y: 1000, ...inState('fuse', 29) }],
    });
    const s = r.snapshot();
    expect(s.enemies.map((e) => e.type)).toEqual(['goblin-barrel']);
    const [s1] = ticks(r, 1);
    expect(s1?.enemies.map((e) => e.type)).toEqual(['goblin-torch']);
    expect(s1?.enemies[0]?.id).not.toBe(0);
  });
});

describe('Congelación y determinismo de los peligros', () => {
  it('Scenario: Peligros congelados al terminar', () => {
    const r = run(
      {
        enemies: [
          { type: 'goblin-barrel', x: 1500, y: 1000, ...inState('fuse', 26) },
          { type: 'goblin-tnt', x: 500, y: 1000, ...inState('aim') },
        ],
        dynamites: [aDynamite(P, 1, { damage: 25 }), aDynamite({ x: 1200, y: 1000 }, 6)],
      },
      config({ player: { maxHealth: 20 } }),
    );
    const [ended] = ticks(r, 1);
    expect(ended?.outcome).toBe('lost');
    expect(ended?.blasts).toHaveLength(1);
    expect(ended?.dynamites).toHaveLength(1);
    expect(ended?.warnings).toHaveLength(2);
    ticks(r, 600, PlayerInput.of(1, 1));
    expect(r.snapshot()).toEqual(ended);
  });

  it('Scenario: Peligros en pausa durante la oferta', () => {
    const c = withUpgrades(config(), { upgrades: [anUpgrade('guardrail')] });
    const r = run(
      {
        experience: { level: 1, xp: 4 },
        gems: [{ ...P, value: 1 }],
        enemies: [{ type: 'goblin-barrel', x: 1500, y: 1000, ...inState('fuse', 25) }],
        dynamites: [aDynamite({ x: 1200, y: 1000 }, 11)],
      },
      c,
    );
    const [open] = ticks(r, 1);
    expect(open?.status).toBe('choosing');
    ticks(r, 600, PlayerInput.of(1, 1));
    expect(r.snapshot()).toEqual(open);
    expect(r.chooseUpgrade(0).ok).toBe(true);
    const after = ticks(r, 10);
    expect(at(after, 3).enemies).toHaveLength(1);
    expect(at(after, 4).enemies).toEqual([]);
    expect(at(after, 4).blasts.map((b) => b.tick)).toEqual([5]);
    expect(at(after, 9).dynamites).toHaveLength(1);
    expect(at(after, 10).dynamites).toEqual([]);
    expect(at(after, 10).blasts.map((b) => b.tick)).toEqual([5, 11]);
  });

  const randomAfter = (setup: RunSetup): number => {
    const random = new Mulberry32RandomGenerator(7);
    const r = startRun(config(), { player: P, ...setup }, random);
    r.tick(PlayerInput.NONE);
    return random.next();
  };

  it('Scenario: Los peligros no consumen azar', () => {
    const quiet = randomAfter({});
    const busy = randomAfter({
      enemies: [
        { type: 'goblin-barrel', x: 1500, y: 1000, ...inState('fuse', 29) },
        { type: 'goblin-barrel', x: 500, y: 1500, ...inState('fuse', 29) },
      ],
      dynamites: [
        aDynamite(P, 1),
        aDynamite({ x: 1300, y: 1300 }, 1),
        aDynamite({ x: 700, y: 700 }, 1),
      ],
    });
    expect(busy).toBe(quiet);
  });

  it('Scenario: Los comportamientos no consumen azar', () => {
    const changing = Array.from({ length: 10 }, (_, i) => {
      const kind = i % 3;
      if (kind === 0) return { type: 'goblin-barrel', x: 1030 + i, y: 1000 };
      if (kind === 1) return { type: 'goblin-tnt', x: 1150, y: 900 + 20 * i };
      return { type: 'goblin-tnt', x: 1700, y: 1000 + 10 * i, ...inState('reload', 59) };
    });
    const chasing = changing.map((e) => ({ type: 'goblin-torch-chase', x: e.x + 800, y: e.y }));
    const chaser = {
      ...TORCH,
      id: 'goblin-torch-chase',
      behavior: { initial: 'c', states: [{ name: 'c', kind: 'chase' as const }] },
    };
    const random = (enemies: RunSetup['enemies'], c: RunConfig) => {
      const g = new Mulberry32RandomGenerator(7);
      const r = startRun(c, { player: P, ...(enemies ? { enemies } : {}) }, g);
      const before = r.snapshot();
      r.tick(PlayerInput.NONE);
      return [g.next(), r.snapshot(), before] as const;
    };
    const [a, sa, s0] = random(changing, config());
    const [b] = random(chasing, config({}, [chaser]));
    const changed = sa.enemies.filter((e, i) => e.state !== s0.enemies[i]?.state);
    expect(changed).toHaveLength(10);
    expect(a).toBe(b);
  });

  it('Scenario: Snapshot no mutable desde fuera (dinamitas, avisos, explosiones y estado)', () => {
    const r = run({
      enemies: [{ type: 'goblin-barrel', x: 1500, y: 1000, ...inState('fuse') }],
      dynamites: [aDynamite(P, 1), aDynamite({ x: 1200, y: 1000 }, 20)],
    });
    ticks(r, 1);
    const snap = r.snapshot();
    const before = structuredClone(snap);
    const mutations = [
      () => ((snap.dynamites[0] as { x: number }).x = 0),
      () => ((snap.dynamites[0] as { targetX: number }).targetX = 0),
      () => ((snap.warnings[0] as { radius: number }).radius = 0),
      () => ((snap.warnings[0] as { x: number }).x = 0),
      () => (snap.blasts as unknown[]).push({}),
      () => ((snap.enemies[0] as { state: string }).state = 'x'),
      () => ((snap.enemies[0] as { stateKind: string }).stateKind = 'wait'),
    ];
    for (const m of mutations) expect(m).toThrow(TypeError);
    expect(r.snapshot()).toEqual(before);
    r.tick(PlayerInput.NONE);
    expect(r.snapshot().dynamites[0]?.targetX).toBe(1200);
  });
});
