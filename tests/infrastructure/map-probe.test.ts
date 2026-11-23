import { describe, expect, it } from 'vitest';
import { RestartRun } from '../../src/application/RestartRun';
import { StartRun } from '../../src/application/StartRun';
import { decorSeedOf, seededRun } from '../../src/composition/seedSource';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { DECOR_STREAM, deriveSeed } from '../../src/infrastructure/random/deriveSeed';
import { TICK_MS, aDefaultConfig } from '../support/builders';
import { planFor, spritesOf } from '../support/mapArt';
import { mapForSeed, typesOf } from '../support/mapStats';
import { startSeededRun } from '../support/runs';

// Spec procedural-map (0016), "Sonda del mapa para E2E", y sprite-rendering, "Variedad de árboles
// por semilla" y "Sonda de render" (parte sin navegador).
const CONFIG = aDefaultConfig();

describe('Semilla de decoración de la composición', () => {
  it('decorSeedOf(seed) = deriveSeed(seed, DECOR_STREAM)', () => {
    expect(decorSeedOf(42)).toBe(deriveSeed(42, DECOR_STREAM));
    expect(decorSeedOf(42)).not.toBe(decorSeedOf(43));
  });

  it('Scenario: Mismos modelos con la misma semilla (tras 600 frames y R con la misma semilla)', () => {
    const r = new StartRun().execute(
      CONFIG,
      seededRun(42).random,
      undefined,
      seededRun(42).terrain,
    );
    if (!r.ok) throw new Error(r.error.message);
    const first = planFor(r.value.tickRun.map(), 42);
    for (let i = 0; i < 600 && r.value.tickRun.status === 'running'; i++) {
      r.value.tickRun.execute(TICK_MS, PlayerInput.NONE);
    }
    const models = (plan: typeof first) =>
      spritesOf(plan, 'trunk').map((s) => `${String(s.frame)}${s.flipX ? 'f' : ''}`);
    const again = planFor(r.value.tickRun.map(), 42);
    expect(models(again)).toEqual(models(first));
    // Quieto pierde antes de 10.800 ticks (run-outcome); se elige la opción 0 en cada oferta.
    const ended = r.value.tickRun;
    for (let i = 0; i < 20_000 && ended.status !== 'over'; i++) {
      if (ended.status === 'choosing') r.value.chooseUpgrade.execute(0);
      else ended.execute(TICK_MS, PlayerInput.NONE);
    }
    expect(ended.status).toBe('over');
    const next = new RestartRun(CONFIG, () => seededRun(42)).execute(ended);
    if (!next.ok) throw new Error('reinicio rechazado');
    expect(models(planFor(next.value.tickRun.map(), 42))).toEqual(models(first));
  });
});

describe('Sonda del mapa (snapshot del núcleo)', () => {
  it('Scenario: Sonda coherente con el núcleo (semilla 42: tipos, recuentos y zona (990, 630))', () => {
    const map = startSeededRun(CONFIG, 42).map;
    expect([map.cols, map.rows, map.cellSize]).toEqual([32, 18, 60]);
    expect(map.cells).toEqual(typesOf(mapForSeed(CONFIG, 42)));
    const sum = Object.values(map.counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(576);
    for (const [type, n] of Object.entries(map.counts)) {
      expect(map.cells.filter((t) => t === type)).toHaveLength(n);
    }
    expect(map.start).toEqual({ x: 990, y: 630, radius: 180 });
    expect(map.castle).toEqual({ firstCol: 14, lastCol: 18, firstRow: 6, lastRow: 9 });
  });

  it('Scenario: Sonda con el mapa vacío (576 grass, 0 castle, huella null, salida (960, 540))', () => {
    const map = startSeededRun(CONFIG, 42, 'empty').map;
    expect([map.counts.grass, map.counts.castle, map.castle]).toEqual([576, 0, null]);
    expect(map.start).toEqual({ x: 960, y: 540, radius: 180 });
  });
});
