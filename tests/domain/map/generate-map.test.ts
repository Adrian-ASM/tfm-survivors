import { describe, expect, it } from 'vitest';
import { isFullyConnected } from '../../../src/domain/map/connectivity';
import type { GameMap } from '../../../src/domain/map/GameMap';
import { BALANCE_SEEDS } from '../../support/balanceSeeds';
import { aDefaultConfig } from '../../support/builders';
import {
  FOOTPRINT_CELLS,
  blockedInStartZone,
  castleCells,
  components,
  countOf,
  inFootprint,
  mapForSeed,
  rivers,
  trunksNextToBridges,
  typesOf,
} from '../../support/mapStats';

const CONFIG = aDefaultConfig();
const SEEDS_1000 = Array.from({ length: 1000 }, (_, i) => i + 1);
const EXTREME_SEEDS = [0, 4294967295];

/** Composición del mapa por defecto (spec procedural-map); devuelve los fallos encontrados. */
function compositionFailures(map: GameMap): string[] {
  const failures: string[] = [];
  const found = rivers(map);
  if (found.length !== 1) failures.push(`ríos: ${String(found.length)}`);
  for (const r of found) {
    if (r.spans === null) failures.push('río que no cruza el mundo');
    if (r.hasBlock2x2) failures.push('río de más de 1 celda de ancho');
    if (r.bridges < 2 || r.bridges > 3) failures.push(`puentes: ${String(r.bridges)}`);
  }
  const trunks = countOf(map, 'trunk');
  if (trunks < 231 || trunks > 322) failures.push(`troncos: ${String(trunks)}`);
  const patches = components(map, (t) => t === 'trunk').map((c) => c.length);
  if (patches.some((n) => n < 3 || n > 8)) failures.push(`manchas: ${patches.join(',')}`);
  const walkable = countOf(map, 'grass') + countOf(map, 'bridge');
  if (walkable < 1613) failures.push(`caminables: ${String(walkable)}`);
  if (trunksNextToBridges(map) > 0) failures.push('tronco junto a un puente');
  if (castleCells(map).join() !== FOOTPRINT_CELLS.join()) failures.push('huella del castillo');
  const wet = typesOf(map).flatMap((t, i) => (t === 'water' || t === 'bridge' ? [i] : []));
  const touches = wet.filter((i) => {
    const c = i % map.cols;
    const r = (i - c) / map.cols;
    return map.rules.inStartZone(c, r) || inFootprint(map, c, r);
  });
  if (touches.length > 0) failures.push('río en la zona de inicio o en la huella');
  return failures;
}

describe('generateMap · composición (spec procedural-map)', () => {
  it('Scenario: Composición con las semillas del conjunto (1..50)', () => {
    const failures = BALANCE_SEEDS.flatMap((seed) =>
      compositionFailures(mapForSeed(CONFIG, seed)).map((f) => `${String(seed)}: ${f}`),
    );
    expect(failures).toEqual([]);
  });

  it('Scenario: Todas las celdas caminables alcanzables (1..50)', () => {
    const disconnected = BALANCE_SEEDS.filter((s) => !isFullyConnected(mapForSeed(CONFIG, s)));
    expect(disconnected).toEqual([]);
  });

  it('Scenario: Semillas extremas (0 y 4.294.967.295)', () => {
    for (const seed of EXTREME_SEEDS) {
      const map = mapForSeed(CONFIG, seed);
      expect(compositionFailures(map), `semilla ${String(seed)}`).toEqual([]);
      expect(blockedInStartZone(map)).toBe(0);
      expect(isFullyConnected(map)).toBe(true);
    }
  });

  it('Scenario: Mapa distinto en cada semilla del conjunto (1..50 distintos dos a dos)', () => {
    const keys = BALANCE_SEEDS.map((s) => typesOf(mapForSeed(CONFIG, s)).join(''));
    expect(new Set(keys).size).toBe(BALANCE_SEEDS.length);
  });

  it('Scenario: Misma semilla, mismo mapa (semilla 42, dos generaciones)', () => {
    expect(typesOf(mapForSeed(CONFIG, 42))).toEqual(typesOf(mapForSeed(CONFIG, 42)));
  });
});

describe('generateMap · semillas 1..1000 (zona y conectividad)', () => {
  const maps = SEEDS_1000.map((seed) => ({ seed, map: mapForSeed(CONFIG, seed) }));

  const extra = EXTREME_SEEDS.map((seed) => ({ seed, map: mapForSeed(CONFIG, seed) }));

  it('Scenario: Zona libre con todas las semillas (1..1.000, 0 y 2³² − 1)', () => {
    const dirty = [...maps, ...extra].filter(
      ({ map }) => blockedInStartZone(map) > 0 || map.overlapsBlocked(1950, 1170, 16),
    );
    expect(dirty.map((m) => m.seed)).toEqual([]);
  });

  it('Scenario: Misma huella con todas las semillas (1..1.000, 0 y 2³² − 1)', () => {
    const wrong = [...maps, ...extra].filter(
      ({ map }) =>
        castleCells(map).join() !== FOOTPRINT_CELLS.join() ||
        map.start.x !== 1950 ||
        map.start.y !== 1170,
    );
    expect(wrong.map((m) => m.seed)).toEqual([]);
  });

  it('Scenario: Todas las celdas caminables alcanzables (1..1.000, 0 y 2³² − 1)', () => {
    const all = [...maps, ...extra];
    expect(all.filter(({ map }) => !isFullyConnected(map)).map((m) => m.seed)).toEqual([]);
  });

  it('composición en 1..1.000 (tolerancia provisional de troncos, punto de control 1)', () => {
    const failures = maps.flatMap(({ seed, map }) =>
      compositionFailures(map).map((f) => `${String(seed)}: ${f}`),
    );
    expect(failures).toEqual([]);
  });
});
