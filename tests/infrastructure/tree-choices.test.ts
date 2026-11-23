import { describe, expect, it } from 'vitest';
import appearanceJson from '../../content/appearance.json';
import { toMapSnapshot } from '../../src/domain/map/MapSnapshot';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { treeModel, treeModels } from '../../src/infrastructure/phaser/map/treeChoices';
import { DECOR_STREAM, MAP_STREAM, deriveSeed } from '../../src/infrastructure/random/deriveSeed';
import { BALANCE_SEEDS } from '../support/balanceSeeds';
import { aDefaultConfig } from '../support/builders';
import { randomInputs } from '../support/inputs';
import { mapRules, mapWith } from '../support/mapLayouts';
import { mapForSeed } from '../support/mapStats';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';

// Spec sprite-rendering (0016), "Variedad de árboles por semilla" (design §12.2 B8).
const TREES = appearanceJson.map.trees;
const decor = (seed: number) => deriveSeed(seed, DECOR_STREAM);
const key = (m: { frame: number; flipX: boolean }) => `${String(m.frame)}${m.flipX ? 'f' : ''}`;

describe('treeChoices', () => {
  it('DECOR_STREAM es un flujo propio, distinto del del mapa', () => {
    expect(DECOR_STREAM).toBe(2);
    expect(DECOR_STREAM).not.toBe(MAP_STREAM);
  });

  it('treeModel es una función de la semilla y la celda (sin estado)', () => {
    const a = treeModel(decor(42), 130, TREES.models, true);
    expect(treeModel(decor(42), 130, TREES.models, true)).toEqual(a);
    expect(TREES.models.map((m) => m.frame)).toContain(a.frame);
    expect(treeModel(decor(42), 130, TREES.models, false).flipX).toBe(false);
  });

  it('Scenario: Mismos modelos con la misma semilla (dos cálculos, semilla 42)', () => {
    const map = toMapSnapshot(mapForSeed(aDefaultConfig(), 42));
    const first = treeModels(map, decor(42), TREES).map(key);
    expect(first.length).toBe(map.counts.trunk);
    expect(treeModels(map, decor(42), TREES).map(key)).toEqual(first);
  });

  it('Scenario: Variedad dentro de un mapa (1..50: ≥ 2 modelos por mapa)', () => {
    const poor = BALANCE_SEEDS.filter((seed) => {
      const map = toMapSnapshot(mapForSeed(aDefaultConfig(), seed));
      const frames = new Set(treeModels(map, decor(seed), TREES).map((m) => m.frame));
      return frames.size < 2;
    });
    expect(poor).toEqual([]);
  });

  it('Scenario: Otra semilla, otros modelos (20 troncos, semillas 42 y 43)', () => {
    const layout: Record<string, 'trunk'> = {};
    for (let r = 2; r <= 5; r++)
      for (let c = 2; c <= 6; c++) layout[`${String(c)},${String(r)}`] = 'trunk';
    const map = toMapSnapshot(mapWith(mapRules(), layout));
    const a = treeModels(map, decor(42), TREES).map(key);
    const b = treeModels(map, decor(43), TREES).map(key);
    expect(a).toHaveLength(20);
    expect(a).not.toEqual(b);
  });

  it('Scenario: La variedad no toca la simulación (semilla 42, 1.200 ticks, 1 modelo frente a 6)', () => {
    const inputs = randomInputs(1200, 7);
    const play = (trees: typeof TREES) => {
      const run = startSeededRun(aDefaultConfig(), 42);
      const out: { snap: RunSnapshot; cells: string }[] = [];
      for (const input of inputs) {
        chooseFirstWhileOpen(run);
        treeModels(run.map, decor(42), trees);
        run.tick(input);
        out.push({ snap: run.snapshot(), cells: run.map.cells.join() });
      }
      return out;
    };
    const one = { ...TREES, models: [{ frame: 0 }], flip: false };
    expect(play(TREES)).toEqual(play(one));
  });
});
