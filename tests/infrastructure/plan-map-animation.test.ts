import { describe, expect, it } from 'vitest';
import type { Appearance } from '../../src/infrastructure/content/appearanceSchema';
import {
  spriteBounds,
  type LowDraw,
  type MapArtPlan,
  type SpriteDraw,
} from '../../src/infrastructure/phaser/map/planMapArt';
import { aDefaultConfig } from '../support/builders';
import { randomInputs } from '../support/inputs';
import { planFor, repoAppearance } from '../support/mapArt';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';

// Spec sprite-rendering (0029), "Animación del arte del mapa" (plan): grupos por fase de árboles y de
// torres goblin intactas; el resto del arte del mapa, estático. Plan puro, sin motor.
const CONFIG = aDefaultConfig();
const APPEARANCE = repoAppearance();
const TREE_FILE = APPEARANCE.map.trees.sheet.file;
const TOWER = APPEARANCE.structures['goblin-tower'];
const TOWER_FILE = TOWER?.intact.sheet.file ?? '';
const map42 = () => startSeededRun(CONFIG, 42).map;
const all = (plan: MapArtPlan): LowDraw[] => [...plan.low, ...plan.high];
const animated = (plan: MapArtPlan): Set<number> =>
  new Set(plan.animations.flatMap((a) => a.indices));

/** Datos de aspecto con la `idle` del árbol y de la torre intacta de un solo frame. */
const stillAppearance = (a: Appearance): Appearance => {
  const tower = a.structures['goblin-tower'];
  if (!tower) throw new Error('sin torre');
  return {
    ...a,
    map: { ...a.map, trees: { ...a.map.trees, idle: { ...a.map.trees.idle, frames: [0] } } },
    structures: {
      ...a.structures,
      'goblin-tower': {
        ...tower,
        intact: { ...tower.intact, idle: { ...tower.intact.idle, frames: [0] } },
      },
    },
  };
};

describe('planMapArt · grupos de animación (0029)', () => {
  it('Scenario: Frame de un árbol según su fase (tronco y copa del mismo árbol en el mismo grupo y frame)', () => {
    const plan = planFor(map42(), 42);
    const draws = all(plan);
    const trees = plan.animations.filter((a) => a.fps === 4);
    expect(trees.length).toBeGreaterThanOrEqual(2);
    for (const g of trees) {
      const roles = g.indices.map((i) => (draws[i] as SpriteDraw).role);
      expect(roles.filter((r) => r === 'trunk')).toHaveLength(roles.length / 2);
      expect(roles.filter((r) => r === 'canopy')).toHaveLength(roles.length / 2);
      for (const i of g.indices) expect((draws[i] as SpriteDraw).frame).toBe(g.frames[g.phase]);
    }
    const inTrees = trees.reduce((n, g) => n + g.indices.length, 0);
    expect(inTrees).toBe(2 * plan.counts.tree.painted);
  });

  it('Scenario: Frame de una torre según su fase (sus dos partes en el mismo grupo; 4 frames a 5 fps)', () => {
    const plan = planFor(map42(), 42);
    const towers = plan.structures.filter((s) => s.type === 'goblin-tower');
    expect(towers.length).toBeGreaterThan(0);
    for (const t of towers) {
      const group = plan.animations.find((a) => t.intact.every((i) => a.indices.includes(i)));
      expect(group).toMatchObject({ frames: [0, 1, 2, 3], fps: 5 });
      expect(group?.phase).toBeGreaterThanOrEqual(0);
      expect(group?.phase).toBeLessThanOrEqual(3);
    }
  });

  it('Scenario: Elementos estáticos (ruinas, casas, vetas, solares, castillo, puentes y decoración sin grupo)', () => {
    const plan = planFor(map42(), 42);
    const draws = all(plan);
    const groups = animated(plan);
    const still = [
      ...plan.structures.flatMap((s) =>
        s.type === 'goblin-tower' ? s.ruin : [...s.intact, ...s.ruin],
      ),
      ...plan.veins.flatMap((v) => [...v.intact, ...v.ruin]),
      ...plan.sites.flatMap((s) => [...s.free, ...s.house, ...s.tower]),
      ...draws.flatMap((d, i) =>
        d.kind !== 'sprite' || ['trunk', 'canopy', 'structure', 'structure-top'].includes(d.role)
          ? []
          : [i],
      ),
    ];
    expect(still.length).toBeGreaterThan(0);
    expect(still.filter((i) => groups.has(i))).toEqual([]);
    expect(draws.some((d) => d.kind === 'sprite' && d.role === 'decor')).toBe(true);
  });

  it('Scenario: Caja de los objetos animados (cada frame de su idle dentro de la caja del plan)', () => {
    const plan = planFor(map42(), 42);
    const draws = all(plan);
    const sizes: Record<string, { w: number; h: number }> = {
      [TREE_FILE]: {
        w: APPEARANCE.map.trees.sheet.frameWidth,
        h: APPEARANCE.map.trees.sheet.frameHeight,
      },
      [TOWER_FILE]: {
        w: TOWER?.intact.sheet.frameWidth ?? 0,
        h: TOWER?.intact.sheet.frameHeight ?? 0,
      },
    };
    let checked = 0;
    for (const g of plan.animations) {
      for (const i of g.indices) {
        const d = draws[i] as SpriteDraw;
        const size = sizes[d.texture];
        if (!size) throw new Error(`hoja inesperada ${d.texture}`);
        for (const frame of g.frames) {
          const box = spriteBounds({ ...d, frame } as SpriteDraw, size.w, size.h);
          expect(box.x).toBeGreaterThanOrEqual(d.bounds.x - 1);
          expect(box.y).toBeGreaterThanOrEqual(d.bounds.y - 1);
          expect(box.x + box.width).toBeLessThanOrEqual(d.bounds.x + d.bounds.width + 1);
          expect(box.y + box.height).toBeLessThanOrEqual(d.bounds.y + d.bounds.height + 1);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
    // La caja no depende del reloj de render: el plan no lo recibe y es el mismo al recalcularlo.
    expect(planFor(map42(), 42).low.map((d) => d.bounds)).toEqual(plan.low.map((d) => d.bounds));
  });

  it('Scenario: Reserva de árbol y torre (sin Tree.png o sin la hoja de la torre intacta: sin grupos)', () => {
    const noTree = planFor(map42(), 42, [TREE_FILE]);
    expect(noTree.animations.some((a) => a.fps === 4)).toBe(false);
    expect(noTree.low.some((d) => d.kind === 'rect' && d.color === APPEARANCE.terrain.trunk)).toBe(
      true,
    );
    const noTower = planFor(map42(), 42, [TOWER_FILE]);
    expect(noTower.animations.some((a) => a.fps === 5)).toBe(false);
    const towers = noTower.structures.filter((s) => s.type === 'goblin-tower');
    expect(towers.every((t) => t.fallback.intact && t.intact.length === 1)).toBe(true);
  });

  it('Scenario: Animar no cambia la simulación (idle de 1 frame: mismos objetos, cajas, capas y orden; mismos snapshots)', () => {
    const shape = (plan: MapArtPlan) => ({
      low: plan.low.map((d) => [d.kind, d.kind === 'sprite' ? d.role : '', d.bounds]),
      high: plan.high.map((d) => [d.role, d.bounds]),
    });
    const repo = planFor(map42(), 42);
    const still = planFor(map42(), 42, [], { appearance: stillAppearance });
    expect(still.animations).toEqual([]);
    expect(shape(still)).toEqual(shape(repo));
    const inputs = randomInputs(1200, 29);
    const play = (appearance?: (a: Appearance) => Appearance) => {
      const run = startSeededRun(CONFIG, 42);
      const out: string[] = [];
      for (const input of inputs) {
        chooseFirstWhileOpen(run);
        planFor(run.map, 42, [], appearance ? { appearance } : {});
        run.tick(input);
        out.push(JSON.stringify(run.snapshot()));
      }
      return out;
    };
    expect(play(stillAppearance)).toEqual(play());
  });
});
