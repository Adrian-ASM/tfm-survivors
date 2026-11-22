import { describe, expect, it } from 'vitest';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { LINTER, aSegment, LONG_RUN_HEALTH, withWeapons } from '../support/builders';
import { StubRandom } from '../support/random';
import { aContactConfig, aProbeType, enemyById, startRun, ticks } from '../support/runs';
import { aPulse, weaponsOf } from '../support/weapons';

// Las bajas se provocan con armas (0004: `Run.damageEnemy` ya no existe). Un pulso de prueba que
// alcanza toda la arena y dispara una sola vez da de baja en el tick 1 a las víctimas con vida
// inicial ≤ su daño; los `probe` de vida 5 sobreviven.

const CENTER = { x: 480, y: 270 };
const ids = (snap: { enemies: readonly { id: number }[] } | undefined): number[] =>
  (snap?.enemies ?? []).map((e) => e.id);

/** Pulso único (cadencia 1000) de radio `radius` y daño `damage`. */
const killer = (damage = 1, radius = 2000) =>
  weaponsOf([
    aPulse({
      id: 'killer',
      damage,
      cooldownTicks: 1000,
      targeting: { mode: 'any-in-radius', radius },
    }),
  ]);

const armed = (config: RunConfig = aContactConfig(), damage = 1, radius = 2000): RunConfig =>
  withWeapons(config, killer(damage, radius));

/**
 * `count` enemigos `probe` lejos del jugador (x = 100), uno por fila: ids 0 … count − 1. Los
 * índices de `victims` empiezan con vida 1.
 */
const row = (count: number, victims: readonly number[] = []) =>
  Array.from({ length: count }, (_, i) => ({
    type: 'probe',
    x: 100,
    y: 20 + (i % 50) * 10,
    ...(victims.includes(i) ? { health: 1 } : {}),
  }));

describe('Vida y baja de enemigos (por armas)', () => {
  const one = { enemies: [{ type: 'probe', x: 100, y: 270 }] };

  it('Scenario: Daño que no mata (vida 5, damage 3): sigue vivo con vida 2 en el snapshot', () => {
    const [snap] = ticks(startRun(armed(aContactConfig(), 3), one), 1);
    expect(snap && enemyById(snap, 0).health).toBe(2);
  });

  it.each([5, 7])('Scenario: Daño igual o mayor que la vida (%d): fuera del snapshot', (damage) => {
    const [snap] = ticks(startRun(armed(aContactConfig(), damage), one), 1);
    expect(ids(snap)).toEqual([]);
  });

  it('Scenario: Daño a un enemigo ya dado de baja (el proyectil pasa por su sitio y sigue)', () => {
    // El Linter apunta a a en el tick 1 y, a continuación, el pulso lo da de baja: el proyectil
    // pasa por su última posición sin error. b queda fuera del alcance y del pulso.
    const weapons = weaponsOf([
      LINTER,
      aPulse({ damage: 5, cooldownTicks: 1000, targeting: { mode: 'any-in-radius', radius: 150 } }),
    ]);
    const setup = {
      enemies: [
        { type: 'probe', x: 580, y: 270 },
        { type: 'probe', x: 100, y: 100 },
      ],
    };
    const snaps = ticks(startRun(withWeapons(aContactConfig(), weapons), setup), 20);
    expect(snaps.map((s) => ids(s))).toEqual(Array.from({ length: 20 }, () => [1]));
    expect(snaps[19]?.projectiles).toHaveLength(1);
    expect(snaps[19]?.projectiles[0]?.x).toBeGreaterThan(580);
  });

  it('Scenario: Identificador no reutilizado (maxAlive 1, 60/s)', () => {
    const config = aContactConfig({ maxAlive: 1, segments: [aSegment(['probe'], 60)] });
    const setup = { enemies: [{ type: 'probe', x: 100, y: 270, health: 1 }] };
    const run = startRun(armed(config), setup, new StubRandom(0));
    const snap = ticks(run, 60).at(-1);
    expect(snap?.enemies).toHaveLength(1);
    expect(ids(snap)).not.toContain(0);
  });

  it('Un enemigo dado de baja no hace contacto', () => {
    const setup = { enemies: [{ type: 'probe', ...CENTER, health: 1 }] };
    expect(ticks(startRun(armed(), setup), 60).at(-1)?.player.health).toBe(100);
  });
});

describe('Bajas sin reordenar (compactación estable)', () => {
  it('Scenario: Bajas sin reordenar: a3 y a7 fuera, el resto en su orden', () => {
    const run = startRun(armed(), { enemies: row(10, [2, 6]) });
    expect(ids(ticks(run, 1)[0])).toEqual([0, 1, 3, 4, 5, 7, 8, 9]);
  });

  it('Scenario: Reposición al final de la lista: b1 y b2 detrás de los supervivientes', () => {
    // Sin presupuesto el primer segundo; desde el segundo 1, 120/s: 2 spawns en el tick 60.
    const segments = [aSegment(['probe'], 0), aSegment(['probe'], 120, 1)];
    const config = armed(aContactConfig({ segments }));
    const run = startRun(config, { enemies: row(10, [2, 6]) }, new StubRandom(0));
    const snaps = ticks(run, 60);
    expect(ids(snaps[58])).toEqual([0, 1, 3, 4, 5, 7, 8, 9]);
    expect(ids(snaps[59])).toEqual([0, 1, 3, 4, 5, 7, 8, 9, 10, 11]);
  });

  it('Scenario: Baja del primero y del último de 200', () => {
    const run = startRun(armed(), { enemies: row(200, [0, 199]) });
    expect(ids(ticks(run, 1)[0])).toEqual(Array.from({ length: 198 }, (_, i) => i + 1));
  });
});

describe('Bajas, director y persecución', () => {
  it('Reposición de una baja sin superar el tope (aparece 1, no 20)', () => {
    const config = aContactConfig({
      player: { maxHealth: LONG_RUN_HEALTH },
      segments: [aSegment(['probe'], 1000)],
      maxBudget: 20,
    });
    const run = startRun(armed(config), { enemies: row(200, [50]) });
    const snap = ticks(run, 1)[0];
    expect(snap?.enemies).toHaveLength(200);
    expect(ids(snap)).not.toContain(50);
    expect(snap?.enemies.at(-1)?.id).toBe(200);
  });

  it('Scenario: Golpear al jugador no quita vida al enemigo (sin armas, 600 ticks)', () => {
    const run = startRun(aContactConfig({ player: { maxHealth: 1000 } }), {
      enemies: [{ type: 'probe', ...CENTER }],
    });
    const snap = ticks(run, 600).at(-1);
    expect(snap?.status).toBe('running');
    expect(snap?.player.health).toBeLessThan(1000);
    expect(snap?.enemies).toEqual([
      { id: 0, type: 'probe', ...CENTER, radius: 10, health: 5, damaged: false },
    ]);
  });

  it('Un enemigo dado de baja deja de perseguir y no altera a los demás', () => {
    // El pulso (radio 385) solo alcanza a 0 (a ~379 px); 1 está a ~415 px.
    const enemies = (health: number) => [
      { type: 'probe', x: 100, y: 270, health },
      { type: 'probe', x: 100, y: 100 },
    ];
    const withKill = startRun(armed(aContactConfig(), 1, 385), { enemies: enemies(1) });
    const without = startRun(aContactConfig(), { enemies: enemies(5) });
    const a = ticks(withKill, 60).at(-1);
    const b = ticks(without, 60).at(-1);
    expect(ids(a)).toEqual([1]);
    expect(a && enemyById(a, 1)).toEqual(b && enemyById(b, 1));
  });

  it('Sigue hasta el centro tras golpear', () => {
    const run = startRun(aContactConfig(), { enemies: [{ type: 'probe', x: 530, y: 270 }] });
    const snap = ticks(run, 60).at(-1);
    expect(snap?.player.health).toBeLessThan(100);
    expect(snap?.enemies[0]?.x).toBeCloseTo(480, 3);
    expect(snap?.enemies[0]?.y).toBeCloseTo(270, 3);
  });

  it('El contacto no empuja al jugador (50 enemigos a ≤ 20 unidades)', () => {
    const enemies = Array.from({ length: 50 }, (_, i) => {
      const angle = (i / 50) * 2 * Math.PI;
      return { type: 'probe', x: 480 + 20 * Math.cos(angle), y: 270 + 20 * Math.sin(angle) };
    });
    const run = startRun(aContactConfig({ player: { maxHealth: 1000 } }), { enemies });
    const snap = ticks(run, 60).at(-1);
    expect(snap?.player).toMatchObject(CENTER);
    for (const e of snap?.enemies ?? []) {
      expect(e.x).toBeCloseTo(480, 3);
      expect(e.y).toBeCloseTo(270, 3);
    }
    expect(snap?.enemies).toHaveLength(50);
  });

  it('Un enemigo recién aparecido no golpea en su tick de aparición', () => {
    const run = startRun(
      aContactConfig({
        types: [aProbeType({ id: 'goblin-torch', speed: 90 })],
        segments: [aSegment(['goblin-torch'], 1)],
      }),
    );
    const snaps = ticks(run, 60);
    expect(snaps[58]?.enemies).toHaveLength(0);
    expect(snaps[59]?.enemies).toHaveLength(1);
    expect(snaps[59]?.player.health).toBe(snaps[58]?.player.health);
  });
});
