import { describe, expect, it } from 'vitest';
import { CHASE_BEHAVIOR } from '../support/builders';
import { Arena } from '../../src/domain/arena/Arena';
import { EnemyCatalog } from '../../src/domain/enemy/EnemyCatalog';
import {
  BUDGET_MUST_BE_NON_NEGATIVE,
  FIRST_SEGMENT_MUST_START_AT_ZERO,
  SEGMENTS_MUST_INCREASE,
  SEGMENT_NEEDS_TYPES,
  UNKNOWN_ENEMY_TYPE,
  WAVES_NEED_SEGMENTS,
  WaveTable,
  type WaveSegmentConfig,
} from '../../src/domain/wave/WaveTable';

function catalog(): EnemyCatalog {
  const arena = Arena.create(960, 540);
  if (!arena.ok) throw new Error(arena.error.message);
  const r = EnemyCatalog.create(
    [
      {
        id: 'goblin-torch',
        speed: 90,
        radius: 10,
        cost: 1,
        damage: 5,
        health: 10,
        xp: 1,
        behavior: CHASE_BEHAVIOR,
      },
      {
        id: 'goblin-tnt',
        speed: 45,
        radius: 22,
        cost: 3,
        damage: 5,
        health: 10,
        xp: 1,
        behavior: CHASE_BEHAVIOR,
      },
    ],
    arena.value,
  );
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const seg = (fromSecond: number, types: string[] = ['goblin-torch'], budgetPerSecond = 1) => ({
  fromSecond,
  budgetPerSecond,
  types,
});

function table(segments: WaveSegmentConfig[]): WaveTable {
  const r = WaveTable.create(segments, catalog());
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

function failure(segments: WaveSegmentConfig[]): { field: string; message: string } {
  const r = WaveTable.create(segments, catalog());
  if (r.ok) throw new Error('se esperaba un error');
  return r.error;
}

describe('WaveTable · validación', () => {
  it('resuelve los tipos de cada tramo contra el catálogo', () => {
    const t = table([seg(0), seg(30, ['goblin-tnt', 'goblin-torch'], 2)]);
    expect(t.segments).toHaveLength(2);
    expect(t.segments[1]?.types.map((type) => type.id)).toEqual(['goblin-tnt', 'goblin-torch']);
    expect(t.segments[1]?.budgetPerSecond).toBe(2);
  });

  it('Oleada con un tipo inexistente', () => {
    const e = failure([seg(0, ['goblin-torch', 'segfault'])]);
    expect(e.field).toBe('waves.segments.0.types.1');
    expect(e.message).toContain(UNKNOWN_ENEMY_TYPE);
    expect(e.message).toContain('segfault');
  });

  it('Primer tramo que no empieza en 0', () => {
    const e = failure([seg(5)]);
    expect(e).toEqual({
      code: 'invalid-config',
      field: 'waves.segments.0.fromSecond',
      message: FIRST_SEGMENT_MUST_START_AT_ZERO,
    });
  });

  it.each([
    [[0, 60, 60], 2],
    [[0, 60, 30], 2],
  ])('Tramos desordenados o repetidos (%j)', (seconds, badIndex) => {
    const e = failure(seconds.map((s) => seg(s)));
    expect(e.field).toBe(`waves.segments.${String(badIndex)}.fromSecond`);
    expect(e.message).toBe(SEGMENTS_MUST_INCREASE);
  });

  it('exige al menos un tramo', () => {
    expect(failure([])).toMatchObject({ field: 'waves.segments', message: WAVES_NEED_SEGMENTS });
  });

  it('exige al menos un tipo por tramo', () => {
    expect(failure([seg(0, [])])).toMatchObject({
      field: 'waves.segments.0.types',
      message: SEGMENT_NEEDS_TYPES,
    });
  });

  it.each([-1, Number.NaN])('rechaza un budgetPerSecond negativo o no finito (%s)', (budget) => {
    expect(failure([seg(0, ['goblin-torch'], budget)])).toMatchObject({
      field: 'waves.segments.0.budgetPerSecond',
      message: BUDGET_MUST_BE_NON_NEGATIVE,
    });
  });

  it('acepta un budgetPerSecond 0', () => {
    expect(WaveTable.create([seg(0, ['goblin-torch'], 0)], catalog()).ok).toBe(true);
  });
});

describe('WaveTable · tramo activo', () => {
  const t = table([seg(0), seg(30), seg(180)]);

  it.each([
    [0, 0],
    [1, 0],
    [1799, 0],
    [1800, 1],
    [10799, 1],
    [10800, 2],
    [36000, 2],
  ])('en el tick %i el tramo activo es %i (último con fromSecond ≤ tick / 60)', (tick, index) => {
    expect(t.indexAt(tick)).toBe(index);
  });

  it('acepta una pista de partida para recorrerla de forma monótona', () => {
    expect(t.indexAt(10800, 1)).toBe(2);
  });
});
