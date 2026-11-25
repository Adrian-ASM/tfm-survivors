import { describe, expect, it } from 'vitest';
import appearanceJson from '../../content/appearance.json';
import { toMapSnapshot } from '../../src/domain/map/MapSnapshot';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { treeLook, treeLooks } from '../../src/infrastructure/phaser/map/treeChoices';
import { DECOR_STREAM, MAP_STREAM, deriveSeed } from '../../src/infrastructure/random/deriveSeed';
import { BALANCE_SEEDS } from '../support/balanceSeeds';
import { aDefaultConfig } from '../support/builders';
import { randomInputs } from '../support/inputs';
import { mapRules, mapWith } from '../support/mapLayouts';
import { mapForSeed } from '../support/mapStats';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';

// Spec sprite-rendering (0016, 0029), "Variedad de árboles por semilla": fase y volteo por celda.
const TREES = appearanceJson.map.trees;
const decor = (seed: number) => deriveSeed(seed, DECOR_STREAM);
const key = (m: { phase: number; flipX: boolean }) => `${String(m.phase)}${m.flipX ? 'f' : ''}`;
const N = TREES.idle.frames.length;

describe('treeChoices', () => {
  it('DECOR_STREAM es un flujo propio, distinto del del mapa', () => {
    expect(DECOR_STREAM).toBe(2);
    expect(DECOR_STREAM).not.toBe(MAP_STREAM);
  });

  it('treeLook es una función de la semilla y la celda (sin estado), fase en [0, n − 1]', () => {
    const a = treeLook(decor(42), 130, N, true);
    expect(treeLook(decor(42), 130, N, true)).toEqual(a);
    expect(a.phase).toBeGreaterThanOrEqual(0);
    expect(a.phase).toBeLessThan(N);
    expect(treeLook(decor(42), 130, N, false).flipX).toBe(false);
  });

  it('la fase usa los mismos bits que el modelo de antes (h mod n): en R = 0, el mismo frame', () => {
    const h = deriveSeed(decor(42), 130);
    expect(treeLook(decor(42), 130, N, true).phase).toBe(h % N);
  });

  it('Scenario: Mismas fases con la misma semilla (dos cálculos, semilla 42)', () => {
    const map = toMapSnapshot(mapForSeed(aDefaultConfig(), 42));
    const first = treeLooks(map, decor(42), TREES).map(key);
    expect(first.length).toBe(map.counts.trunk);
    expect(treeLooks(map, decor(42), TREES).map(key)).toEqual(first);
  });

  it('Scenario: Variedad dentro de un mapa (1..50: ≥ 2 fases por mapa)', () => {
    const poor = BALANCE_SEEDS.filter((seed) => {
      const map = toMapSnapshot(mapForSeed(aDefaultConfig(), seed));
      const frames = new Set(treeLooks(map, decor(seed), TREES).map((m) => m.phase));
      return frames.size < 2;
    });
    expect(poor).toEqual([]);
  });

  it('Scenario: Otra semilla, otras fases (20 troncos, semillas 42 y 43)', () => {
    const layout: Record<string, 'trunk'> = {};
    for (let r = 2; r <= 5; r++)
      for (let c = 2; c <= 6; c++) layout[`${String(c)},${String(r)}`] = 'trunk';
    const map = toMapSnapshot(mapWith(mapRules(), layout));
    const a = treeLooks(map, decor(42), TREES).map(key);
    const b = treeLooks(map, decor(43), TREES).map(key);
    expect(a).toHaveLength(20);
    expect(a).not.toEqual(b);
  });

  it('Scenario: La variedad no toca la simulación (semilla 42, 1.200 ticks, idle de 1 frame frente a 6)', () => {
    const inputs = randomInputs(1200, 7);
    const play = (trees: typeof TREES) => {
      const run = startSeededRun(aDefaultConfig(), 42);
      const out: { snap: RunSnapshot; cells: string }[] = [];
      for (const input of inputs) {
        chooseFirstWhileOpen(run);
        treeLooks(run.map, decor(42), trees);
        run.tick(input);
        out.push({ snap: run.snapshot(), cells: run.map.cells.join() });
      }
      return out;
    };
    const one = { ...TREES, idle: { ...TREES.idle, frames: [0] }, flip: false };
    expect(play(TREES)).toEqual(play(one));
  });
});
