import { describe, expect, it } from 'vitest';
import { toMapSnapshot, type MapSnapshot } from '../../src/domain/map/MapSnapshot';
import type {
  ElementCount,
  MapArtPlan,
  RectDraw,
} from '../../src/infrastructure/phaser/map/planMapArt';
import { shoreCells } from '../../src/infrastructure/phaser/map/shoreTiles';
import { aDefaultConfig } from '../support/builders';
import { planFor, repoAppearance, spritesOf } from '../support/mapArt';
import { mapRules, mapWith, type Layout } from '../support/mapLayouts';
import { mapForSeed } from '../support/mapStats';

// Spec sprite-rendering (0016), "Pintado del mapa" (reserva por elemento) y "Sonda de render".
const RULES = mapRules();
const snap = (layout: Layout): MapSnapshot => toMapSnapshot(mapWith(RULES, layout));
const { terrain, map: MAP } = repoAppearance();
const PLACES: Layout = {
  '10,4': 'trunk',
  '4,3': 'water',
  '15,9': 'water',
  '16,9': 'bridge',
  '17,9': 'water',
};
const SEED_42 = () => toMapSnapshot(mapForSeed(aDefaultConfig(), 42));

const rects = (plan: MapArtPlan, color: number) =>
  plan.low
    .filter((d): d is RectDraw => d.kind === 'rect' && d.color === color)
    .map((r) => [r.x, r.y, r.x + r.width, r.y + r.height]);
const tilesOf = (plan: MapArtPlan, texture: string) =>
  plan.low.filter((d) => d.kind === 'tiles' && d.texture === texture);
const objectsOf = (plan: MapArtPlan) => plan.low.length + plan.high.length;

describe('planMapArt · reserva por elemento', () => {
  it('Scenario: Reserva de cada elemento (sin agua: 3 rectángulos water, el resto con arte)', () => {
    const plan = planFor(snap(PLACES), 42, [MAP.water.sheet.file]);
    expect(rects(plan, terrain.water).sort()).toEqual(
      [
        [240, 180, 300, 240],
        [900, 540, 960, 600],
        [1020, 540, 1080, 600],
      ].sort(),
    );
    expect(spritesOf(plan, 'bridge')).toHaveLength(1);
    expect(spritesOf(plan, 'trunk')).toHaveLength(1);
    expect(spritesOf(plan, 'foam').length).toBeGreaterThan(0);
  });

  it('Scenario: Reserva de cada elemento (sin árbol: 1 rectángulo trunk y sin copa)', () => {
    const plan = planFor(snap(PLACES), 42, [MAP.trees.sheet.file]);
    expect(rects(plan, terrain.trunk)).toEqual([[600, 240, 660, 300]]);
    expect([spritesOf(plan, 'trunk'), spritesOf(plan, 'canopy')]).toEqual([[], []]);
    expect(tilesOf(plan, MAP.water.sheet.file).length).toBeGreaterThan(0);
  });

  it('Scenario: Reserva de cada elemento (sin puente: 1 rectángulo bridge)', () => {
    const plan = planFor(snap(PLACES), 42, [MAP.bridges.image]);
    expect(rects(plan, terrain.bridge)).toEqual([[960, 540, 1020, 600]]);
    expect(spritesOf(plan, 'bridge')).toEqual([]);
  });

  it('Scenario: Reserva de cada elemento (sin espuma: no hay espuma; sin orilla: no hay orillas)', () => {
    const noFoam = planFor(snap(PLACES), 42, [MAP.foam.sheet.file]);
    expect(spritesOf(noFoam, 'foam')).toEqual([]);
    expect(noFoam.foam).toBeNull();
    expect(tilesOf(noFoam, MAP.shore.sheet.file).length).toBeGreaterThan(0);
    const noShore = planFor(snap(PLACES), 42, [MAP.shore.sheet.file]);
    expect(tilesOf(noShore, MAP.shore.sheet.file)).toEqual([]);
    expect(noShore.low.some((d) => d.kind === 'rect')).toBe(false);
  });

  it('sin orilla con arte el agua no se extiende bajo la tierra', () => {
    const plan = planFor(snap(PLACES), 42, [MAP.shore.sheet.file]);
    const area = tilesOf(plan, MAP.water.sheet.file).reduce(
      (sum, d) => sum + (d.kind === 'tiles' ? d.width * d.height : 0),
      0,
    );
    expect(area).toBe(4 * 60 * 60);
  });

  it('Scenario: Reserva del castillo (semilla 42: 1 rectángulo castle sobre la huella, sin tejado)', () => {
    const plan = planFor(SEED_42(), 42, [MAP.castle.sheet.file]);
    expect(rects(plan, terrain.castle)).toEqual([[840, 360, 1140, 600]]);
    expect([spritesOf(plan, 'castle'), spritesOf(plan, 'roof')]).toEqual([[], []]);
    expect(spritesOf(plan, 'trunk').length).toBe(SEED_42().counts.trunk);
    expect(plan.counts.castle).toEqual({ painted: 1, fallback: 1 });
  });

  it('Scenario: Celdas de castillo de un mapa explícito ((3, 3): 1 rectángulo, castillo 0)', () => {
    const plan = planFor(snap({ '3,3': 'castle' }));
    expect(rects(plan, terrain.castle)).toEqual([[180, 180, 240, 240]]);
    expect(spritesOf(plan, 'castle')).toEqual([]);
    expect(plan.cells.castle).toBe(1);
    expect(plan.counts.castle).toEqual({ painted: 0, fallback: 0 });
  });

  it('Scenario: Mapa vacío (plan vacío, 0 objetos y recuentos a 0)', () => {
    const plan = planFor(snap({}));
    expect([plan.low, plan.high, plan.objects]).toEqual([[], [], 0]);
    expect(plan.cells).toEqual({ trunk: 0, water: 0, bridge: 0, castle: 0 });
    const { water, shore, foam, tree, canopy, bridge, castle } = plan.counts;
    const counts: ElementCount[] = [water, shore, foam, tree, canopy, bridge, castle];
    expect(counts.every((c) => c.painted === 0)).toBe(true);
  });
});

describe('planMapArt · recuentos de la sonda', () => {
  it('Scenario: Recuentos del mapa pintado (semilla 42, parte pura)', () => {
    const map = SEED_42();
    const plan = planFor(map);
    const { trunk, water, bridge, castle } = map.counts;
    expect(plan.cells).toEqual({ trunk, water, bridge, castle });
    expect(castle).toBe(20);
    const shores = shoreCells(map).length;
    const none = { fallback: 0 };
    expect(plan.counts).toEqual({
      water: { painted: water, ...none },
      shore: { painted: shores, ...none },
      foam: { painted: shores, ...none },
      tree: { painted: trunk, ...none },
      canopy: { painted: trunk, ...none },
      bridge: { painted: bridge, ...none },
      castle: { painted: 1, ...none },
    });
    expect(plan.objects).toBe(objectsOf(plan));
  });

  it('reserva en los recuentos: sin árbol, árbol pintado con reserva y copa 0', () => {
    const map = SEED_42();
    const plan = planFor(map, 42, [MAP.trees.sheet.file]);
    expect(plan.counts.tree).toEqual({ painted: map.counts.trunk, fallback: map.counts.trunk });
    expect(plan.counts.canopy).toEqual({ painted: 0, fallback: 0 });
    expect(plan.objects).toBe(objectsOf(plan));
  });

  it('sin la hoja del fondo: orilla y espuma 0 (la orilla usa esa hoja)', () => {
    const plan = planFor(SEED_42(), 42, [MAP.shore.sheet.file]);
    expect(plan.counts.shore).toEqual({ painted: 0, fallback: 0 });
    expect(plan.counts.foam.painted).toBeGreaterThan(0);
  });
});
