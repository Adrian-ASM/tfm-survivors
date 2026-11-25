import { siteRandomFor } from '../support/sites';
import { resourceRandomFor, sheepRandomFor } from '../support/camps';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { restartRandoms, seededRun } from '../../src/composition/seedSource';
import {
  DECOR_STREAM,
  MAP_STREAM,
  RESOURCE_STREAM,
  SHEEP_STREAM,
  SITE_STREAM,
  STONE_STREAM,
  STRUCT_STREAM,
  deriveSeed,
} from '../../src/infrastructure/random/deriveSeed';
import { RestartRun } from '../../src/application/RestartRun';
import { StartRun, type StartedRun } from '../../src/application/StartRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import {
  TICK_MS,
  aDefaultConfig,
  aSegment,
  aWavesConfig,
  withStoneChance,
} from '../support/builders';
import type { CellType } from '../../src/domain/map/CellType';
import { Run } from '../../src/domain/run/Run';
import { cellsWith, mapRules } from '../support/mapLayouts';
import { CountingRandom } from '../support/random';
import { mapForSeed, typesOf } from '../support/mapStats';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';

const sequence = (r: { next(): number }, n: number): number[] =>
  Array.from({ length: n }, () => r.next());

describe('restartRandoms (spec simulation-loop: Semilla de la partida)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Scenario: Semilla nueva al reiniciar (la fuente da 123: generador con 123 y aviso al probe)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const seeds: number[] = [];
    const next = restartRandoms(
      () => 123,
      (s) => seeds.push(s),
    );

    const { random } = next();

    expect(sequence(random, 5)).toEqual(sequence(new Mulberry32RandomGenerator(123), 5));
    expect(seeds).toEqual([123]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('Scenario: Reinicio tras una semilla inválida (3 reinicios: semillas nuevas, sin avisos)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const draws = [7, 4_294_967_295, 0];
    const seeds: number[] = [];
    const next = restartRandoms(
      () => draws[seeds.length] ?? -1,
      (s) => seeds.push(s),
    );

    for (let i = 0; i < 3; i++) next();

    expect(seeds).toEqual(draws);
    expect(seeds.every((s) => Number.isInteger(s) && s >= 0 && s <= 4_294_967_295)).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });
});

// ADR-0013: la composición siembra la partida (oleadas) y el mapa (flujo derivado) por separado.
describe('seededRun', () => {
  it('oleadas con Mulberry32(seed) y mapa con Mulberry32(deriveSeed(seed, MAP_STREAM))', () => {
    const seeding = seededRun(42, 'generated');
    expect(sequence(seeding.random, 5)).toEqual(sequence(new Mulberry32RandomGenerator(42), 5));
    if (seeding.terrain.kind !== 'generated') throw new Error('se esperaba un mapa generado');
    const mapRandom = new Mulberry32RandomGenerator(deriveSeed(42, MAP_STREAM));
    expect(sequence(seeding.terrain.random, 5)).toEqual(sequence(mapRandom, 5));
  });

  // ADR-0020 (0021): las casas y torres con su propio flujo, STRUCT_STREAM = 3.
  it('estructuras con Mulberry32(deriveSeed(seed, STRUCT_STREAM)), STRUCT_STREAM = 3', () => {
    expect(STRUCT_STREAM).toBe(3);
    const seeding = seededRun(42, 'generated');
    if (seeding.terrain.kind !== 'generated') throw new Error('se esperaba un mapa generado');
    const structureRandom = new Mulberry32RandomGenerator(deriveSeed(42, STRUCT_STREAM));
    expect(sequence(seeding.terrain.structureRandom, 5)).toEqual(sequence(structureRandom, 5));
  });

  // ADR-0021 (0022): vetas y montones con su propio flujo, RESOURCE_STREAM = 4, distinto de los demás.
  it('recursos con Mulberry32(deriveSeed(seed, RESOURCE_STREAM)), RESOURCE_STREAM = 4', () => {
    expect(RESOURCE_STREAM).toBe(4);
    expect(new Set([MAP_STREAM, DECOR_STREAM, STRUCT_STREAM, RESOURCE_STREAM]).size).toBe(4);
    const seeding = seededRun(42, 'generated');
    if (seeding.terrain.kind !== 'generated') throw new Error('se esperaba un mapa generado');
    const resourceRandom = new Mulberry32RandomGenerator(deriveSeed(42, RESOURCE_STREAM));
    expect(sequence(seeding.terrain.resourceRandom, 5)).toEqual(sequence(resourceRandom, 5));
  });

  // 0026: los solares con su propio flujo, SITE_STREAM = 7, distinto de los demás; solo generado.
  it('solares con Mulberry32(deriveSeed(seed, SITE_STREAM)), SITE_STREAM = 7', () => {
    expect(SITE_STREAM).toBe(7);
    const streams = [MAP_STREAM, DECOR_STREAM, STRUCT_STREAM, RESOURCE_STREAM, SHEEP_STREAM];
    expect(new Set([...streams, STONE_STREAM, SITE_STREAM]).size).toBe(7);
    const seeding = seededRun(42, 'generated');
    if (seeding.terrain.kind !== 'generated') throw new Error('se esperaba un mapa generado');
    const siteRandom = new Mulberry32RandomGenerator(deriveSeed(42, SITE_STREAM));
    expect(sequence(seeding.terrain.siteRandom, 5)).toEqual(sequence(siteRandom, 5));
  });

  it('con el modo vacío el mapa es el abierto', () => {
    expect(seededRun(42, 'empty').terrain).toEqual({ kind: 'open' });
  });
});

// ADR-0024 (0025): el azar de la piedra, STONE_STREAM = 6, en todo mapa e independiente de los demás.
describe('Azar de la piedra (simulation-loop 0025)', () => {
  it('piedra con Mulberry32(deriveSeed(seed, STONE_STREAM)), STONE_STREAM = 6, distinto de los demás', () => {
    expect(STONE_STREAM).toBe(6);
    const streams = [MAP_STREAM, DECOR_STREAM, STRUCT_STREAM, RESOURCE_STREAM, SHEEP_STREAM];
    expect(new Set([...streams, STONE_STREAM]).size).toBe(6);
    const stoneRandom = new Mulberry32RandomGenerator(deriveSeed(42, STONE_STREAM));
    expect(sequence(seededRun(42).stoneRandom, 5)).toEqual(sequence(stoneRandom, 5));
  });

  it('Scenario: Mismo azar de la piedra en cualquier mapa (generado, vacío y de celdas: 100 valores)', () => {
    const config = aDefaultConfig();
    const cells: CellType[] = cellsWith(mapRules(), { '10,4': 'trunk' });
    const seedings = [
      seededRun(42, 'generated'),
      seededRun(42, 'empty'),
      { ...seededRun(42, 'empty'), terrain: { kind: 'cells' as const, cells } },
    ];
    for (const { random, terrain, stoneRandom } of seedings) {
      expect(Run.start(config, random, undefined, terrain, stoneRandom).ok).toBe(true);
    }
    const [generated, empty, declared] = seedings.map((s) => sequence(s.stoneRandom, 100));

    expect(empty).toEqual(generated);
    expect(declared).toEqual(generated);
  });

  it('Scenario: Semillas distintas, azares distintos (1 y 2: 100 valores)', () => {
    const one = sequence(seededRun(1).stoneRandom, 100);
    const two = sequence(seededRun(2).stoneRandom, 100);

    expect(one.some((v, i) => v !== two[i])).toBe(true);
  });

  it('Scenario: Independiente de los demás flujos (semilla 42, mapa generado y vacío)', () => {
    const P = { x: 1950, y: 1250 };
    const base = withStoneChance(aDefaultConfig(), { 'goblin-torch': 100 });
    const config = {
      ...base,
      waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves,
    };
    const after = (mode: 'generated' | 'empty') => {
      const { random, terrain, stoneRandom } = seededRun(42, mode);
      const stones = new CountingRandom(stoneRandom);
      const r = Run.start(
        config,
        random,
        { player: P, enemies: [{ type: 'goblin-torch', x: P.x + 60, y: P.y, health: 4 }] },
        terrain,
        stones,
      );
      if (!r.ok) throw new Error(r.error.message);
      let kills = 0;
      for (let i = 0; i < 300 && kills === 0; i++) {
        r.value.tick(PlayerInput.NONE);
        kills = r.value.snapshot().kills;
      }
      return { kills, calls: stones.calls, next: stones.next() };
    };
    const generated = after('generated');

    expect(generated).toMatchObject({ kills: 1, calls: 1 });
    expect(after('empty')).toEqual(generated);
  });
});

// Spec procedural-map, "Reinicio con otra semilla" (unitario): tras R, el mapa de la semilla nueva.
describe('restartRandoms con el mapa', () => {
  it('Scenario: Reinicio con otra semilla (42 terminada, R con 123: mapa de la 123)', () => {
    const config = aDefaultConfig();
    const first = new StartRun().execute(config, new Mulberry32RandomGenerator(42), undefined, {
      kind: 'generated',
      random: new Mulberry32RandomGenerator(deriveSeed(42, MAP_STREAM)),
      structureRandom: new Mulberry32RandomGenerator(deriveSeed(42, STRUCT_STREAM)),
      resourceRandom: resourceRandomFor(42),
      sheepRandom: sheepRandomFor(42),
      siteRandom: siteRandomFor(42),
    });
    if (!first.ok) throw new Error(first.error.message);
    play(first.value, 36_000);
    expect(first.value.tickRun.status).toBe('over');
    const restart = new RestartRun(
      config,
      restartRandoms(
        () => 123,
        () => undefined,
      ),
    );

    const next = restart.execute(first.value.tickRun);

    if (!next.ok) throw new Error('reinicio rechazado');
    expect(next.value.tickRun.map().cells).toEqual(typesOf(mapForSeed(config, 123)));
  });

  it('con el modo vacío los reinicios usan el mapa vacío', () => {
    const seeding = restartRandoms(
      () => 5,
      () => undefined,
      'empty',
    )();
    expect(seeding.terrain).toEqual({ kind: 'open' });
  });
});

/** Política fija con frames de 1 tick hasta terminar. */
function play(s: StartedRun, n: number): void {
  for (let i = 0; i < n && s.tickRun.status !== 'over'; i++) {
    while (s.tickRun.status === 'choosing') s.chooseUpgrade.execute(0);
    s.tickRun.execute(TICK_MS, PlayerInput.NONE);
  }
}
