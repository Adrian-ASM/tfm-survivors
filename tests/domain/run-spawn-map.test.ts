import { describe, expect, it } from 'vitest';
import type { CellType } from '../../src/domain/map/CellType';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';
import type { TerrainSource } from '../../src/domain/map/TerrainSource';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aDefaultConfig, aSegment, aWavesConfig } from '../support/builders';
import { cellsWith, mapRules, type Layout } from '../support/mapLayouts';
import { CountingRandom, StubRandom } from '../support/random';

// Spec enemy-spawning, "Posición de aparición fuera de la vista" (recolocación, 0019) y
// enemy-behavior, "Sin movimiento en el tick de aparición" ("Aparición recolocada").
const WORLD = aDefaultConfig().arena;

function start(config: RunConfig, random: RandomGenerator, terrain: TerrainSource): Run {
  const r = Run.start(config, random, {}, terrain);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** Valores de azar consumidos en cada uno de `n` ticks sin input. */
function callsPerTick(run: Run, random: CountingRandom, n: number): number[] {
  const out: number[] = [];
  for (let t = 0; t < n; t++) {
    const before = random.calls;
    run.tick(PlayerInput.NONE);
    out.push(random.calls - before);
  }
  return out;
}

/** Todas las celdas de `rules` de `type`, salvo las de `except` (`'c,r'`). */
function filled(
  cols: number,
  rows: number,
  type: CellType,
  except: (c: number, r: number) => boolean,
) {
  const layout: Record<string, CellType> = {};
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) if (!except(c, r)) layout[`${String(c)},${String(r)}`] = type;
  return layout as Layout;
}

describe('Recolocación de la aparición en la partida (spec enemy-spawning)', () => {
  it('Scenario: Recolocación que queda demasiado cerca (arena 960 × 540, caja de 4 × 3 libre)', () => {
    const config = aWavesConfig({
      segments: [aSegment(['goblin-torch'], 5)],
      spawn: { minDistance: 200, maxAttempts: 8 },
    });
    const rules = mapRules(config.map, 960, 540);
    expect([rules.cols, rules.rows]).toEqual([16, 9]);
    const box = filled(16, 9, 'trunk', (c, r) => c >= 6 && c <= 9 && r >= 3 && r <= 5);
    const random = new CountingRandom(new Mulberry32RandomGenerator(42));
    const cells = cellsWith(rules, box);
    const run = start(config, random, { kind: 'cells', cells, start: { x: 480, y: 270 } });
    const perTick = callsPerTick(run, random, 600);
    expect(run.snapshot().tick).toBe(600);
    expect(run.snapshot().enemies).toHaveLength(0);
    expect(Math.max(...perTick.slice(1))).toBeLessThanOrEqual(8);
    expect(perTick.filter((k) => k === 8).length).toBeGreaterThan(0);
  });

  // 'Mapa sin celdas caminables' se cubre en place-spawn.test.ts: una partida no puede empezar con
  // el jugador sobre celdas no caminables (RunSetup), así que el escenario se prueba en placeSpawn.

  it('Scenario: Aparición recolocada (snapshot del tick de aparición en el centro de la celda)', () => {
    // Azar fijo 0: ángulo 0, punto (3.420, 1.080) desde la salida (1.920, 1.080), esquina de la
    // celda (57, 18), que es tronco: el centro más cercano (empate a 42,43 px) es el de la (56, 17).
    const config = {
      ...aWavesConfig({ segments: [aSegment(['goblin-torch'], 60)] }),
      arena: WORLD,
    };
    const rules = mapRules(config.map, WORLD.width, WORLD.height);
    const cells = cellsWith(rules, { '57,18': 'trunk' });
    const run = start(config, new StubRandom(0), { kind: 'cells', cells });
    run.tick(PlayerInput.NONE);
    const first = run.snapshot().enemies[0];
    expect(first && [first.x, first.y]).toEqual([3390, 1050]);
  });

  it('1 valor por intento en la partida: tronco recolocado frente a hierba (mismo azar)', () => {
    const config = {
      ...aWavesConfig({ segments: [aSegment(['goblin-torch'], 60)] }),
      arena: WORLD,
    };
    const rules = mapRules(config.map, WORLD.width, WORLD.height);
    const trunk = new CountingRandom(new StubRandom(0));
    const grass = new CountingRandom(new StubRandom(0));
    const a = start(config, trunk, {
      kind: 'cells',
      cells: cellsWith(rules, { '57,18': 'trunk' }),
    });
    const b = start(config, grass, { kind: 'open' });
    callsPerTick(a, trunk, 30);
    callsPerTick(b, grass, 30);
    expect(trunk.calls).toBe(grass.calls);
    expect(a.snapshot().enemies.length).toBe(b.snapshot().enemies.length);
  });
});
