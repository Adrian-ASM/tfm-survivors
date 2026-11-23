import { describe, expect, it } from 'vitest';
import { Arena } from '../../../src/domain/arena/Arena';
import {
  CASTLE_OUT_OF_GRID,
  CELL_SIZE_BELOW_PLAYER,
  MapRules,
  START_RADIUS_TOO_LARGE,
  type MapConfig,
} from '../../../src/domain/map/MapRules';
import { castleSite } from '../../../src/domain/map/CastleSite';
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
    ['castle.cols', { castle: { cols: 0, rows: 4 } }],
    ['castle.rows', { castle: { cols: 5, rows: 0 } }],
    ['castle.cols', { castle: { cols: 5.5, rows: 4 } }],
  ] as const)('defensa en el dominio: %s fuera de rango', (field, patch) => {
    const r = create(patch);
    expect(!r.ok && r.error.field).toBe(`map.${field}`);
  });

  it.each([
    [17, 4],
    [5, 10],
  ])(
    'castle { %i, %i } no cabe en la rejilla de 32 × 18 (⌊32/2⌋ = 16, ⌊18/2⌋ = 9)',
    (cols, rows) => {
      const r = create({ castle: { cols, rows } });
      expect(!r.ok && r.error).toEqual({
        code: 'invalid-config',
        field: 'map.castle',
        message: CASTLE_OUT_OF_GRID,
      });
    },
  );

  it.each([
    [1, 1],
    [16, 9],
    [5, 4],
  ])('castle { %i, %i } vale en la rejilla por defecto', (cols, rows) => {
    expect(create({ castle: { cols, rows } }).ok).toBe(true);
  });

  it('huella y puerta deben caber también en una rejilla impar (3 × 3: castle { 1, 1 })', () => {
    // 180 × 180 ⇒ 3 × 3 celdas, centro (1, 1): huella (1, 1) y puerta (1, 2).
    expect(create({ castle: { cols: 1, rows: 1 }, startRadius: 60 }, 180, 180).ok).toBe(true);
  });

  it('Scenario: Huella y salida por defecto (reglas: columnas 14–18, filas 6–9, salida (990, 630))', () => {
    const r = create({});
    const site = r.ok ? r.value.castle : null;
    expect(site).toEqual({
      firstCol: 14,
      lastCol: 18,
      firstRow: 6,
      lastRow: 9,
      door: { col: 16, row: 10 },
      exit: { x: 990, y: 630 },
    });
    expect(Object.isFrozen(site)).toBe(true);
    expect(site && Object.isFrozen(site.exit)).toBe(true);
  });

  it('Scenario: Huella en un mundo mayor (4.000 × 4.000: 31–35 × 30–33, salida (2.010, 2.070))', () => {
    const r = create({}, 4000, 4000);
    const site = r.ok ? r.value.castle : null;
    expect(site && [site.firstCol, site.lastCol, site.firstRow, site.lastRow]).toEqual([
      31, 35, 30, 33,
    ]);
    expect(site?.exit).toEqual({ x: 2010, y: 2070 });
  });

  it('castleSite: la salida es el centro del rectángulo recortado de la puerta', () => {
    // 1.000 × 150: 17 × 3 celdas, la última fila de 30 px (120..150); centro (8, 1), puerta (8, 2).
    const site = castleSite({ cols: 1, rows: 1 }, { cellSize: 60, width: 1000, height: 150 });
    expect(site.ok && site.value.exit).toEqual({ x: 510, y: 135 });
  });

  it('castleSite falla con map.castle si no cabe', () => {
    const r = castleSite({ cols: 17, rows: 4 }, { cellSize: 60, width: 1920, height: 1080 });
    expect(!r.ok && r.error.field).toBe('map.castle');
  });

  it('guarda el radio del jugador con el que se validó', () => {
    const r = create({});
    expect(r.ok && r.value.playerRadius).toBe(16);
  });
});
