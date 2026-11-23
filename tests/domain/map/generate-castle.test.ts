import { describe, expect, it } from 'vitest';
import { reachableCells } from '../../../src/domain/map/connectivity';
import { PlayerInput } from '../../../src/domain/player/PlayerInput';
import type { RunConfig } from '../../../src/domain/run/RunConfig';
import { BALANCE_SEEDS } from '../../support/balanceSeeds';
import { aDefaultConfig } from '../../support/builders';
import {
  FOOTPRINT_CELLS,
  blockCells,
  castleCells,
  countOf,
  mapForSeed,
  typesOf,
} from '../../support/mapStats';
import { startSeededRun, ticks } from '../../support/runs';

// Spec procedural-map (0016), "Castillo en el mapa generado"; player-movement, "Posición inicial en
// el punto de salida del mapa" y "Colisión con el mapa".
const CONFIG = aDefaultConfig();

function withMap(patch: Partial<RunConfig['map']>, arena = CONFIG.arena): RunConfig {
  return { ...CONFIG, arena, map: { ...CONFIG.map, ...patch } };
}

describe('generateMap · castillo (spec procedural-map 0016)', () => {
  it('Scenario: Huella y salida por defecto (semilla 42: 14–18 × 6–9, salida (990, 630))', () => {
    const map = mapForSeed(CONFIG, 42);
    expect(castleCells(map)).toEqual(FOOTPRINT_CELLS);
    expect(map.castle).toEqual({ firstCol: 14, lastCol: 18, firstRow: 6, lastRow: 9 });
    expect([map.start.x, map.start.y]).toEqual([990, 630]);
  });

  it('Scenario: Huella en un mundo mayor (4.000 × 4.000, semilla 7: 31–35 × 30–33)', () => {
    const map = mapForSeed(withMap({}, { ...CONFIG.arena, width: 4000, height: 4000 }), 7);
    expect(castleCells(map)).toEqual(blockCells(31, 35, 30, 33));
    expect([map.start.x, map.start.y]).toEqual([2010, 2070]);
  });

  it('Scenario: Celdas tras el castillo alcanzables (solo castillo: 556 grass desde (990, 630))', () => {
    const map = mapForSeed(withMap({ rivers: 0, trunkDensity: 0 }), 7);
    const seen = reachableCells(map);
    const grass = typesOf(map).flatMap((t, i) => (t === 'grass' ? [i] : []));
    expect(grass).toHaveLength(556);
    expect(grass.every((i) => seen[i] === 1)).toBe(true);
    expect(seen[5 * 32 + 16]).toBe(1);
    expect(countOf(map, 'castle')).toBe(20);
  });
});

describe('Salida ante la puerta del castillo (spec player-movement 0016)', () => {
  it('Scenario: Partida nueva con el mapa generado (1..50: jugador en (990, 630))', () => {
    const elsewhere = BALANCE_SEEDS.filter((seed) => {
      const { x, y } = startSeededRun(CONFIG, seed).snapshot().player;
      return x !== 990 || y !== 630;
    });
    expect(elsewhere).toEqual([]);
  });

  it('Scenario: Choque con la fachada del castillo (semilla 42: 60 ticks hacia arriba)', () => {
    const map = mapForSeed(CONFIG, 42);
    const path = ticks(startSeededRun(CONFIG, 42), 60, PlayerInput.of(0, -1));
    const end = path[path.length - 1]?.player;
    expect(end?.x).toBe(990);
    expect(Math.abs((end?.y ?? 0) - 616)).toBeLessThan(0.001);
    expect(path.some((s) => map.overlapsBlocked(s.player.x, s.player.y, 16))).toBe(false);
  });
});
