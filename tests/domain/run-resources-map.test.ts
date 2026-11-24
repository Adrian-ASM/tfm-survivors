import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { MAP_RESOURCE_OUT_OF_WORLD } from '../../src/domain/resource/resolveResources';
import type { TerrainSource } from '../../src/domain/map/TerrainSource';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { seededRun } from '../../src/composition/seedSource';
import {
  CONTENT_RESOURCES,
  aDefaultConfig,
  aSegment,
  aWavesConfig,
  withPlayer,
  withResources,
} from '../support/builders';
import { STRUCTURE_GOLDEN, signatureOf, structureSignatureOf } from '../support/mapGolden';
import { CountingRandom } from '../support/random';
import { startOn } from '../support/camps';
import { startSeededRun, ticks } from '../support/runs';

// Recursos del mapa en la partida (procedural-map, resources, simulation-loop): montones como `wood`
// en el tick 0, vetas en el snapshot y en la vista del mapa, mapa vacío y mapas explícitos.

const CONFIG = aDefaultConfig();
const withCounts = (veins: number, piles: number): RunConfig =>
  withResources(CONFIG, {
    ...CONTENT_RESOURCES,
    goldVeins: { ...CONTENT_RESOURCES.goldVeins, count: veins },
    woodPiles: { ...CONTENT_RESOURCES.woodPiles, count: piles },
  });

describe('Montones y vetas del mapa generado en la partida', () => {
  it('Scenario: Montones en el tick 0 (N wood con su valor, en las posiciones y en su orden)', () => {
    const run = startSeededRun(CONFIG, 42);
    const { count, wood } = CONFIG.resources.woodPiles;
    const s = run.snapshot();
    expect(s.pickups).toHaveLength(count);
    expect(s.pickups.every((p) => p.kind === 'wood' && p.value === wood)).toBe(true);
    expect(s.pickups.map((p) => p.id)).toEqual(Array.from({ length: count }, (_, i) => i));
    expect(s.pickups.map((p) => ({ x: p.x, y: p.y }))).toEqual(run.map.woodPiles);
  });

  it('Scenario: Partida recién creada (semilla 42: oro y madera 0)', () => {
    expect(startSeededRun(CONFIG, 42).snapshot().resources).toEqual({ gold: 0, wood: 0 });
  });

  it('Scenario: Partida recién creada (mapa generado: estructuras, vetas activas y montones)', () => {
    const run = startSeededRun(CONFIG, 42);
    const s = run.snapshot();
    expect(structureSignatureOf(s.structures)).toEqual(STRUCTURE_GOLDEN[42]);
    expect(s.structures.some((x) => x.destroyed)).toBe(false);
    const { count, gold, radius } = CONFIG.resources.goldVeins;
    expect(s.veins).toHaveLength(count);
    expect(s.veins.every((v) => !v.depleted && v.gold === gold && v.radius === radius)).toBe(true);
    expect(s.veins.map((v) => ({ x: v.x, y: v.y }))).toEqual(
      run.map.veins.map((v) => ({ x: v.x, y: v.y })),
    );
    expect(s.pickups.every((p) => p.kind === 'wood')).toBe(true);
  });

  it('la vista del mapa da id, posición y celda de cada veta, y la posición de cada montón', () => {
    const map = startSeededRun(CONFIG, 42).map;
    expect(map.veins.map((v) => v.id)).toEqual([0, 1, 2]);
    for (const v of map.veins) {
      expect([v.col, v.row]).toEqual([Math.floor(v.x / 60), Math.floor(v.y / 60)]);
      expect(v.radius).toBe(CONFIG.resources.goldVeins.radius);
    }
    expect(map.woodPiles).toHaveLength(CONFIG.resources.woodPiles.count);
    expect(Object.isFrozen(map.veins) && Object.isFrozen(map.woodPiles)).toBe(true);
  });

  it('los montones van antes que cualquier recogible de RunSetup', () => {
    const run = startSeededRun(CONFIG, 42, 'generated', { gems: [{ x: 100, y: 100, value: 1 }] });
    const s = run.snapshot();
    const n = CONFIG.resources.woodPiles.count;
    expect(s.pickups.map((p) => p.kind)).toEqual([...Array<string>(n).fill('wood'), 'xp']);
    expect(s.gems).toEqual([{ id: n, kind: 'xp', value: 1, x: 100, y: 100, radius: 5 }]);
  });

  it('Scenario: Sin recursos (0 vetas y 0 montones: listas vacías en el tick 0)', () => {
    const s = startSeededRun(withCounts(0, 0), 42).snapshot();
    expect([s.veins, s.pickups]).toEqual([[], []]);
  });

  it('Scenario: Celdas intactas con recursos (celdas grass e igual al mapa sin recursos)', () => {
    const run = startSeededRun(CONFIG, 42);
    const bare = startSeededRun(withCounts(0, 0), 42);
    const { cols } = run.map;
    for (const p of [...run.map.veins, ...run.map.woodPiles]) {
      const i = Math.floor(p.y / 60) * cols + Math.floor(p.x / 60);
      expect(run.map.cells[i]).toBe('grass');
    }
    expect(signatureOf(run.map.cells)).toBe(signatureOf(bare.map.cells));
  });

  it('Scenario: Los recursos no cambian celdas ni estructuras (1..50, doble de vetas y 0 montones)', () => {
    const other = withCounts(CONFIG.resources.goldVeins.count * 2, 0);
    for (let seed = 1; seed <= 50; seed++) {
      const a = startSeededRun(CONFIG, seed).map;
      const b = startSeededRun(other, seed).map;
      expect(signatureOf(a.cells)).toBe(signatureOf(b.cells));
      expect(structureSignatureOf(a.structures)).toEqual(structureSignatureOf(b.structures));
    }
  });

  it('Scenario: Colocar recursos no consume el azar de la partida (semilla 7)', () => {
    const started = (config: RunConfig) => {
      const { terrain } = seededRun(7);
      const random = new CountingRandom(new Mulberry32RandomGenerator(7));
      const r = Run.start(config, random, {}, terrain);
      if (!r.ok) throw new Error(r.error.message);
      return random;
    };
    const a = started(CONFIG);
    const b = started(withCounts(0, 0));
    expect(a.calls).toBe(b.calls);
    expect(a.next()).toBe(b.next());
  });
});

const quiet = (config: RunConfig = CONFIG): RunConfig => ({
  ...config,
  waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves,
});

describe('Mapa explícito y mapa vacío (procedural-map, resources)', () => {
  it('Scenario: Partida con mapa vacío (semilla 7: hierba, salida centrada, sin vetas ni recogibles)', () => {
    const run = startSeededRun(CONFIG, 7, 'empty');
    const s = run.snapshot();
    expect(run.map.counts.grass).toBe(2304);
    expect(run.map.counts.castle).toBe(0);
    expect(run.map.start).toMatchObject({ x: 1920, y: 1080 });
    expect([s.structures, s.veins, s.pickups, run.map.veins, run.map.woodPiles]).toEqual([
      [],
      [],
      [],
      [],
      [],
    ]);
  });

  it('Scenario: Mapa vacío sin montones (semilla 42: recogibles vacíos y madera 0)', () => {
    const s = startSeededRun(CONFIG, 42, 'empty').snapshot();
    expect(s.pickups).toEqual([]);
    expect(s.resources.wood).toBe(0);
  });

  it('Scenario: Mapa explícito con vetas y montones declarados (1 veta y 2 montones en orden)', () => {
    const terrain: TerrainSource = {
      kind: 'open',
      resources: {
        veins: [{ x: 1000, y: 1000 }],
        woodPiles: [
          { x: 600, y: 600 },
          { x: 700, y: 600 },
        ],
      },
    };
    const s = startOn(CONFIG, terrain).snapshot();
    const { gold } = CONFIG.resources.goldVeins;
    expect(s.veins).toMatchObject([{ x: 1000, y: 1000, gold, depleted: false }]);
    const wood = CONFIG.resources.woodPiles.wood;
    expect(s.pickups).toMatchObject([
      { kind: 'wood', x: 600, y: 600, value: wood },
      { kind: 'wood', x: 700, y: 600, value: wood },
    ]);
  });

  it.each([
    ['veta', { veins: [{ x: 4000, y: 1000 }] }, 'map.resources.veins.0'],
    ['montón', { woodPiles: [{ x: 100, y: -5 }] }, 'map.resources.woodPiles.0'],
  ])('Scenario: Recurso declarado fuera del mundo (%s)', (_name, resources, field) => {
    const r = Run.start(CONFIG, new Mulberry32RandomGenerator(42), {}, { kind: 'open', resources });
    expect(r.ok ? null : r.error).toEqual({
      code: 'invalid-config',
      field,
      message: `${MAP_RESOURCE_OUT_OF_WORLD} (${field})`,
    });
  });

  it('Scenario: Montón recogido al pasar (valor 4: madera 4 desde que desaparece)', () => {
    const base = withPlayer(quiet(), { speed: 215, pickupRadius: 128 });
    const config = withResources(base, {
      ...base.resources,
      woodPiles: { ...base.resources.woodPiles, wood: 4 },
    });
    const run = startOn(
      config,
      { kind: 'open', resources: { woodPiles: [{ x: 900, y: 540 }] } },
      { player: { x: 700, y: 540 } },
    );
    const snaps = ticks(run, 120, PlayerInput.of(1, 0));
    const k = snaps.findIndex((s) => s.pickups.length === 0);
    expect(k).toBeGreaterThan(0);
    expect(snaps[k - 1]?.resources.wood).toBe(0);
    expect(snaps.slice(k).every((s) => s.resources.wood === 4)).toBe(true);
  });
});
