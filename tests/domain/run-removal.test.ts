import { describe, expect, it } from 'vitest';
import { aSegment, LONG_RUN_HEALTH } from '../support/builders';
import { StubRandom } from '../support/random';
import { aContactConfig, aProbeType, enemyById, startRun, ticks } from '../support/runs';

const CENTER = { x: 480, y: 270 };
const ids = (snap: { enemies: readonly { id: number }[] } | undefined): number[] =>
  (snap?.enemies ?? []).map((e) => e.id);

/** `count` enemigos `probe` lejos del jugador (x = 100), uno por fila: ids 0 … count − 1. */
const row = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ type: 'probe', x: 100, y: 20 + (i % 50) * 10 }));

describe('Vida y baja de enemigos (Run.damageEnemy)', () => {
  const one = () => startRun(aContactConfig(), { enemies: [{ type: 'probe', x: 100, y: 270 }] });

  it('Daño que no mata: sigue vivo, con vida 2, y en el snapshot', () => {
    const run = one();
    expect(run.damageEnemy(0, 3)).toBe('damaged');
    const [snap] = ticks(run, 1);
    expect(snap && enemyById(snap, 0).health).toBe(2);
  });

  it.each([5, 7])('Daño igual o mayor que la vida (%d): baja y fuera del snapshot', (amount) => {
    const run = one();
    expect(run.damageEnemy(0, amount)).toBe('killed');
    expect(run.snapshot().enemies).toEqual([]);
    expect(ids(ticks(run, 1)[0])).toEqual([]);
  });

  it('Daño a un enemigo ya dado de baja: sin error y sin cambios', () => {
    const run = startRun(aContactConfig(), { enemies: row(3) });
    run.damageEnemy(1, 5);
    expect(run.damageEnemy(1, 5)).toBe('missing');
    expect(ids(run.snapshot())).toEqual([0, 2]);
  });

  it('rechaza un daño no positivo o no finito (error de programación)', () => {
    const run = one();
    for (const amount of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => run.damageEnemy(0, amount)).toThrow(RangeError);
    }
  });

  it('con la partida terminada se ignora', () => {
    const run = startRun(aContactConfig({ player: { maxHealth: 10 } }), {
      enemies: [{ type: 'probe', ...CENTER }],
    });
    ticks(run, 1);
    expect(run.damageEnemy(0, 5)).toBe('ignored');
    expect(ids(run.snapshot())).toEqual([0]);
  });

  it('Identificador no reutilizado (maxAlive 1, 60/s)', () => {
    const config = aContactConfig({ maxAlive: 1, segments: [aSegment(['probe'], 60)] });
    const run = startRun(
      config,
      { enemies: [{ type: 'probe', x: 100, y: 270 }] },
      new StubRandom(0),
    );
    run.damageEnemy(0, 5);
    const snap = ticks(run, 60).at(-1);
    expect(snap?.enemies).toHaveLength(1);
    expect(ids(snap)).not.toContain(0);
  });

  it('Un enemigo dado de baja no hace contacto', () => {
    const run = startRun(aContactConfig(), { enemies: [{ type: 'probe', ...CENTER }] });
    run.damageEnemy(0, 5);
    expect(ticks(run, 60).at(-1)?.player.health).toBe(100);
  });
});

describe('Bajas sin reordenar (compactación estable)', () => {
  it('Bajas sin reordenar: a3 y a7 fuera, el resto en su orden', () => {
    const run = startRun(aContactConfig(), { enemies: row(10) });
    run.damageEnemy(2, 5);
    run.damageEnemy(6, 5);
    expect(ids(ticks(run, 1)[0])).toEqual([0, 1, 3, 4, 5, 7, 8, 9]);
  });

  it('Reposición al final de la lista: b1 y b2 detrás de los supervivientes', () => {
    // Sin presupuesto el primer segundo; desde el segundo 1, 120/s: 2 spawns en el tick 60.
    const segments = [aSegment(['probe'], 0), aSegment(['probe'], 120, 1)];
    const run = startRun(aContactConfig({ segments }), { enemies: row(10) }, new StubRandom(0));
    run.damageEnemy(2, 5);
    run.damageEnemy(6, 5);
    const snaps = ticks(run, 60);
    expect(ids(snaps[58])).toEqual([0, 1, 3, 4, 5, 7, 8, 9]);
    expect(ids(snaps[59])).toEqual([0, 1, 3, 4, 5, 7, 8, 9, 10, 11]);
  });

  it('Baja del primero y del último de 200', () => {
    const run = startRun(aContactConfig(), { enemies: row(200) });
    run.damageEnemy(0, 5);
    run.damageEnemy(199, 5);
    expect(ids(ticks(run, 1)[0])).toEqual(Array.from({ length: 198 }, (_, i) => i + 1));
  });
});

describe('Bajas, director y persecución', () => {
  it('Reposición de una baja sin superar el tope (aparece 1, no 20)', () => {
    const config = aContactConfig({
      types: [aProbeType({ id: 'bug', speed: 90 })],
      player: { maxHealth: LONG_RUN_HEALTH },
      segments: [aSegment(['bug'], 1000)],
      maxBudget: 20,
    });
    const run = startRun(config);
    expect(ticks(run, 13).at(-1)?.enemies).toHaveLength(200);
    expect(ticks(run, 600).at(-1)?.enemies).toHaveLength(200);
    const victim = run.snapshot().enemies[50]?.id ?? -1;
    expect(run.damageEnemy(victim, 5)).toBe('killed');
    expect(run.snapshot().enemies).toHaveLength(199);
    const snap = ticks(run, 1)[0];
    expect(snap?.enemies).toHaveLength(200);
    expect(snap?.enemies.at(-1)?.id).toBe(200);
  });

  it('Golpear al jugador no quita vida al enemigo (600 ticks en contacto)', () => {
    const run = startRun(aContactConfig({ player: { maxHealth: 1000 } }), {
      enemies: [{ type: 'probe', ...CENTER }],
    });
    const snap = ticks(run, 600).at(-1);
    expect(snap?.status).toBe('running');
    expect(snap?.player.health).toBeLessThan(1000);
    expect(snap?.enemies).toEqual([{ id: 0, type: 'probe', ...CENTER, radius: 10, health: 5 }]);
  });

  it('Un enemigo dado de baja deja de perseguir y no altera a los demás', () => {
    const setup = {
      enemies: [
        { type: 'probe', x: 100, y: 270 },
        { type: 'probe', x: 100, y: 100 },
      ],
    };
    const withKill = startRun(aContactConfig(), setup);
    const without = startRun(aContactConfig(), setup);
    ticks(withKill, 10);
    ticks(without, 10);
    withKill.damageEnemy(0, 5);
    const a = ticks(withKill, 50).at(-1);
    const b = ticks(without, 50).at(-1);
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
        types: [aProbeType({ id: 'bug', speed: 90 })],
        segments: [aSegment(['bug'], 1)],
      }),
    );
    const snaps = ticks(run, 60);
    expect(snaps[58]?.enemies).toHaveLength(0);
    expect(snaps[59]?.enemies).toHaveLength(1);
    expect(snaps[59]?.player.health).toBe(snaps[58]?.player.health);
  });
});
