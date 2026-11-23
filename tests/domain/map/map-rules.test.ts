import { describe, expect, it } from 'vitest';
import { Arena } from '../../../src/domain/arena/Arena';
import {
  CELL_SIZE_BELOW_PLAYER,
  MapRules,
  START_RADIUS_TOO_LARGE,
  type MapConfig,
} from '../../../src/domain/map/MapRules';
import { DEFAULT_MAP } from '../../support/builders';

function create(patch: Partial<MapConfig>, width = 1920, height = 1080) {
  const arena = Arena.create(width, height);
  if (!arena.ok) throw new Error(arena.error.message);
  return MapRules.create({ ...DEFAULT_MAP, ...patch }, arena.value, 16);
}

describe('MapRules · rejilla del contenido (spec procedural-map)', () => {
  it('Scenario: Rejilla por defecto (32 × 18 = 576 celdas de 60 px)', () => {
    const r = create({});
    expect(r.ok && [r.value.cols, r.value.rows, r.value.cellCount, r.value.cellSize]).toEqual([
      32, 18, 576, 60,
    ]);
  });

  it('Scenario: Mundo no múltiplo de la celda (4.000 × 4.000 ⇒ 67 × 67)', () => {
    const r = create({}, 4000, 4000);
    expect(r.ok && [r.value.cols, r.value.rows]).toEqual([67, 67]);
  });

  it('zona de inicio en el centro del mundo con el radio del contenido', () => {
    const r = create({});
    expect(r.ok && r.value.start).toEqual({ x: 960, y: 540, radius: 180 });
  });
});

describe('MapRules · invariantes cruzadas con arena y jugador', () => {
  it('Scenario: Celda en el límite del radio del jugador (32 vale, 31 no)', () => {
    expect(create({ cellSize: 32 }).ok).toBe(true);
    const r = create({ cellSize: 31 });
    expect(!r.ok && r.error).toEqual({
      code: 'invalid-config',
      field: 'map.cellSize',
      message: CELL_SIZE_BELOW_PLAYER,
    });
  });

  it('startRadius 541 no cabe en el mundo de 1.920 × 1.080; 540 sí', () => {
    expect(create({ startRadius: 540 }).ok).toBe(true);
    const r = create({ startRadius: 541 });
    expect(!r.ok && r.error).toEqual({
      code: 'invalid-config',
      field: 'map.startRadius',
      message: START_RADIUS_TOO_LARGE,
    });
  });

  it('mundo no múltiplo: la última columna recortada no se valida (cellSize 32 con alto 1.080)', () => {
    expect(create({}, 4000, 4000).ok).toBe(true);
    const r = create({ cellSize: 32 });
    expect(r.ok && [r.value.cols, r.value.rows]).toEqual([60, 34]);
  });

  it.each([
    ['cellSize', { cellSize: 0 }],
    ['cellSize', { cellSize: 60.5 }],
    ['startRadius', { startRadius: 0 }],
    ['trunkDensity', { trunkDensity: -0.01 }],
    ['trunkDensity', { trunkDensity: 0.31 }],
    ['trunkPatch', { trunkPatch: { min: 4, max: 3 } }],
    ['trunkPatch', { trunkPatch: { min: 0, max: 3 } }],
    ['rivers', { rivers: 3 }],
    ['rivers', { rivers: 1.5 }],
    ['bridges', { bridges: { min: 0, max: 2 } }],
    ['bridges', { bridges: { min: 3, max: 2 } }],
  ] as const)('defensa en el dominio: %s fuera de rango', (field, patch) => {
    const r = create(patch);
    expect(!r.ok && r.error.field).toBe(`map.${field}`);
  });
});
