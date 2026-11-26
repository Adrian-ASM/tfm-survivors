import { describe, expect, it } from 'vitest';
import type { StructureSnapshot } from '../../src/domain/run/RunSnapshot';
import { HealthBarLayer } from '../../src/infrastructure/phaser/HealthBarLayer';
import { HOUSE_FILE } from '../support/appearance';
import { LINTER, aDefaultConfig, withWeapons } from '../support/builders';
import { HOUSE_AT_20_10, aCampScenario, startDeclared } from '../support/camps';
import { untilHit } from '../support/combat';
import { FakeBarCanvas, REPO_COMBAT } from '../support/feedback';
import { planFor } from '../support/mapArt';
import { startSeededRun, ticks } from '../support/runs';
import { weaponsOf } from '../support/weapons';

// Spec sprite-rendering (0031), "Barras de vida de las estructuras", con un doble de `Graphics`.
const BAR = REPO_COMBAT.bar;
const CELL = 60;

function bars() {
  const canvas = new FakeBarCanvas();
  const layer = new HealthBarLayer(canvas, BAR);
  layer.setCellSize(CELL);
  return { canvas, layer };
}

/** Pares (fondo, relleno) dibujados: [x0, y0, x1, y1] de cada uno. */
const drawnBars = (canvas: FakeBarCanvas) =>
  canvas.rects.map((r) => [r.x, r.y, r.x + r.w, r.y + r.h, r.color]);

const aStructure = (o: Partial<StructureSnapshot>): StructureSnapshot => ({
  id: 0,
  type: 'goblin-house',
  x: 1260,
  y: 690,
  radius: 40,
  col: 20,
  row: 10,
  cols: 2,
  rows: 3,
  health: 30,
  maxHealth: 60,
  destroyed: false,
  ...o,
});

describe('Barras de vida de las estructuras (sprite-rendering 0031)', () => {
  it('Scenario: Barra al 50 %', () => {
    const { canvas, layer } = bars();
    layer.sync([aStructure({})]);
    expect(drawnBars(canvas)).toEqual([
      [1236, 586, 1284, 592, BAR.back],
      [1236, 586, 1260, 592, BAR.fill],
    ]);
    expect(layer.drawn).toBe(1);
  });

  it('Scenario: Barra llena al empezar', () => {
    const s = startSeededRun(aDefaultConfig(), 42).snapshot();
    const { canvas, layer } = bars();
    layer.sync(s.structures);
    expect(layer.drawn).toBe(s.structures.length);
    const fills = canvas.rects.filter((r) => r.color === BAR.fill);
    expect(fills).toHaveLength(s.structures.length);
    expect(fills.every((r) => r.w === 48)).toBe(true);
  });

  it('Scenario: Golpe que deja la estructura en ruina', () => {
    const config = withWeapons(aCampScenario(), weaponsOf([LINTER]));
    const setup = { player: { x: 1260, y: 990 }, structures: [{ health: 4 }] };
    const run = startDeclared(config, [HOUSE_AT_20_10], setup);
    const { canvas, layer } = bars();
    layer.sync(run.snapshot().structures);
    expect(layer.drawn).toBe(1);
    const n = untilHit(run);
    expect(n.hits.map((h) => [h.kind, h.amount, h.x, h.y - 20])).toEqual([
      ['structure', 4, 1260, 670],
    ]);
    const frames = [n, ...ticks(run, 60)];
    const seen = frames.map((s) => {
      layer.sync(s.structures);
      return [layer.drawn, canvas.rects.length];
    });
    expect(seen.every(([d, r]) => d === 0 && r === 0)).toBe(true);
  });

  it('Scenario: Torre dañada y sin barras en otros objetivos', () => {
    const { canvas, layer } = bars();
    const tower = aStructure({ type: 'goblin-tower', health: 63, maxHealth: 90 });
    layer.sync([tower]);
    expect(layer.drawn).toBe(1);
    expect(canvas.rects.find((r) => r.color === BAR.fill)?.w).toBeCloseTo(33.6, 10);
  });

  it('Scenario: Barras con reserva y fuera del plan del mapa', () => {
    // Las barras no entran en el plan del mapa: sus objetos siguen en 820 y 904. La barra no depende
    // del arte: se dibuja igual con la hoja de la casa sin cargar (la casa, con reserva).
    for (const [seed, objects] of [
      [42, 820],
      [123, 904],
    ] as const) {
      expect(planFor(startSeededRun(aDefaultConfig(), seed).map, seed).objects).toBe(objects);
    }
    const run = startSeededRun(aDefaultConfig(), 42);
    const s = run.snapshot();
    const fallback = planFor(run.map, 42, [HOUSE_FILE]);
    expect(fallback.structures.length).toBe(s.structures.length);
    const a = bars();
    const b = bars();
    a.layer.sync(s.structures);
    b.layer.sync(s.structures);
    expect(drawnBars(b.canvas)).toEqual(drawnBars(a.canvas));
    expect(a.layer.drawn).toBe(s.structures.length);
  });

  it('solo redibuja al cambiar la vida o la ruina', () => {
    const { canvas, layer } = bars();
    const list = [aStructure({})];
    layer.sync(list);
    layer.sync(list);
    layer.sync([aStructure({})]);
    expect(canvas.clears).toBe(2);
    layer.sync([aStructure({ health: 24 })]);
    expect(canvas.clears).toBe(3);
  });
});
