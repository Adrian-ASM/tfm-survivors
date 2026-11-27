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

// Spec sprite-rendering (0031; 0036: solo las estructuras dañadas), "Barras de vida de las
// estructuras", con un doble de `Graphics`.
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

  it('Scenario: Sin barras al empezar (semilla 42: 7 estructuras a vida máxima, 601 frames)', () => {
    const s = startSeededRun(aDefaultConfig(), 42).snapshot();
    expect(s.structures).toHaveLength(7);
    expect(s.structures.every((x) => x.health === x.maxHealth && !x.destroyed)).toBe(true);
    const { canvas, layer } = bars();
    const seen = Array.from({ length: 601 }, () => {
      layer.sync(s.structures);
      return [layer.drawn, canvas.rects.length];
    });
    expect(seen.every(([d, r]) => d === 0 && r === 0)).toBe(true);
  });

  it('Scenario: Golpe que deja la estructura en ruina', () => {
    const config = withWeapons(aCampScenario(), weaponsOf([LINTER]));
    const setup = { player: { x: 1260, y: 990 }, structures: [{ health: 4 }] };
    const run = startDeclared(config, [HOUSE_AT_20_10], setup);
    const { canvas, layer } = bars();
    // Vida 4 de 60 en n − 1: ya es una estructura dañada y tiene barra (ver la nota del informe).
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
    // 0036: la casa a vida máxima no está dañada (sin barra); enemigos, ovejas y solares no son
    // estructuras del snapshot y no llegan a la capa.
    const house = aStructure({ id: 1, col: 30, x: 1860, health: 60, maxHealth: 60 });
    layer.sync([tower, house]);
    expect(layer.drawn).toBe(1);
    const fills = canvas.rects.filter((r) => r.color === BAR.fill);
    expect(fills).toHaveLength(1);
    expect(fills[0]?.w).toBeCloseTo(33.6, 10);
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
    // Primer frame: ninguna dañada, ninguna barra (0036).
    a.layer.sync(s.structures);
    b.layer.sync(s.structures);
    expect([a.layer.drawn, b.layer.drawn]).toEqual([0, 0]);
    // La primera casa en 30 de 60: la misma barra con su hoja y con la reserva.
    const first = s.structures.findIndex((x) => x.type === 'goblin-house');
    const hurt = s.structures.map((x, i) => (i === first ? { ...x, health: 30 } : x));
    a.layer.sync(hurt);
    b.layer.sync(hurt);
    expect(drawnBars(b.canvas)).toEqual(drawnBars(a.canvas));
    expect(a.layer.drawn).toBe(1);
    expect(a.canvas.rects.find((r) => r.color === BAR.fill)?.w).toBe(24);
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

// Spec sprite-rendering (0036): la barra aparece con el primer daño y se conserva hasta la ruina o
// hasta una partida nueva (memoria de la vista por id).
describe('Barras desde el primer daño (sprite-rendering 0036)', () => {
  it('Scenario: La barra aparece con el primer daño (60 ⇒ 56 en el tick n)', () => {
    const { canvas, layer } = bars();
    const frames = [60, 60, ...Array<number>(61).fill(56)].map((health) => aStructure({ health }));
    const seen = frames.map((x) => {
      layer.sync([x]);
      const fill = canvas.rects.find((r) => r.color === BAR.fill);
      return [layer.drawn, fill?.w ?? null];
    });
    expect(seen.slice(0, 2)).toEqual([
      [0, null],
      [0, null],
    ]);
    for (const [drawn, w] of seen.slice(2)) {
      expect(drawn).toBe(1);
      expect(Math.abs((w ?? 0) - (48 * 56) / 60)).toBeLessThanOrEqual(0.5);
    }
  });

  it('Scenario: La barra se conserva hasta la ruina (torre 63 de 90 en n, destruida en m)', () => {
    const { layer } = bars();
    const tower = (o: Partial<StructureSnapshot>) =>
      aStructure({ type: 'goblin-tower', maxHealth: 90, ...o });
    const damaged = Array.from({ length: 30 }, () => tower({ health: 63 }));
    const ruined = Array.from({ length: 61 }, () => tower({ health: 0, destroyed: true }));
    const drawn = [...damaged, ...ruined].map((x) => {
      layer.sync([x]);
      return layer.drawn;
    });
    expect(drawn.slice(0, 30).every((d) => d === 1)).toBe(true);
    expect(drawn.slice(30).every((d) => d === 0)).toBe(true);
  });

  it('Scenario: Dañada aunque vuelva a la vida máxima (50 ⇒ 60 de 60: barra llena)', () => {
    const { canvas, layer } = bars();
    layer.sync([aStructure({ health: 50 })]);
    expect(layer.drawn).toBe(1);
    layer.sync([aStructure({ health: 60 })]);
    expect(layer.drawn).toBe(1);
    expect(canvas.rects.find((r) => r.color === BAR.fill)?.w).toBe(48);
  });

  it('Scenario: Golpe que deja la estructura en ruina (dañada y destruida entre dos frames)', () => {
    const { canvas, layer } = bars();
    layer.sync([aStructure({ health: 60 })]);
    layer.sync([aStructure({ health: 0, destroyed: true })]);
    expect([layer.drawn, canvas.rects.length]).toEqual([0, 0]);
  });

  it('Scenario: Partida nueva sin barras (clear y setCellSize olvidan los ids dañados)', () => {
    for (const reset of ['clear', 'setCellSize'] as const) {
      const { layer } = bars();
      layer.sync([aStructure({ id: 0, health: 30 }), aStructure({ id: 1, col: 30, health: 40 })]);
      expect(layer.drawn).toBe(2);
      if (reset === 'clear') layer.clear();
      else layer.setCellSize(CELL);
      layer.sync([aStructure({ id: 0, health: 60 }), aStructure({ id: 1, col: 30, health: 60 })]);
      expect(layer.drawn, reset).toBe(0);
    }
  });

  it('sin clear ni setCellSize la memoria se conserva entre frames (un RESIZE no los llama)', () => {
    const { layer } = bars();
    layer.sync([aStructure({ health: 30 })]);
    layer.sync([aStructure({ health: 60 })]);
    layer.sync([aStructure({ health: 60 })]);
    expect(layer.drawn).toBe(1);
  });
});
