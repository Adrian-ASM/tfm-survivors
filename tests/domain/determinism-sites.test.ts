import { describe, expect, it } from 'vitest';
import { seededRun } from '../../src/composition/seedSource';
import type { TerrainSource } from '../../src/domain/map/TerrainSource';
import { Run } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { BALANCE_SEEDS } from '../support/balanceSeeds';
import { CONTENT_BUILDINGS, aDefaultConfig, withBuildings } from '../support/builders';
import { randomInputs } from '../support/inputs';
import {
  MAP_GOLDEN,
  RESOURCE_GOLDEN,
  SHEEP_GOLDEN,
  STRUCTURE_GOLDEN,
  resourceSignatureOf,
  sheepSignatureOf,
  signatureOf,
  structureSignatureOf,
} from '../support/mapGolden';
import { CountingRandom } from '../support/random';
import { advance, startSeededRun } from '../support/runs';
import { SITE_GOLDEN } from '../support/siteGolden';
import { siteSignatureOf } from '../support/sites';
import { STONE_GOLDEN, stoneSignatureForSeed } from '../support/stoneGolden';

// Spec procedural-map 0026, "Colocación de solares determinista con azar propio" (`SITE_STREAM` 7).
const CONTENT = aDefaultConfig();
const withCount = (count: number): RunConfig =>
  withBuildings(CONTENT, { ...CONTENT_BUILDINGS, sites: { ...CONTENT_BUILDINGS.sites, count } });

/** Lista de solares del tick 0 con accesos y huellas (lo que comparan los escenarios). */
const sitesOf = (run: Run) =>
  run.map.sites.map((s) => [s.id, s.col, s.row, s.cols, s.rows, s.access.x, s.access.y]);

describe('Solares deterministas con azar propio (spec procedural-map 0026)', () => {
  it('Scenario: Misma semilla, mismos solares', () => {
    const a = startSeededRun(CONTENT, 42);
    const b = startSeededRun(CONTENT, 42);
    const before = sitesOf(a);
    for (const input of randomInputs(3600, 9)) {
      advance(a, 1, input);
      if (a.status === 'over') break;
    }
    expect(sitesOf(a)).toEqual(before);
    expect(sitesOf(b)).toEqual(before);
  });

  it('Scenario: Semillas distintas, solares distintos', () => {
    const lists = BALANCE_SEEDS.map((seed) =>
      JSON.stringify(startSeededRun(CONTENT, seed).map.sites.map((s) => s.access)),
    );
    expect(new Set(lists).size).toBe(BALANCE_SEEDS.length);
  });

  it('Scenario: Los solares no cambian nada más', () => {
    for (const seed of BALANCE_SEEDS) {
      const a = startSeededRun(CONTENT, seed);
      const b = startSeededRun(withCount(0), seed);
      expect(a.map.cells).toEqual(b.map.cells);
      expect(structureSignatureOf(a.map.structures)).toEqual(
        structureSignatureOf(b.map.structures),
      );
      expect(resourceSignatureOf(a.map)).toEqual(resourceSignatureOf(b.map));
      expect(sheepSignatureOf(a.snapshot())).toEqual(sheepSignatureOf(b.snapshot()));
    }
    for (const seed of [42, 123] as const) {
      const run = startSeededRun(CONTENT, seed);
      expect(signatureOf(run.map.cells)).toBe(MAP_GOLDEN[seed]);
      expect(structureSignatureOf(run.map.structures)).toEqual(STRUCTURE_GOLDEN[seed]);
      expect(resourceSignatureOf(run.map)).toEqual(RESOURCE_GOLDEN[seed]);
      expect(sheepSignatureOf(run.snapshot())).toEqual(SHEEP_GOLDEN[seed]);
      expect(stoneSignatureForSeed(seed)).toEqual(STONE_GOLDEN[seed]);
    }
  });

  it.each([42, 123] as const)('Scenario: Firma de referencia de los solares (%i)', (seed) => {
    expect(siteSignatureOf(startSeededRun(CONTENT, seed).map)).toEqual(SITE_GOLDEN[seed]);
  });

  it('Scenario: Colocar solares no consume el azar de la partida (semilla 7)', () => {
    const counted = (config: RunConfig) => {
      const seeding = seededRun(7);
      if (seeding.terrain.kind !== 'generated') throw new Error('mapa generado');
      const random = new CountingRandom(seeding.random);
      const stones = new CountingRandom(seeding.stoneRandom);
      const sheep = new CountingRandom(seeding.terrain.sheepRandom);
      const sites = new CountingRandom(seeding.terrain.siteRandom);
      const terrain: TerrainSource = { ...seeding.terrain, sheepRandom: sheep, siteRandom: sites };
      const r = Run.start(config, random, {}, terrain, stones);
      if (!r.ok) throw new Error(r.error.message);
      return [random.calls, sheep.calls, stones.calls, sites.calls];
    };
    const [withSites, without] = [counted(CONTENT), counted(withCount(0))];
    expect(withSites.slice(0, 3)).toEqual(without.slice(0, 3));
    // 1 valor del flujo de los solares por solar colocado.
    expect([withSites[3], without[3]]).toEqual([6, 0]);
  });
});
