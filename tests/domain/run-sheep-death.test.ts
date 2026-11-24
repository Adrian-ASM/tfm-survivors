import { describe, expect, it } from 'vitest';
import type { DeclaredStructure } from '../../src/domain/map/TerrainSource';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import {
  LINTER,
  aBarrelType,
  aDynamite,
  aStillType,
  withDrops,
  withSheep,
  withWeapons,
} from '../support/builders';
import { aCampScenario, startOn } from '../support/camps';
import { aBehaviorConfig, ticks } from '../support/runs';
import { SHEEP_AT, aSheepConfig, sheepRandom, startWithSheep } from '../support/sheep';
import { aPulse, weaponsOf } from '../support/weapons';

const linter = (base = aSheepConfig()) => withWeapons(base, weaponsOf([LINTER]));
const pulse = (base: RunConfig, damage = 4) => withWeapons(base, weaponsOf([aPulse({ damage })]));

/** Recogibles de un snapshot creados después de los del snapshot anterior (por id). */
const fresh = (before: RunSnapshot | undefined, after: RunSnapshot | undefined) => {
  const last = Math.max(-1, ...(before?.pickups ?? []).map((p) => p.id));
  return (after?.pickups ?? []).filter((p) => p.id > last).map((p) => p.kind);
};

/** Escena con estructuras declaradas y ovejas en el mapa vacío (contenido de `aCampScenario`). */
function scene(
  config: RunConfig,
  sheep: readonly { x: number; y: number }[],
  setup: RunSetup,
  structures: readonly DeclaredStructure[] = [],
) {
  return startOn(config, { kind: 'open', structures, sheep: { at: sheep, random: sheepRandom() } }, setup);
}

const TOWER = { type: 'goblin-tower', col: 20, row: 10, cols: 2, rows: 3 } as const;

/** Escenario de casas y torres con la oveja de prueba, la torre a vida 4 y drops de oro y madera. */
const camp = (types = [aStillType({ id: 'goblin-torch', health: 4 })]) => {
  const wood = types.some((t) => t.id === 'goblin-barrel') ? { wood: 2 } : {};
  return withDrops(withSheep(aCampScenario({ types, tower: { health: 4 } })), { tower: 8, ...wood });
};

// Spec sheep (0023), "Vida, daño y muerte de las ovejas".
describe('Muerte de las ovejas (spec sheep)', () => {
  it('Scenario: Dos impactos del Linter (vida 6 tras el primero; muere en el segundo sin baja ni XP)', () => {
    const run = startWithSheep(linter(), [SHEEP_AT], {
      player: { x: 1300, y: 1000 },
      kills: 5,
      experience: { level: 1, xp: 3 },
    });
    const snaps = ticks(run, 66);
    expect(snaps[35]?.sheep[0]).toMatchObject({ health: 6, damaged: true });
    const n = snaps[65];
    expect(n?.sheep).toEqual([]);
    expect(fresh(snaps[64], n)).toEqual(['meat']);
    expect([n?.kills, n?.progression.xp]).toEqual([5, 3]);
  });

  it('Scenario: Explosión que mata a una oveja (dinamita a 60 px: meat en su posición, sin bajas)', () => {
    const run = startWithSheep(aSheepConfig(), [SHEEP_AT], {
      dynamites: [aDynamite({ x: 1060, y: 1000 }, 5)],
    });
    const snaps = ticks(run, 5);
    expect(snaps[4]?.sheep).toEqual([]);
    expect(snaps[4]?.pickups.map((p) => [p.kind, p.x, p.y, p.value])).toEqual([
      ['meat', 1000, 1000, 1],
    ]);
    expect(snaps[4]?.kills).toBe(0);
  });

  it('Scenario: Explosión tangente (a 68 = 48 + 20: sigue con vida 12)', () => {
    const run = startWithSheep(aSheepConfig(), [SHEEP_AT], {
      dynamites: [aDynamite({ x: 1068, y: 1000 }, 5)],
    });
    expect(ticks(run, 5)[4]?.sheep[0]?.health).toBe(12);
  });

  it('Scenario: Armas y explosión en el mismo tick (muere en armas: 1 sola carne)', () => {
    const run = startWithSheep(linter(), [SHEEP_AT], {
      player: { x: 1300, y: 1000 },
      sheep: [{ health: 6 }],
      dynamites: [aDynamite({ x: 1040, y: 1000 }, 36)],
    });
    const snaps = ticks(run, 36);
    expect(snaps[34]?.sheep[0]?.health).toBe(6);
    expect(snaps[35]?.sheep).toEqual([]);
    expect(snaps[35]?.blasts).toHaveLength(1);
    expect(snaps[35]?.pickups.map((p) => p.kind)).toEqual(['meat']);
  });

  it('Scenario: Daño mayor que la vida (vida 4 y pulso de 10: 1 carne)', () => {
    const run = startWithSheep(pulse(aSheepConfig(), 10), [SHEEP_AT], {
      player: { x: 1050, y: 1000 },
      sheep: [{ health: 4 }],
    });
    const [s] = ticks(run, 1);
    expect(s?.sheep).toEqual([]);
    expect(s?.pickups.map((p) => p.kind)).toEqual(['meat']);
  });

  it('Scenario: Bajas solo de enemigos (oveja y goblin-torch de vida 4 en el pulso: bajas 5, gema y meat)', () => {
    const base = aSheepConfig();
    const torch = aStillType({ id: 'goblin-torch', health: 4 });
    const types = [...base.enemies.types.filter((t) => t.id !== 'goblin-torch'), torch];
    const config = pulse({ ...base, enemies: { ...base.enemies, types } });
    const run = startWithSheep(config, [{ x: 1000, y: 1060 }], {
      player: SHEEP_AT,
      kills: 4,
      sheep: [{ health: 4 }],
      enemies: [{ type: 'goblin-torch', x: 1050, y: 1000 }],
    });
    const [s] = ticks(run, 1);
    expect(s?.kills).toBe(5);
    expect(s?.pickups.map((p) => p.kind)).toEqual(['xp', 'meat']);
  });

  it('Scenario: Muerte sin reordenar (o2 muere: la lista es o1, o3)', () => {
    const run = startWithSheep(aSheepConfig(), [SHEEP_AT, { x: 1500, y: 600 }, { x: 600, y: 600 }], {
      dynamites: [aDynamite({ x: 1500, y: 600 }, 3)],
    });
    const snaps = ticks(run, 3);
    expect(snaps[1]?.sheep.map((o) => o.id)).toEqual([0, 1, 2]);
    expect(snaps[2]?.sheep.map((o) => o.id)).toEqual([0, 2]);
  });
});

// Spec resources (0023), "Carne de las ovejas abatidas".
describe('Carne de las ovejas abatidas (spec resources)', () => {
  it('Scenario: Carne en la posición de la oveja (1 meat de valor 1 en (1.000, 1.000), radio 5)', () => {
    const run = startWithSheep(linter(), [SHEEP_AT], {
      player: { x: 1300, y: 1000 },
      sheep: [{ health: 6 }],
    });
    const snaps = ticks(run, 36);
    expect(snaps[34]?.pickups).toEqual([]);
    expect(snaps[35]?.pickups.map(({ kind, value, x, y, radius }) => [kind, value, x, y, radius])).toEqual([
      ['meat', 1, 1000, 1000, 5],
    ]);
  });

  it('Scenario: Orden con bajas y estructuras en el paso de armas (gema, gold, meat o1, meat o2)', () => {
    const run = scene(
      pulse(camp()),
      [
        { x: 1200, y: 790 },
        { x: 1320, y: 790 },
      ],
      {
        player: { x: 1260, y: 790 },
        sheep: [{ health: 4 }, { health: 4 }],
        enemies: [{ type: 'goblin-torch', x: 1260, y: 840 }],
      },
      [TOWER],
    );
    const [s] = ticks(run, 1);
    expect(s?.pickups.map((p) => p.kind)).toEqual(['xp', 'gold', 'meat', 'meat']);
    expect(s?.pickups[2]?.x).toBeLessThan(1200);
    expect(s?.pickups[3]?.x).toBeGreaterThan(1320);
  });

  it('Scenario: Orden en el paso de peligros (la gema del goblin-torch y después el meat)', () => {
    const run = scene(camp(), [{ x: 1040, y: 1000 }], {
      player: { x: 2000, y: 1500 },
      sheep: [{ health: 4 }],
      enemies: [{ type: 'goblin-torch', x: 1000, y: 1040 }],
      dynamites: [aDynamite(SHEEP_AT, 3)],
    });
    const snaps = ticks(run, 3);
    expect(snaps[2]?.sheep).toEqual([]);
    expect(snaps[2]?.pickups.map((p) => p.kind)).toEqual(['xp', 'meat']);
  });

  it('Scenario: Carne recogida en su tick (pulso a 10 px: vida 50 → 70 en el tick n)', () => {
    const run = startWithSheep(pulse(aSheepConfig()), [{ x: 1010, y: 1000 }], {
      player: { ...SHEEP_AT, health: 50 },
      sheep: [{ health: 4 }],
    });
    const [s] = ticks(run, 1);
    expect(s?.sheep).toEqual([]);
    expect(s?.pickups).toEqual([]);
    expect(s?.player.health).toBe(70);
  });
});

// Spec enemy-hazards (0023), "Explosión de área".
describe('Explosiones y ovejas (spec enemy-hazards)', () => {
  it('Scenario: Oveja alcanzada que sobrevive (vida 30 a 60 px: 10, en pasto, sin recogibles)', () => {
    const run = startWithSheep(aSheepConfig({ health: 30 }), [SHEEP_AT], {
      dynamites: [aDynamite({ x: 1060, y: 1000 }, 5)],
    });
    const s = ticks(run, 5)[4];
    expect(s?.sheep[0]).toMatchObject({ health: 10, state: 'graze', x: 1000, y: 1000 });
    expect(s?.pickups).toEqual([]);
  });

  it('Scenario: Barril que explota junto a una oveja y un goblin (gema del barril, del torch y meat)', () => {
    // Oveja "quieta" (radio de huida 50): a 69 px del jugador no huye y sigue a 30 px del barril.
    const config = withSheep(
      aBehaviorConfig([aBarrelType(), aStillType({ id: 'goblin-torch', health: 10 })]),
      { flee: { radius: 50, speed: 180 } },
    );
    const run = scene(config, [{ x: 1069.333, y: 1000 }], {
      player: SHEEP_AT,
      enemies: [
        { type: 'goblin-barrel', x: 1100, y: 1000 },
        { type: 'goblin-torch', x: 1039.333, y: 1030 },
      ],
    });
    const snaps = ticks(run, 82);
    expect(snaps[80]?.sheep).toHaveLength(1);
    const s = snaps[81];
    expect(s?.kills).toBe(2);
    expect(s?.sheep).toEqual([]);
    expect(s?.pickups.map((p) => p.kind)).toEqual(['xp', 'xp', 'meat']);
  });
});

// Spec xp-gems y simulation-loop (0023).
describe('Carne en la secuencia de recogibles (spec xp-gems y simulation-loop)', () => {
  it('Scenario: Una secuencia de identificadores (xp torch, xp barril, wood barril, gold torre, meat)', () => {
    const barrel = aBarrelType({ health: 4 });
    const run = scene(
      pulse(camp([aStillType({ id: 'goblin-torch', health: 4 }), barrel])),
      [{ x: 1200, y: 790 }],
      {
        player: { x: 1260, y: 790 },
        sheep: [{ health: 4 }],
        enemies: [
          { type: 'goblin-torch', x: 1260, y: 840 },
          { type: 'goblin-barrel', x: 1300, y: 840 },
        ],
      },
      [TOWER],
    );
    const [s] = ticks(run, 1);
    expect(s?.pickups.map((p) => p.kind)).toEqual(['xp', 'xp', 'wood', 'gold', 'meat']);
    expect(new Set(s?.pickups.map((p) => p.id)).size).toBe(5);
  });

  it('Scenario: Tope de carne lleno (tope 2: m1 vale 2 y m2 1, mismos ids)', () => {
    const base = linter();
    const config = { ...base, progression: { ...base.progression, maxMeat: 2 } };
    const run = startWithSheep(config, [SHEEP_AT], {
      player: { x: 1300, y: 1000 },
      sheep: [{ health: 6 }],
      gems: [
        { kind: 'meat', x: 3000, y: 200, value: 1 },
        { kind: 'meat', x: 3000, y: 300, value: 1 },
      ],
    });
    const s = ticks(run, 36)[35];
    expect(s?.sheep).toEqual([]);
    expect(s?.pickups.map((p) => [p.id, p.kind, p.value])).toEqual([
      [0, 'meat', 2],
      [1, 'meat', 1],
    ]);
  });

  it('Scenario: Las ovejas mueren tras las estructuras (bajas 3; gema, gold de la torre y meat)', () => {
    const run = scene(
      pulse(camp()),
      [{ x: 1200, y: 790 }],
      {
        player: { x: 1260, y: 790 },
        kills: 2,
        sheep: [{ health: 4 }],
        enemies: [{ type: 'goblin-torch', x: 1260, y: 840 }],
      },
      [TOWER],
    );
    const [s] = ticks(run, 1);
    expect(s?.kills).toBe(3);
    expect(s?.sheep).toEqual([]);
    expect(s?.pickups.map((p) => p.kind)).toEqual(['xp', 'gold', 'meat']);
  });
});

