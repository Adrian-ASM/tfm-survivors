import { describe, expect, it } from 'vitest';
import { toMapSnapshot, type MapSnapshot } from '../../src/domain/map/MapSnapshot';
import type { RectDraw, SpriteDraw } from '../../src/infrastructure/phaser/map/planMapArt';
import { aDefaultConfig } from '../support/builders';
import { HOUSE_AT_20_10, aCampsConfig, startDeclared, startOn } from '../support/camps';
import { planFor, repoAppearance } from '../support/mapArt';
import { mapForSeed } from '../support/mapStats';
import { startSeededRun } from '../support/runs';

// Spec sprite-rendering (0021), "Pintado de las estructuras": plan del mapa con casas, torres y sus
// ruinas, sin motor. Casa de prueba: columnas 20–21 y filas 10–12 (fila inferior en y [720, 780]).
const APPEARANCE = repoAppearance();
const HOUSE = APPEARANCE.structures['goblin-house'];
const TOWER = APPEARANCE.structures['goblin-tower'];
const COLORS = APPEARANCE.structureColors;
/** Torre destruida del escenario de reserva: columnas 40–41 y filas 5–6. */
const TOWER_AT_40_5 = { type: 'goblin-tower', col: 40, row: 5, cols: 2, rows: 2 } as const;

const declaredMap = (...list: (typeof HOUSE_AT_20_10 | typeof TOWER_AT_40_5)[]): MapSnapshot =>
  startDeclared(aCampsConfig(), list).map;

/** Objetos del plan (en `[...low, ...high]`) de los índices dados. */
const drawsAt = (map: MapSnapshot, missing: readonly string[], indices: readonly number[]) => {
  const plan = planFor(map, 42, missing);
  const all = [...plan.low, ...plan.high];
  return indices.map((i) => all[i]);
};

const edges = (d: { bounds: { x: number; y: number; width: number; height: number } }) => [
  d.bounds.x,
  d.bounds.y,
  d.bounds.x + d.bounds.width,
  d.bounds.y + d.bounds.height,
];

describe('planMapArt · estructuras', () => {
  it('Scenario: Casa en su sitio (origen (1.260, 780), Goblin_House, partes por y = 720)', () => {
    const map = declaredMap(HOUSE_AT_20_10);
    const plan = planFor(map);
    const [house] = plan.structures;
    expect(house).toMatchObject({ id: 0, type: 'goblin-house' });
    const [low, high] = drawsAt(map, [], house?.intact ?? []) as SpriteDraw[];
    for (const s of [low, high]) {
      expect(s).toMatchObject({
        kind: 'sprite',
        x: 1260,
        y: 780,
        texture: HOUSE?.intact.sheet.file,
      });
    }
    expect(low?.role).toBe('structure');
    expect(high?.role).toBe('structure-top');
    expect(Math.abs((low?.bounds.y ?? 0) - 720)).toBeLessThanOrEqual(1);
    expect((low?.bounds.y ?? 0) + (low?.bounds.height ?? 0)).toBe(780);
    expect(Math.abs((high?.bounds.y ?? 0) + (high?.bounds.height ?? 0) - 720)).toBeLessThanOrEqual(
      1,
    );
    // La parte baja va en la capa baja y la alta en la alta, las dos tras el castillo (al final).
    const lowIndex = house?.intact[0] ?? -1;
    const highIndex = house?.intact[1] ?? -1;
    expect(lowIndex).toBeLessThan(plan.low.length);
    expect(highIndex).toBeGreaterThanOrEqual(plan.low.length);
    // La ruina, con el mismo origen y su hoja.
    const ruin = drawsAt(map, [], house?.ruin ?? []) as SpriteDraw[];
    expect(ruin.map((s) => [s.x, s.y, s.texture])).toEqual([
      [1260, 780, HOUSE?.ruin.sheet.file],
      [1260, 780, HOUSE?.ruin.sheet.file],
    ]);
    expect(house?.fallback).toEqual({ intact: false, ruin: false });
  });

  it('Scenario: Reserva de las estructuras (sin Goblin_House: casa en rectángulo, torre con su ruina)', () => {
    const map = declaredMap(HOUSE_AT_20_10, TOWER_AT_40_5);
    const missing = [HOUSE?.intact.sheet.file ?? ''];
    const plan = planFor(map, 42, missing);
    const [house, tower] = plan.structures;
    const intact = drawsAt(map, missing, house?.intact ?? []) as RectDraw[];
    expect(intact).toHaveLength(1);
    expect(intact[0]).toMatchObject({ kind: 'rect', color: COLORS['goblin-house'] });
    expect(edges(intact[0] as RectDraw)).toEqual([1200, 600, 1320, 780]);
    expect(house?.fallback).toEqual({ intact: true, ruin: false });
    const towerRuin = drawsAt(map, missing, tower?.ruin ?? []) as SpriteDraw[];
    const ruinFile = TOWER?.ruin.sheet.file;
    expect(towerRuin.map((s) => [s.kind, s.texture])).toEqual([
      ['sprite', ruinFile],
      ['sprite', ruinFile],
    ]);
  });

  it('Scenario: Reserva de las estructuras (sin Wood_Tower_Destroyed: ruina de la torre en rectángulo)', () => {
    const map = declaredMap(HOUSE_AT_20_10, TOWER_AT_40_5);
    const missing = [TOWER?.ruin.sheet.file ?? ''];
    const plan = planFor(map, 42, missing);
    const [house, tower] = plan.structures;
    const ruin = drawsAt(map, missing, tower?.ruin ?? []) as RectDraw[];
    expect(ruin).toHaveLength(1);
    expect(ruin[0]).toMatchObject({ kind: 'rect', color: COLORS['ruin'] });
    expect(edges(ruin[0] as RectDraw)).toEqual([2400, 300, 2520, 420]);
    expect(tower?.fallback).toEqual({ intact: false, ruin: true });
    const intact = drawsAt(map, missing, house?.intact ?? []) as SpriteDraw[];
    const file = HOUSE?.intact.sheet.file;
    expect(intact.map((s) => [s.kind, s.texture])).toEqual([
      ['sprite', file],
      ['sprite', file],
    ]);
  });

  it('cada objeto del plan pertenece como mucho a un aspecto de una estructura', () => {
    const plan = planFor(declaredMap(HOUSE_AT_20_10, TOWER_AT_40_5));
    const indices = plan.structures.flatMap((s) => [...s.intact, ...s.ruin]);
    expect(new Set(indices).size).toBe(indices.length);
    expect(indices).toHaveLength(8);
  });
});

/** Objetos del mapa de antes de este change (0017/0018): 667 (42) y 750 (123). */
const OBJECTS_BEFORE: Readonly<Record<42 | 123, number>> = { 42: 667, 123: 750 };
const MAX_MAP_OBJECTS = 1000;

describe('planMapArt · totales con estructuras (semillas 42 y 123)', () => {
  it.each([42, 123] as const)('Scenario: Presupuesto de objetos con estructuras (%i)', (seed) => {
    const map = startSeededRun(aDefaultConfig(), seed).map;
    const plan = planFor(map, seed);
    expect(plan.objects).toBeLessThanOrEqual(MAX_MAP_OBJECTS);
    expect(plan.structures.map((s) => s.id)).toEqual(map.structures.map((s) => s.id));
    const all = [...plan.low, ...plan.high];
    for (const s of map.structures) {
      const planned = plan.structures.find((p) => p.id === s.id);
      const sprites = [...(planned?.intact ?? []), ...(planned?.ruin ?? [])].map((i) => all[i]);
      expect(sprites.length).toBeGreaterThan(0);
      for (const d of sprites) {
        expect(d).toMatchObject({ kind: 'sprite', x: s.x, y: (s.row + s.rows) * map.cellSize });
      }
    }
  });

  // 695 (42) y 778 (123): las de antes más 4 objetos por cada una de las 7 estructuras.
  it.each([42, 123] as const)('Scenario: Totales del mapa con estructuras (%i)', (seed) => {
    const withStructures = planFor(startSeededRun(aDefaultConfig(), seed).map, seed);
    const before = planFor(toMapSnapshot(mapForSeed(aDefaultConfig(), seed)), seed);
    expect(before.objects).toBe(OBJECTS_BEFORE[seed]);
    expect(withStructures.cells).toEqual(before.cells);
    expect(withStructures.counts).toEqual(before.counts);
    const pieces = withStructures.structures.reduce(
      (n, s) => n + s.intact.length + s.ruin.length,
      0,
    );
    expect(pieces).toBe(4 * withStructures.structures.length);
    // 0022: más 2 objetos por veta (activa y agotada).
    const veins = withStructures.veins.reduce((n, v) => n + v.intact.length + v.ruin.length, 0);
    expect(veins).toBe(2 * withStructures.veins.length);
    // 0026: más 6 objetos por solar (obra, casa y torre, con su parte baja y alta).
    const sites = withStructures.sites.reduce(
      (n, s) => n + s.free.length + s.house.length + s.tower.length,
      0,
    );
    expect(sites).toBe(6 * withStructures.sites.length);
    expect(withStructures.objects).toBe(OBJECTS_BEFORE[seed] + pieces + veins + sites);
    expect(withStructures.objects - veins - sites).toBe(seed === 42 ? 695 : 778);
  });
});

// Spec sprite-rendering (0022): "Pintado de las vetas" y "Sonda de render" (parte sin motor).
describe('planMapArt · vetas', () => {
  const veinMap = (veins: readonly { x: number; y: number }[]) =>
    startOn(aCampsConfig(), { kind: 'open', resources: { veins } }).map;

  it('Scenario: Veta activa en su sitio (origen (1.000, 1.000), GoldMine_Active, capa baja)', () => {
    const map = veinMap([{ x: 1000, y: 1000 }]);
    const plan = planFor(map);
    const [vein] = plan.veins;
    expect(vein).toMatchObject({ id: 0, type: 'vein', fallback: { intact: false, ruin: false } });
    const [active] = drawsAt(map, [], vein?.intact ?? []) as SpriteDraw[];
    const [depleted] = drawsAt(map, [], vein?.ruin ?? []) as SpriteDraw[];
    expect(active).toMatchObject({ kind: 'sprite', role: 'vein', x: 1000, y: 1000 });
    expect(active?.texture).toBe(APPEARANCE.veins.active.sheet.file);
    expect(depleted).toMatchObject({ kind: 'sprite', x: 1000, y: 1000 });
    expect(depleted?.texture).toBe(APPEARANCE.veins.depleted.sheet.file);
    // En la capa baja: bajo las entidades (las pinta la escena después).
    expect((vein?.intact[0] ?? Infinity) < plan.low.length).toBe(true);
  });

  it('reserva: sin hoja, un círculo del color de la veta de su radio de contacto', () => {
    const map = veinMap([{ x: 1000, y: 1000 }]);
    const missing = [APPEARANCE.veins.active.sheet.file];
    const plan = planFor(map, 42, missing);
    const [vein] = plan.veins;
    const [circle] = drawsAt(map, missing, vein?.intact ?? []);
    const r = aCampsConfig().resources.goldVeins.radius;
    expect(circle).toMatchObject({ kind: 'circle', x: 1000, y: 1000, radius: r });
    expect(circle?.bounds).toEqual({ x: 1000 - r, y: 1000 - r, width: 2 * r, height: 2 * r });
    expect(vein?.fallback).toEqual({ intact: true, ruin: false });
  });

  it.each([42, 123] as const)(
    'Scenario: Tope de objetos con las vetas (%i: los de antes más los de las vetas, ≤ 1.000)',
    (seed) => {
      const map = startSeededRun(aDefaultConfig(), seed).map;
      const plan = planFor(map, seed);
      expect(plan.veins).toHaveLength(map.veins.length);
      // 0026: más los 6 objetos de cada solar (737 y 820 en total).
      const sites = 6 * map.sites.length;
      expect(plan.objects).toBe((seed === 42 ? 695 : 778) + 2 * map.veins.length + sites);
      expect(plan.objects).toBeLessThanOrEqual(MAX_MAP_OBJECTS);
    },
  );

  it('Scenario: Totales del mapa con estructuras y vetas (mapa vacío: ninguna veta)', () => {
    const plan = planFor(startDeclared(aCampsConfig(), []).map);
    expect(plan.veins).toEqual([]);
  });
});
