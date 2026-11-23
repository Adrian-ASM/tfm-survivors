import { describe, expect, it } from 'vitest';
import type { CellType } from '../../src/domain/map/CellType';
import { toMapSnapshot, type MapSnapshot } from '../../src/domain/map/MapSnapshot';
import { foamCrop, type TileDraw } from '../../src/infrastructure/phaser/map/planMapArt';
import { aDefaultConfig } from '../support/builders';
import { planFor, repoAppearance, spritesOf, worldY } from '../support/mapArt';
import { mapRules, mapWith, type Layout } from '../support/mapLayouts';
import { mapForSeed } from '../support/mapStats';

// Spec sprite-rendering (0016), "Pintado del mapa" y "Capas del mapa y de las entidades".
const RULES = mapRules();
const snap = (layout: Layout): MapSnapshot => toMapSnapshot(mapWith(RULES, layout));
const near = (a: number, b: number): void => {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
};
const APPEARANCE = repoAppearance();
const TREE_H = APPEARANCE.map.trees.sheet.frameHeight;
const CASTLE_H = APPEARANCE.map.castle.sheet.frameHeight;

/** Mapa del escenario "Elementos en su sitio". */
const PLACES: Layout = {
  '10,4': 'trunk',
  '4,3': 'water',
  '15,9': 'water',
  '16,9': 'bridge',
  '17,9': 'water',
};

/** Rectángulos de mundo de los tramos de baldosas con la textura dada. */
const tileRects = (draws: readonly { kind: string }[], texture: string) =>
  draws
    .filter((d): d is TileDraw => d.kind === 'tiles' && (d as TileDraw).texture === texture)
    .map((t) => [t.x, t.y, t.x + t.width, t.y + t.height]);

/** ¿Cubre algún rectángulo el de la celda dada? */
const covers = (rects: number[][], [l = 0, t = 0, r = 0, b = 0]: number[]) =>
  rects.some(([x0 = 0, y0 = 0, x1 = 0, y1 = 0]) => x0 <= l && y0 <= t && x1 >= r && y1 >= b);

describe('planMapArt · arte en su sitio', () => {
  it('Scenario: Elementos en su sitio (árbol, agua y puente)', () => {
    const plan = planFor(snap(PLACES));
    const [tree] = spritesOf(plan, 'trunk');
    near(tree?.x ?? 0, 630);
    near(tree?.y ?? 0, 300);
    const water = tileRects(plan.low, APPEARANCE.map.water.sheet.file);
    for (const cell of [
      [240, 180, 300, 240],
      [900, 540, 960, 600],
      [960, 540, 1020, 600],
      [1020, 540, 1080, 600],
    ]) {
      expect(covers(water, cell), String(cell)).toBe(true);
    }
    const [bridge] = spritesOf(plan, 'bridge');
    near(bridge?.x ?? 0, 990);
    near(bridge?.y ?? 0, 570);
    expect(bridge?.origin).toEqual({ x: 0.5, y: 0.5 });
  });

  it('Scenario: Castillo sobre su huella (semilla 42: origen (990, 600), (840, 360)–(1.140, 600))', () => {
    const plan = planFor(toMapSnapshot(mapForSeed(aDefaultConfig(), 42)));
    const [facade] = spritesOf(plan, 'castle');
    if (!facade) throw new Error('sin castillo');
    near(facade.x, 990);
    near(facade.y, 600);
    const { frameWidth, frameHeight } = APPEARANCE.map.castle.sheet;
    near(facade.x - facade.origin.x * frameWidth * facade.scale, 840);
    near(facade.x + (1 - facade.origin.x) * frameWidth * facade.scale, 1140);
    near(worldY(facade, frameHeight, 0), 360);
    near(worldY(facade, frameHeight, frameHeight), 600);
    expect(spritesOf(planFor(snap({})), 'castle')).toEqual([]);
  });

  it('Scenario: Tronco y copa (corte en y = 240; tronco abajo, copa en la capa alta)', () => {
    const plan = planFor(snap({ '10,4': 'trunk' }));
    const [trunk] = spritesOf(plan, 'trunk');
    const [canopy] = spritesOf(plan, 'canopy');
    if (!trunk?.crop || !canopy?.crop) throw new Error('sin recortes');
    near(worldY(trunk, TREE_H, trunk.crop.y), 240);
    expect(trunk.crop.y + trunk.crop.height).toBe(TREE_H);
    expect(canopy.crop.y).toBe(0);
    near(worldY(canopy, TREE_H, canopy.crop.height), 240);
    expect(plan.low).toContain(trunk);
    expect(plan.high).toContain(canopy);
    expect([canopy.frame, canopy.flipX, canopy.x, canopy.y]).toEqual([
      trunk.frame,
      trunk.flipX,
      trunk.x,
      trunk.y,
    ]);
  });

  it('Scenario: Jugador ante la puerta (fachada desde y = 540 abajo, tejado arriba)', () => {
    const plan = planFor(toMapSnapshot(mapForSeed(aDefaultConfig(), 42)));
    const [facade] = spritesOf(plan, 'castle');
    const [roof] = spritesOf(plan, 'roof');
    if (!facade?.crop || !roof?.crop) throw new Error('sin recortes');
    near(worldY(facade, CASTLE_H, facade.crop.y), 540);
    near(worldY(roof, CASTLE_H, roof.crop.height), 540);
    expect(plan.low).toContain(facade);
    expect(plan.high).toEqual(expect.arrayContaining([roof]));
  });

  it('Scenario: Pintado del mapa (espuma bajo la pieza de orilla, una por celda de orilla)', () => {
    const river: Record<string, CellType> = {};
    for (let c = 0; c < RULES.cols; c++) river[`${String(c)},9`] = 'water';
    const plan = planFor(snap({ ...river, '5,8': 'trunk' }));
    const foam = spritesOf(plan, 'foam');
    expect(foam).toHaveLength(64);
    const kinds = plan.low.map((d) => (d.kind === 'sprite' ? d.role : d.kind));
    const lastFoam = kinds.lastIndexOf('foam');
    const shoreFile = APPEARANCE.map.shore.sheet.file;
    const firstShore = plan.low.findIndex((d) => d.kind === 'tiles' && d.texture === shoreFile);
    const firstTrunk = kinds.indexOf('trunk');
    expect(lastFoam).toBeLessThan(firstShore);
    expect(firstShore).toBeLessThan(firstTrunk);
    const waterFile = APPEARANCE.map.water.sheet.file;
    const firstWater = plan.low.findIndex((d) => d.kind === 'tiles' && d.texture === waterFile);
    expect(firstWater).toBeLessThan(kinds.indexOf('foam'));
    expect(plan.foam?.frames).toEqual(APPEARANCE.map.foam.idle.frames);
  });

  it('foamCrop: la celda más la extensión solo en sus lados de río', () => {
    const sides = { N: false, E: false, S: true, W: false };
    expect(foamCrop(sides, 192, 64)).toEqual({ x: 64, y: 64, width: 64, height: 128 });
    const all = { N: true, E: true, S: true, W: true };
    expect(foamCrop(all, 192, 64)).toEqual({ x: 0, y: 0, width: 192, height: 192 });
    expect(foamCrop({ N: false, E: true, S: false, W: true }, 192, 64)).toEqual({
      x: 0,
      y: 64,
      width: 192,
      height: 64,
    });
  });

  it('puentes con el marco de su orientación (norte-sur en un río horizontal)', () => {
    const plan = planFor(snap(PLACES));
    const [bridge] = spritesOf(plan, 'bridge');
    expect(bridge?.frame).toBe('bridge-north-south');
  });
});
