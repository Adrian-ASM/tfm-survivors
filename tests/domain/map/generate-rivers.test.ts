import { describe, expect, it } from 'vitest';
import type { MapConfig } from '../../../src/domain/map/MapRules';
import type { RunConfig } from '../../../src/domain/run/RunConfig';
import { BALANCE_SEEDS } from '../../support/balanceSeeds';
import { aDefaultConfig } from '../../support/builders';
import {
  FOOTPRINT_CELLS,
  blockedInStartZone,
  castleCells,
  countOf,
  mapForSeed,
  rivers,
  typesOf,
} from '../../support/mapStats';

/** Contenido por defecto con el mapa cambiado (p. ej. solo ríos: `trunkDensity` 0). */
function withMap(patch: Partial<MapConfig>): RunConfig {
  const base = aDefaultConfig();
  return { ...base, map: { ...base.map, ...patch } };
}

const RIVERS_ONLY = withMap({ trunkDensity: 0 });

describe('generateMap · ríos (spec procedural-map, "Composición del mapa")', () => {
  it('Scenario: Composición con las semillas del conjunto (parte río: 1 río, 2–3 puentes)', () => {
    for (const seed of BALANCE_SEEDS) {
      const map = mapForSeed(RIVERS_ONLY, seed);
      const found = rivers(map);
      expect(found, `semilla ${String(seed)}`).toHaveLength(1);
      const [river] = found;
      expect(river?.spans, `semilla ${String(seed)}`).not.toBeNull();
      expect(river?.hasBlock2x2, `semilla ${String(seed)}`).toBe(false);
      expect(river?.straightBridges, `semilla ${String(seed)}`).toBe(true);
      expect(river?.bridges ?? 0).toBeGreaterThanOrEqual(2);
      expect(river?.bridges ?? 0).toBeLessThanOrEqual(3);
      expect(blockedInStartZone(map), `semilla ${String(seed)}`).toBe(0);
    }
  });

  it('las dos orientaciones aparecen en el conjunto', () => {
    const spans = new Set(BALANCE_SEEDS.map((s) => rivers(mapForSeed(RIVERS_ONLY, s))[0]?.spans));
    expect([...spans].sort()).toEqual(['h', 'v']);
  });

  it('con 2 ríos: dos ríos de borde a borde, en lados opuestos de la zona de inicio', () => {
    const config = withMap({ trunkDensity: 0, rivers: 2 });
    for (const seed of BALANCE_SEEDS) {
      const map = mapForSeed(config, seed);
      const found = rivers(map);
      expect(found, `semilla ${String(seed)}`).toHaveLength(2);
      const [a, b] = found;
      const axis = a?.spans === 'v' ? (i: number) => i % map.cols : (i: number) => i / map.cols;
      const centre = a?.spans === 'v' ? map.start.x / map.cellSize : map.start.y / map.cellSize;
      const sideOf = (cells: number[]) => cells.every((i) => axis(i) < centre);
      expect(a?.spans).toBe(b?.spans);
      expect(sideOf(a?.cells ?? [])).not.toBe(sideOf(b?.cells ?? []));
      expect(blockedInStartZone(map), `semilla ${String(seed)}`).toBe(0);
    }
  });

  it('Scenario: Sin río ni troncos (semilla 7: 20 castle en 30–34 × 15–18 y 2.284 grass)', () => {
    const map = mapForSeed(withMap({ rivers: 0, trunkDensity: 0 }), 7);
    expect(countOf(map, 'grass')).toBe(2284);
    expect(castleCells(map)).toEqual(FOOTPRINT_CELLS);
  });

  it('Scenario: Misma semilla, mismo mapa (nivel generador, semilla 42)', () => {
    expect(typesOf(mapForSeed(RIVERS_ONLY, 42))).toEqual(typesOf(mapForSeed(RIVERS_ONLY, 42)));
  });
});
