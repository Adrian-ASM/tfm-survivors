import { describe, expect, it } from 'vitest';
import {
  RADIUS_MUST_FIT,
  SPEED_MUST_BE_POSITIVE,
  buildRunRules,
  type RunConfig,
} from '../../src/domain/run/RunConfig';
import { UNKNOWN_ENEMY_TYPE } from '../../src/domain/wave/WaveTable';
import {
  MAX_ALIVE_MUST_BE_INTEGER,
  MAX_ATTEMPTS_MUST_BE_INTEGER,
  SPAWN_DISTANCE_MUST_BE_NON_NEGATIVE,
} from '../../src/domain/wave/SpawnRules';
import { aRunConfig } from '../support/builders';

type Waves = RunConfig['waves'];
const withWaves = (waves: Partial<Waves>, spawn: Partial<Waves['spawn']> = {}): RunConfig => {
  const base = aRunConfig();
  return { ...base, waves: { ...base.waves, ...waves, spawn: { ...base.waves.spawn, ...spawn } } };
};

function failure(config: RunConfig): { field: string; message: string } {
  const r = buildRunRules(config);
  if (r.ok) throw new Error('se esperaba un error');
  return r.error;
}

describe('buildRunRules', () => {
  it('compone arena, vista, catálogo, tabla y reglas de spawn del contenido por defecto', () => {
    const r = buildRunRules(aRunConfig());
    if (!r.ok) throw new Error(r.error.message);
    const { arena, view, catalog, table, spawn } = r.value;
    expect([arena.width, arena.height, view.width, view.height]).toEqual([960, 540, 960, 540]);
    expect(catalog.ids).toEqual(['bug', 'memory-leak', 'merge-conflict']);
    expect(table.segments.map((s) => s.fromSecond)).toEqual([0, 60, 180, 300, 480]);
    expect(spawn).toMatchObject({ maxAlive: 200, minDistance: 200, maxAttempts: 8, margin: 32 });
  });

  it('radio del anillo = mitad de la diagonal de la vista + margin ≈ 582,727', () => {
    const r = buildRunRules(aRunConfig());
    expect(r.ok && r.value.spawn.ringRadius).toBeCloseTo(582.7268, 4);
  });

  it.each([0, 12.5, -3])('Tope de vivos no entero (maxAlive %s)', (maxAlive) => {
    expect(failure(withWaves({ maxAlive }))).toEqual({
      code: 'invalid-config',
      field: 'waves.maxAlive',
      message: MAX_ALIVE_MUST_BE_INTEGER,
    });
  });

  it.each([0, 2.5])('rechaza maxAttempts no entero o < 1 (%s)', (maxAttempts) => {
    expect(failure(withWaves({}, { maxAttempts }))).toMatchObject({
      field: 'waves.spawn.maxAttempts',
      message: MAX_ATTEMPTS_MUST_BE_INTEGER,
    });
  });

  it.each(['margin', 'minDistance'] as const)('rechaza %s negativo', (key) => {
    expect(failure(withWaves({}, { [key]: -1 }))).toMatchObject({
      field: `waves.spawn.${key}`,
      message: SPAWN_DISTANCE_MUST_BE_NON_NEGATIVE,
    });
  });

  it('acepta margin y minDistance 0, y minDistance mayor que el anillo', () => {
    expect(buildRunRules(withWaves({}, { margin: 0, minDistance: 0 })).ok).toBe(true);
    expect(buildRunRules(withWaves({}, { minDistance: 2000 })).ok).toBe(true);
  });

  it('rechaza una vista sin tamaño', () => {
    const base = aRunConfig();
    const config = { ...base, arena: { ...base.arena, view: { width: 0, height: 540 } } };
    expect(failure(config).field).toBe('arena.view.width');
  });

  it('propaga las reglas del catálogo y de la tabla con la ruta del campo', () => {
    const base = aRunConfig();
    const badType = { ...base, enemies: { types: [{ id: 'bug', speed: 0, radius: 10, cost: 1 }] } };
    expect(failure(badType).field).toBe('enemies.types.0.speed');
    const segments = [{ fromSecond: 0, budgetPerSecond: 1, types: ['bug', 'segfault'] }];
    const e = failure(withWaves({ segments }));
    expect(e.field).toBe('waves.segments.0.types.1');
    expect(e.message).toBe(`${UNKNOWN_ENEMY_TYPE}: segfault`);
  });

  it('mantiene las invariantes del jugador', () => {
    expect(failure(aRunConfig({ speed: 0 }))).toMatchObject({
      field: 'player.speed',
      message: SPEED_MUST_BE_POSITIVE,
    });
    expect(failure(aRunConfig({ radius: 300 }))).toMatchObject({
      field: 'player.radius',
      message: RADIUS_MUST_FIT,
    });
  });
});
