import { describe, expect, it } from 'vitest';
import type { CellType } from '../../src/domain/map/CellType';
import { toMapSnapshot, type MapSnapshot } from '../../src/domain/map/MapSnapshot';
import { followView } from '../../src/infrastructure/phaser/CameraRig';
import { clipRect, cullMargin, touches } from '../../src/infrastructure/phaser/map/mapCulling';
import {
  foamCrop,
  spriteBounds,
  type Box,
  type TileDraw,
} from '../../src/infrastructure/phaser/map/planMapArt';
import { DEFAULT_MAX_VIEW, aDefaultConfig } from '../support/builders';
import { WORLD, planFor, repoAppearance, spritesOf, worldY } from '../support/mapArt';
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
  it('Scenario: Elementos en su sitio (árbol, agua y puente; sin decoración: mapa explícito)', () => {
    const plan = planFor(snap(PLACES));
    expect(plan.decor).toEqual([]);
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

  it('Scenario: Castillo sobre su huella (semilla 42: origen (1.950, 1.140), (1.800, 900)–(2.100, 1.140))', () => {
    const plan = planFor(toMapSnapshot(mapForSeed(aDefaultConfig(), 42)));
    const [facade] = spritesOf(plan, 'castle');
    if (!facade) throw new Error('sin castillo');
    near(facade.x, 1950);
    near(facade.y, 1140);
    const { frameWidth, frameHeight } = APPEARANCE.map.castle.sheet;
    near(facade.x - facade.origin.x * frameWidth * facade.scale, 1800);
    near(facade.x + (1 - facade.origin.x) * frameWidth * facade.scale, 2100);
    near(worldY(facade, frameHeight, 0), 900);
    near(worldY(facade, frameHeight, frameHeight), 1140);
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

  it('Scenario: Jugador ante la puerta (fachada desde y = 1.080 abajo, tejado arriba)', () => {
    const plan = planFor(toMapSnapshot(mapForSeed(aDefaultConfig(), 42)));
    const [facade] = spritesOf(plan, 'castle');
    const [roof] = spritesOf(plan, 'roof');
    if (!facade?.crop || !roof?.crop) throw new Error('sin recortes');
    near(worldY(facade, CASTLE_H, facade.crop.y), 1080);
    near(worldY(roof, CASTLE_H, roof.crop.height), 1080);
    expect(plan.low).toContain(facade);
    expect(plan.high).toEqual(expect.arrayContaining([roof]));
  });

  it('Scenario: Pintado del mapa (espuma bajo la pieza de orilla, una por celda de orilla)', () => {
    const river: Record<string, CellType> = {};
    for (let c = 0; c < RULES.cols; c++) river[`${String(c)},9`] = 'water';
    const plan = planFor(snap({ ...river, '5,8': 'trunk' }));
    const foam = spritesOf(plan, 'foam');
    expect(foam).toHaveLength(2 * RULES.cols);
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

  it('Recorte del arte del mapa por cámara (0018): cada tramo tiene por caja su rectángulo', () => {
    const plan = planFor(snap(PLACES));
    const tiles = plan.low.filter((d): d is TileDraw => d.kind === 'tiles');
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.map((t) => t.bounds)).toEqual(
      tiles.map(({ x, y, width, height }) => ({ x, y, width, height })),
    );
    const water = tiles.filter((t) => t.texture === APPEARANCE.map.water.sheet.file);
    const boxes = water.map(({ bounds: b }) => [b.x, b.y, b.x + b.width, b.y + b.height]);
    expect(covers(boxes, [240, 180, 300, 240])).toBe(true);
    expect(plan.cellSize).toBe(60);
  });

  it('puentes con el marco de su orientación (norte-sur en un río horizontal)', () => {
    const plan = planFor(snap(PLACES));
    const [bridge] = spritesOf(plan, 'bridge');
    expect(bridge?.frame).toBe('bridge-north-south');
  });
});

// Spec sprite-rendering (0018): caja de cada sprite del plan (origen, escala, recorte y volteo).
const nearBox = (b: Box | undefined, [x1, y1, x2, y2]: number[]): void => {
  if (!b) throw new Error('sin caja');
  near(b.x, x1 ?? 0);
  near(b.y, y1 ?? 0);
  near(b.x + b.width, x2 ?? 0);
  near(b.y + b.height, y2 ?? 0);
};
const SEED_42_PLAN = () => planFor(toMapSnapshot(mapForSeed(aDefaultConfig(), 42)));

describe('planMapArt · cajas de los sprites (0018)', () => {
  it('Scenario: Partes del castillo por separado (cajas del tejado y de la fachada, semilla 42)', () => {
    const plan = SEED_42_PLAN();
    nearBox(spritesOf(plan, 'roof')[0]?.bounds, [1800, 900, 2100, 1080]);
    nearBox(spritesOf(plan, 'castle')[0]?.bounds, [1800, 1080, 2100, 1140]);
  });

  it('árbol con origen (630, 300): tronco + copa = caja del frame entero', () => {
    const plan = planFor(snap(PLACES));
    const [trunk] = spritesOf(plan, 'trunk');
    const [canopy] = spritesOf(plan, 'canopy');
    if (!trunk || !canopy) throw new Error('sin árbol');
    const { frameWidth: w, frameHeight: h } = APPEARANCE.map.trees.sheet;
    const k = trunk.scale;
    const left = 630 - trunk.origin.x * w * k;
    const top = 300 - trunk.origin.y * h * k;
    nearBox(canopy.bounds, [left, top, left + w * k, worldY(canopy, h, canopy.crop?.height ?? 0)]);
    nearBox(trunk.bounds, [
      left,
      canopy.bounds.y + canopy.bounds.height,
      left + w * k,
      top + h * k,
    ]);
  });

  it('puente centrado en (990, 570) con el tamaño de su recorte', () => {
    const [bridge] = spritesOf(planFor(snap(PLACES)), 'bridge');
    const rect = APPEARANCE.map.bridges.frames.northSouth;
    if (!bridge) throw new Error('sin puente');
    const w = rect.width * bridge.scale;
    const h = rect.height * bridge.scale;
    nearBox(bridge.bounds, [990 - w / 2, 570 - h / 2, 990 + w / 2, 570 + h / 2]);
  });

  it('flipX con recorte asimétrico: unión del recorte y de su espejo', () => {
    const sprite = {
      x: 100,
      y: 200,
      scale: 2,
      origin: { x: 0.5, y: 1 },
      flipX: true,
      crop: { x: 10, y: 40, width: 20, height: 60 },
    };
    // Frame 100 × 100: recorte en x 10..30 y su espejo en 70..90 → unión 10..90.
    expect(spriteBounds(sprite, 100, 100)).toEqual({ x: 20, y: 80, width: 160, height: 120 });
    expect(spriteBounds({ ...sprite, flipX: false }, 100, 100)).toEqual({
      x: 20,
      y: 80,
      width: 40,
      height: 120,
    });
    expect(spriteBounds({ ...sprite, crop: null }, 100, 100)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
  });
});

// "Partes del castillo por separado" con la regla del juego (M = 1 celda).
describe('planMapArt + recorte · castillo (0018)', () => {
  const M = cullMargin(60);
  const roofAndFacade = (bottom: number): boolean[] => {
    const plan = SEED_42_PLAN();
    const view = { x: 1280, y: bottom - 720, width: 1280, height: 720 };
    const rect = clipRect(view, M);
    return [spritesOf(plan, 'roof')[0], spritesOf(plan, 'castle')[0]].map(
      (s) => !!s && touches(s.bounds, rect),
    );
  };

  it('Scenario: Partes del castillo por separado (borde inferior en y = 1.080 − M − 1)', () => {
    expect(roofAndFacade(1080 - M - 1)).toEqual([true, false]);
  });

  it('Scenario: Partes del castillo por separado (borde inferior en y = 900 − M: el tejado toca)', () => {
    expect(roofAndFacade(900 - M)).toEqual([true, false]);
  });

  it('Scenario: Partes del castillo por separado (borde inferior en y = 900 − M − 1: ninguna)', () => {
    expect(roofAndFacade(900 - M - 1)).toEqual([false, false]);
  });
});

/** Posiciones del jugador de la rejilla de paso 60 px que cubre el mundo, con los extremos. */
function gridPositions(step = 60): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let x = 0; x <= WORLD.width; x += step) {
    for (let y = 0; y <= WORLD.height; y += step) out.push({ x, y });
  }
  return out;
}

describe('planMapArt + recorte · todo el plan se puede ver (0018)', () => {
  const views = [
    { width: 960, height: 540 },
    { width: 1280, height: 720 },
    // Ventana de 3.840 × 2.160 recortada al tope maxView.
    { width: DEFAULT_MAX_VIEW.width, height: DEFAULT_MAX_VIEW.height },
  ];

  it.each([42, 123])(
    'Scenario: Todo el plan se puede ver (semilla %i, tres ventanas, decoración incluida)',
    (seed) => {
      const plan = planFor(toMapSnapshot(mapForSeed(aDefaultConfig(), seed)), seed);
      expect(spritesOf(plan, 'decor').length).toBeGreaterThan(0);
      const boxes = [...plan.low, ...plan.high].map((d) => d.bounds);
      const M = cullMargin(plan.cellSize);
      const world = { x: 0, y: 0, ...WORLD };
      const unseen: string[] = [];
      for (const size of views) {
        const seen = new Uint8Array(boxes.length);
        for (const p of gridPositions()) {
          const rect = clipRect(followView(p, size, WORLD), M);
          boxes.forEach((b, i) => {
            if (!seen[i] && touches(b, rect)) seen[i] = 1;
          });
        }
        if (seen.includes(0)) unseen.push(`${String(size.width)}: ${String(seen.indexOf(0))}`);
      }
      expect(unseen).toEqual([]);
      expect(boxes.every((b) => touches(b, world))).toBe(true);
      expect(boxes).toHaveLength(plan.objects);
    },
  );
});
