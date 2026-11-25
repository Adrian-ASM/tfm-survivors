import { describe, expect, it } from 'vitest';
import { RestartRun } from '../../src/application/RestartRun';
import { StartRun } from '../../src/application/StartRun';
import { decorSeedOf, seededRun } from '../../src/composition/seedSource';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { MapArtPlan } from '../../src/infrastructure/phaser/map/planMapArt';
import { DECOR_STREAM, deriveSeed } from '../../src/infrastructure/random/deriveSeed';
import { TICK_MS, aDefaultConfig } from '../support/builders';
import { planFor, spritesOf } from '../support/mapArt';
import { mapForSeed, typesOf } from '../support/mapStats';
import { startSeededRun } from '../support/runs';
import {
  RESOURCE_GOLDEN,
  STRUCTURE_GOLDEN,
  resourceSignatureOf,
  structureSignatureOf,
} from '../support/mapGolden';

// Spec procedural-map (0016), "Sonda del mapa para E2E", y sprite-rendering, "Variedad de árboles
// por semilla" y "Sonda de render" (parte sin navegador).
const CONFIG = aDefaultConfig();

describe('Semilla de decoración de la composición', () => {
  it('decorSeedOf(seed) = deriveSeed(seed, DECOR_STREAM)', () => {
    expect(decorSeedOf(42)).toBe(deriveSeed(42, DECOR_STREAM));
    expect(decorSeedOf(42)).not.toBe(decorSeedOf(43));
  });

  /** Planes de la semilla 42: al empezar, otra vez, tras 600 ticks y tras R con la misma semilla. */
  const restartedPlans = (() => {
    let cached: MapArtPlan[] | null = null;
    return (): MapArtPlan[] => {
      if (cached) return cached;
      const r = new StartRun().execute(
        CONFIG,
        seededRun(42).random,
        undefined,
        seededRun(42).terrain,
      );
      if (!r.ok) throw new Error(r.error.message);
      const first = planFor(r.value.tickRun.map(), 42);
      const twice = planFor(r.value.tickRun.map(), 42);
      for (let i = 0; i < 600 && r.value.tickRun.status === 'running'; i++) {
        r.value.tickRun.execute(TICK_MS, PlayerInput.NONE);
      }
      const again = planFor(r.value.tickRun.map(), 42);
      // Quieto pierde antes de 10.800 ticks (run-outcome); se elige la opción 0 en cada oferta.
      const ended = r.value.tickRun;
      for (let i = 0; i < 20_000 && ended.status !== 'over'; i++) {
        if (ended.status === 'choosing') r.value.chooseUpgrade.execute(0);
        else ended.execute(TICK_MS, PlayerInput.NONE);
      }
      expect(ended.status).toBe('over');
      const next = new RestartRun(CONFIG, () => seededRun(42)).execute(ended);
      if (!next.ok) throw new Error('reinicio rechazado');
      cached = [first, twice, again, planFor(next.value.tickRun.map(), 42)];
      return cached;
    };
  })();

  it('Scenario: Mismas fases con la misma semilla (tras 600 frames y R con la misma semilla)', () => {
    const models = (plan: MapArtPlan) =>
      spritesOf(plan, 'trunk').map((s) => `${String(s.frame)}${s.flipX ? 'f' : ''}`);
    const [first, ...rest] = restartedPlans().map(models);
    expect(first?.length).toBeGreaterThan(0);
    for (const other of rest) expect(other).toEqual(first);
  });

  it('Scenario: Misma semilla, misma decoración (dos cálculos y tras 600 frames y R)', () => {
    const decor = (plan: MapArtPlan) =>
      plan.decor.map(
        (d) => `${String(d.col)},${String(d.row)}:${d.file}@${String(d.x)},${String(d.y)}`,
      );
    const [first, ...rest] = restartedPlans().map(decor);
    expect(first?.length).toBeGreaterThan(0);
    for (const other of rest) expect(other).toEqual(first);
  });

  it('Scenario: Fases deterministas (árboles y torres en [0, 3], iguales tras 600 frames y R)', () => {
    const phases = (plan: MapArtPlan) =>
      plan.animations.map(
        (a) => `${String(a.frames.length)}:${String(a.phase)}:${a.indices.join()}`,
      );
    const plans = restartedPlans();
    const [first, ...rest] = plans.map(phases);
    for (const other of rest) expect(other).toEqual(first);
    const groups = plans[0]?.animations ?? [];
    const trees = groups.filter((a) => a.fps === 4);
    const towers = groups.filter((a) => a.fps === 5);
    expect(trees.length).toBeGreaterThan(0);
    expect(towers.length).toBeGreaterThan(0);
    expect(trees.every((a) => a.phase >= 0 && a.phase <= 3)).toBe(true);
    expect(towers.every((a) => a.phase >= 0 && a.phase <= 3)).toBe(true);
  });
});

describe('Sonda del mapa (snapshot del núcleo)', () => {
  it('Scenario: Sonda coherente con el núcleo (semilla 42: tipos, recuentos y zona (1.950, 1.170))', () => {
    const map = startSeededRun(CONFIG, 42).map;
    expect([map.cols, map.rows, map.cellSize]).toEqual([64, 36, 60]);
    expect(map.cells).toEqual(typesOf(mapForSeed(CONFIG, 42)));
    const sum = Object.values(map.counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(2304);
    for (const [type, n] of Object.entries(map.counts)) {
      expect(map.cells.filter((t) => t === type)).toHaveLength(n);
    }
    expect(map.start).toEqual({ x: 1950, y: 1170, radius: 180 });
    expect(map.castle).toEqual({ firstCol: 30, lastCol: 34, firstRow: 15, lastRow: 18 });
    // 0021: la lista de estructuras es la que coloca el núcleo, una a una (firma dorada).
    expect(structureSignatureOf(map.structures)).toEqual(STRUCTURE_GOLDEN[42]);
    expect(map.structures.map((s) => s.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    // 0022: vetas y montones, uno a uno, los que coloca el núcleo (firma de recursos).
    expect(resourceSignatureOf(map)).toEqual(RESOURCE_GOLDEN[42]);
    expect(map.veins.map((v) => v.id)).toEqual([0, 1, 2]);
  });

  it('Scenario: Sonda con el mapa vacío (2.304 grass, 0 castle, huella null, salida (1.920, 1.080))', () => {
    const map = startSeededRun(CONFIG, 42, 'empty').map;
    expect([map.counts.grass, map.counts.castle, map.castle]).toEqual([2304, 0, null]);
    expect(map.structures).toEqual([]);
    expect([map.veins, map.woodPiles]).toEqual([[], []]);
    expect(map.start).toEqual({ x: 1920, y: 1080, radius: 180 });
  });
});
