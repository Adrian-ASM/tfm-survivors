import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { aBarrelType, aDynamite, aStillType, aTntType, inState } from '../support/builders';
import { aBehaviorConfig, enemyById, startRun, ticks } from '../support/runs';

// Escenarios de enemy-behavior (barril y TNT), enemy-hazards (dinamita, aviso, explosión) y
// player-health (golpe único). Mapa vacío, sin armas; jugador de radio 16 en (1.000, 1.000).

const P = { x: 1000, y: 1000 };
const LEFT = PlayerInput.of(-1, 0);
const DOWN = PlayerInput.of(0, 1);

/** Snapshot del tick k (índice 0 = tick 1). */
const at = (snaps: readonly RunSnapshot[], k: number): RunSnapshot => {
  const s = snaps[k - 1];
  if (!s) throw new Error(`sin snapshot del tick ${String(k)}`);
  return s;
};

/** Ejecuta con un input por tick: `inputFor(k)` para el tick k. */
function play(run: ReturnType<typeof startRun>, n: number, inputFor: (k: number) => PlayerInput) {
  const snaps: RunSnapshot[] = [];
  for (let k = 1; k <= n; k++) {
    run.tick(inputFor(k));
    snaps.push(run.snapshot());
  }
  return snaps;
}

const barrelRun = (extra: Partial<RunSetup> = {}, maxHealth = 100) =>
  startRun(
    aBehaviorConfig([aBarrelType(), aStillType({ id: 'goblin-torch', health: 10 })], {
      player: { maxHealth },
    }),
    {
      player: P,
      enemies: [{ type: 'goblin-barrel', x: 1100, y: 1000 }],
      ...extra,
    },
  );

const tntRun = (types = [aTntType()]) =>
  startRun(aBehaviorConfig(types, { player: { maxHealth: 1e6 } }), {
    player: P,
    enemies: [{ type: 'goblin-tnt', x: 1300, y: 1000 }],
  });

describe('Kamikaze del Goblin Barril', () => {
  it('Scenario: Mecha y explosión con el jugador quieto', () => {
    const snaps = ticks(barrelRun(), 82);
    const s51 = at(snaps, 51);
    expect(s51.enemies[0]?.stateKind).toBe('chase');
    expect(s51.enemies[0]?.x).toBeCloseTo(1040.5, 3);
    for (let k = 52; k <= 81; k++) {
      const s = at(snaps, k);
      expect(s.enemies[0]?.stateKind).toBe('fuse');
      expect(s.enemies[0]?.x).toBeCloseTo(1039.333, 3);
      expect(s.player.health).toBe(100);
    }
    const s82 = at(snaps, 82);
    expect(s82.enemies).toEqual([]);
    expect(s82.blasts).toHaveLength(1);
    expect(s82.blasts[0]?.radius).toBe(56);
    expect(s82.blasts[0]?.x).toBeCloseTo(1039.333, 3);
    expect(s82.player.health).toBe(75);
    expect(s82.kills).toBe(1);
    expect(s82.gems).toHaveLength(1);
    expect(s82.gems[0]?.x).toBeCloseTo(1039.333, 3);
  });

  it('Scenario: Esquiva de la explosión del barril', () => {
    const snaps = play(barrelRun(), 82, (k) => (k >= 53 ? LEFT : PlayerInput.NONE));
    const s82 = at(snaps, 82);
    expect(s82.player.x).toBeCloseTo(895, 3);
    expect(Math.abs(s82.player.x - (s82.blasts[0]?.x ?? 0))).toBeGreaterThanOrEqual(56 + 16);
    expect(s82.player.health).toBe(100);
    expect([s82.kills, s82.gems.length]).toEqual([1, 1]);
  });

  it('Scenario: El barril no golpea por contacto', () => {
    const snaps = ticks(barrelRun({ enemies: [{ type: 'goblin-barrel', ...P }] }), 31);
    for (let k = 1; k <= 30; k++) {
      const s = at(snaps, k);
      expect(s.enemies[0]).toMatchObject({ x: 1000, y: 1000, stateKind: 'fuse' });
      expect([s.player.health, s.player.invulnerable]).toEqual([100, false]);
    }
    expect(at(snaps, 31).enemies).toEqual([]);
    expect(at(snaps, 31).player.health).toBe(75);
  });
});

describe('Aviso en el suelo', () => {
  it('Scenario: Aviso de mecha', () => {
    const snaps = ticks(barrelRun(), 82);
    expect(at(snaps, 51).warnings).toEqual([]);
    expect(at(snaps, 82).warnings).toEqual([]);
    for (let k = 52; k <= 81; k++) {
      const [w, ...rest] = at(snaps, k).warnings;
      expect(rest).toEqual([]);
      expect(w).toMatchObject({ y: 1000, radius: 56, source: 'fuse', explodesAt: 82 });
      expect(w?.x).toBeCloseTo(1039.333, 3);
    }
  });

  it('Scenario: Aviso de dinamita', () => {
    const snaps = ticks(tntRun(), 194);
    for (let k = 154; k <= 193; k++) {
      expect(at(snaps, k).warnings).toEqual([
        { x: 1000, y: 1000, radius: 48, source: 'dynamite', explodesAt: 194 },
      ]);
    }
    expect(at(snaps, 194).warnings).toEqual([]);
  });

  it('Scenario: Peligros en el snapshot (mecha antes que dinamita, por tick de explosión)', () => {
    const barrel = aBarrelType({ fuseTicks: 200 });
    const run = startRun(aBehaviorConfig([aTntType(), barrel], { player: { maxHealth: 1e6 } }), {
      player: P,
      enemies: [
        { type: 'goblin-tnt', x: 1300, y: 1000 },
        { type: 'goblin-barrel', x: 500, y: 500, ...inState('fuse', 40) },
      ],
    });
    const s155 = at(ticks(run, 155), 155);
    expect(s155.dynamites).toHaveLength(1);
    expect(s155.dynamites[0]).toMatchObject({
      id: 0,
      targetX: 1000,
      targetY: 1000,
      explodesAt: 194,
    });
    expect(s155.warnings).toEqual([
      { x: 500, y: 500, radius: 56, source: 'fuse', explodesAt: 160 },
      { x: 1000, y: 1000, radius: 48, source: 'dynamite', explodesAt: 194 },
    ]);
    expect(s155.blasts).toEqual([]);
  });
});

describe('Artillero del Goblin TNT y dinamita en vuelo', () => {
  it('Scenario: Ciclo completo de lanzamiento', () => {
    const snaps = ticks(tntRun(), 234);
    const tnt = (k: number) => enemyById(at(snaps, k), 0);
    expect(tnt(133).stateKind).toBe('chase');
    expect(tnt(134).stateKind).toBe('charge');
    expect(tnt(134).x).toBeCloseTo(1199.5, 3);
    for (let k = 135; k <= 213; k++) expect(tnt(k).x).toBe(tnt(134).x);
    expect(at(snaps, 153).dynamites).toEqual([]);
    expect(at(snaps, 154).dynamites).toHaveLength(1);
    expect(at(snaps, 154).dynamites[0]).toMatchObject({ targetX: 1000, targetY: 1000 });
    expect(at(snaps, 154).dynamites[0]?.x).toBeCloseTo(1199.5, 3);
    expect(tnt(154).stateKind).toBe('wait');
    expect(tnt(214).stateKind).toBe('charge');
    expect(tnt(214).x).toBeCloseTo(1198.75, 3);
    expect(at(snaps, 233).dynamites).toEqual([]);
    expect(at(snaps, 234).dynamites.map((d) => d.id)).toEqual([1]);
  });

  it('Scenario: Posiciones del vuelo', () => {
    const snaps = ticks(tntRun(), 194);
    const d = (k: number) => at(snaps, k).dynamites[0];
    expect(d(154)?.x).toBeCloseTo(1199.5, 3);
    expect(d(174)?.x).toBeCloseTo(1099.75, 3);
    expect(d(193)?.x).toBeCloseTo(1004.9875, 3);
    for (const k of [154, 174, 193]) {
      expect(d(k)).toMatchObject({ y: 1000, targetX: 1000, targetY: 1000, explodesAt: 194 });
    }
    expect(at(snaps, 194).dynamites).toEqual([]);
    expect(at(snaps, 194).blasts).toMatchObject([{ x: 1000, y: 1000, radius: 48, tick: 194 }]);
  });

  it('Scenario: Objetivo fijado al lanzar', () => {
    const snaps = play(tntRun(), 193, (k) => (k >= 155 ? DOWN : PlayerInput.NONE));
    for (let k = 154; k <= 193; k++) {
      expect(at(snaps, k).dynamites[0]).toMatchObject({ targetX: 1000, targetY: 1000 });
    }
    expect(at(snaps, 193).player.y).toBeGreaterThan(1100);
  });

  it('Scenario: Lanza aunque el jugador se aleje durante la carga', () => {
    const snaps = play(tntRun(), 154, (k) => (k >= 135 ? LEFT : PlayerInput.NONE));
    const [d] = at(snaps, 154).dynamites;
    expect(d?.targetX).toBeCloseTo(930, 3);
    expect(d?.targetY).toBe(1000);
    expect((d?.x ?? 0) - (d?.targetX ?? 0)).toBeCloseTo(269.5, 3);
  });

  it('Scenario: Vuelo de 1 tick', () => {
    const snaps = ticks(tntRun([aTntType({ flightTicks: 1 })]), 155);
    expect(at(snaps, 154).dynamites[0]?.x).toBeCloseTo(1199.5, 3);
    expect(at(snaps, 155).dynamites).toEqual([]);
    expect(at(snaps, 155).blasts).toMatchObject([{ x: 1000, y: 1000, tick: 155 }]);
  });
});

/** Partida con el jugador en `player` y las dinamitas y enemigos dados. */
const hazardRun = (setup: RunSetup, opts: { maxHealth?: number; blastTicks?: number } = {}) =>
  startRun(
    aBehaviorConfig(
      [
        aStillType(),
        aStillType({ id: 'biter', damage: 15 }),
        aStillType({ id: 'nibbler', damage: 10 }),
      ],
      {
        player: { maxHealth: opts.maxHealth ?? 100 },
        ...(opts.blastTicks === undefined ? {} : { hazards: { blastTicks: opts.blastTicks } }),
      },
    ),
    { player: P, ...setup },
  );

describe('Explosión de área', () => {
  it('Scenario: Jugador dentro del radio', () => {
    const s = at(ticks(hazardRun({ dynamites: [aDynamite(P, 5)] }), 5), 5);
    expect([s.player.health, s.player.invulnerable]).toEqual([80, true]);
  });

  it.each([
    [1064, 100],
    [1063.9, 80],
  ])('Scenario: Tangencia y justo dentro (jugador en x = %s)', (x, health) => {
    const run = hazardRun({ player: { x, y: 1000 }, dynamites: [aDynamite(P, 5)] });
    expect(at(ticks(run, 5), 5).player.health).toBe(health);
  });

  it('Scenario: Esquiva de la dinamita', () => {
    const dodge = play(tntRun(), 194, (k) => (k >= 155 ? DOWN : PlayerInput.NONE));
    expect(at(dodge, 194).player.y).toBeCloseTo(1140, 3);
    expect(at(dodge, 194).player.health).toBe(at(dodge, 193).player.health);
    expect(at(dodge, 194).player.health).toBe(1e6);
    const still = ticks(tntRun(), 194);
    expect(at(still, 193).player.health - at(still, 194).player.health).toBe(20);
  });

  it('Scenario: Fuego amigo que no mata', () => {
    const run = hazardRun({
      enemies: [{ type: 'still', ...P }],
      dynamites: [aDynamite({ x: 1020, y: 1000 }, 3)],
    });
    const s = at(ticks(run, 3), 3);
    expect(s.enemies[0]?.health).toBe(30);
    expect([s.kills, s.gems.length, s.progression.xp]).toEqual([0, 0, 0]);
  });

  it('Scenario: Goblin fuera del radio', () => {
    const run = hazardRun({
      enemies: [{ type: 'still', x: 1078, y: 1000, health: 20 }],
      dynamites: [aDynamite({ x: 1020, y: 1000 }, 3)],
    });
    expect(at(ticks(run, 3), 3).enemies[0]?.health).toBe(20);
  });

  it('Scenario: Dos explosiones sobre el mismo goblin', () => {
    const run = hazardRun({
      player: { x: 2000, y: 1000 },
      enemies: [{ type: 'still', ...P }],
      dynamites: [aDynamite(P, 3), aDynamite({ x: 1010, y: 1000 }, 3)],
    });
    expect(at(ticks(run, 3), 3).enemies[0]?.health).toBe(10);
  });

  it('Scenario: Explosión visible varios ticks', () => {
    const walker = aBarrelType({ id: 'walker', activation: 1, speed: 60, radius: 10, health: 50 });
    // Camina hacia el jugador (+x): en el tick 5 está a 58 px del centro (tangente, 48 + 10) y
    // desde el 6 dentro del radio de una explosión que ya no hace daño.
    const run = startRun(aBehaviorConfig([walker], { hazards: { blastTicks: 12 } }), {
      player: { x: 2000, y: 1000 },
      enemies: [{ type: 'walker', x: 937, y: 1000 }],
      dynamites: [aDynamite(P, 5)],
    });
    const snaps = ticks(run, 17);
    for (let k = 5; k <= 16; k++) {
      expect(at(snaps, k).blasts).toMatchObject([{ x: 1000, y: 1000, tick: 5 }]);
    }
    expect(at(snaps, 17).blasts).toEqual([]);
    expect(at(snaps, 6).enemies[0]?.x).toBeCloseTo(943, 3);
    expect(snaps.every((s) => s.enemies[0]?.health === 50)).toBe(true);
  });

  it('Scenario: La explosión no empuja', () => {
    const torch = aBarrelType({ id: 'torch', activation: 1, speed: 90, health: 50 });
    const config = aBehaviorConfig([torch], { player: { maxHealth: 1e6 } });
    const setup = { player: P, enemies: [{ type: 'torch', x: 1300, y: 1000 }] };
    const calm = ticks(startRun(config, setup), 15);
    const p5 = at(calm, 5).enemies[0];
    const hit = startRun(config, {
      ...setup,
      dynamites: [aDynamite({ x: p5?.x ?? 0, y: p5?.y ?? 0 }, 5, { radius: 10, damage: 25 })],
    });
    const shaken = ticks(hit, 15);
    expect(at(shaken, 5).enemies[0]).toMatchObject({ x: p5?.x, y: p5?.y, health: 25 });
    for (let k = 6; k <= 15; k++) {
      const [a, b] = [at(calm, k).enemies[0], at(shaken, k).enemies[0]];
      expect([b?.x, b?.y, b?.stateKind]).toEqual([a?.x, a?.y, a?.stateKind]);
    }
  });
});

describe('Golpe único con explosiones (player-health)', () => {
  it('Scenario: Contacto y explosión en el mismo tick', () => {
    const run = (damage: number) =>
      hazardRun({
        enemies: [{ type: 'biter', ...P }],
        dynamites: [aDynamite(P, 1, { damage })],
      });
    expect(at(ticks(run(25), 1), 1).player.health).toBe(75);
    expect(at(ticks(run(10), 1), 1).player.health).toBe(85);
  });

  it('Scenario: Dos explosiones en el mismo tick', () => {
    const run = hazardRun({
      dynamites: [aDynamite(P, 1, { damage: 20 }), aDynamite(P, 1, { damage: 25 })],
    });
    expect(at(ticks(run, 1), 1).player.health).toBe(75);
  });

  it('Scenario: Explosión que no alcanza no es candidata', () => {
    const run = hazardRun({ dynamites: [aDynamite({ x: 1064, y: 1000 }, 1)] });
    const s = at(ticks(run, 1), 1);
    expect([s.player.health, s.player.invulnerable]).toEqual([100, false]);
  });

  /** Enemigo de contacto 10 que llega en el tick `first` y una dinamita lo abate al tick siguiente. */
  const brief = (first: number): RunSetup => ({
    enemies: [{ type: 'walker', x: 1000 + 26 + first - 1, y: 1000 }],
    dynamites: [aDynamite({ x: 1040, y: 1000 }, first + 1, { radius: 10, damage: 100 })],
  });
  const walker = (health: number) =>
    aBarrelType({ id: 'walker', activation: 0.001, speed: 60, radius: 10, health, damage: 10 });
  const briefRun = (setup: RunSetup, health = 10) =>
    startRun(aBehaviorConfig([walker(health)]), { player: P, ...setup });

  it('Scenario: Explosión durante la invulnerabilidad', () => {
    const b = brief(70);
    const run = briefRun({
      ...b,
      dynamites: [...(b.dynamites ?? []), aDynamite(P, 82, { damage: 25 })],
    });
    const snaps = ticks(run, 101);
    expect(at(snaps, 69).player.health).toBe(100);
    expect(at(snaps, 70).player.health).toBe(90);
    expect(at(snaps, 82).player.health).toBe(90);
    expect(at(snaps, 101).player.health).toBe(90);
    expect(at(snaps, 100).player.invulnerable).toBe(false);
  });

  it('Scenario: Explosión justo al expirar', () => {
    const b = brief(10);
    const run = briefRun({
      ...b,
      dynamites: [...(b.dynamites ?? []), aDynamite(P, 41, { damage: 25 })],
    });
    const s = at(ticks(run, 41), 41);
    expect([s.player.health, s.player.invulnerable]).toEqual([65, true]);
  });

  it('Scenario: La explosión inicia la invulnerabilidad', () => {
    const run = briefRun(
      {
        enemies: [{ type: 'walker', x: 1000 + 26 + 10, y: 1000 }],
        dynamites: [aDynamite(P, 10, { damage: 20 })],
      },
      100,
    );
    const snaps = ticks(run, 41);
    expect(at(snaps, 10).player.health).toBe(80);
    expect(at(snaps, 40).player.health).toBe(80);
    expect(at(snaps, 41).player.health).toBe(70);
  });

  it('Scenario: Un tipo sin daño por contacto no golpea', () => {
    const run = hazardRun({
      player: { x: 480, y: 270 },
      enemies: [{ type: 'still', x: 480, y: 270 }],
    });
    const snaps = ticks(run, 600);
    expect(snaps.every((s) => s.player.health === 100 && !s.player.invulnerable)).toBe(true);
  });
});
