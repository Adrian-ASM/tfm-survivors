import { describe, expect, it } from 'vitest';
import { reachableCells } from '../../../src/domain/map/connectivity';
import { checkCastle } from '../../../src/domain/map/generateMap';
import { castleBlock, mapRules, mapWith, type Layout } from '../../support/mapLayouts';
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
  it('Scenario: Huella y salida por defecto (semilla 42: 30–34 × 15–18, salida (1.950, 1.170))', () => {
    const map = mapForSeed(CONFIG, 42);
    expect(castleCells(map)).toEqual(FOOTPRINT_CELLS);
    expect(map.castle).toEqual({ firstCol: 30, lastCol: 34, firstRow: 15, lastRow: 18 });
    expect([map.start.x, map.start.y]).toEqual([1950, 1170]);
  });

  it('Scenario: Huella en un mundo mayor (4.000 × 4.000, semilla 7: 31–35 × 30–33)', () => {
    const map = mapForSeed(withMap({}, { ...CONFIG.arena, width: 4000, height: 4000 }), 7);
    expect(castleCells(map)).toEqual(blockCells(31, 35, 30, 33));
    expect([map.start.x, map.start.y]).toEqual([2010, 2070]);
  });

  it('Scenario: Celdas tras el castillo alcanzables (solo castillo: 2.284 grass desde (1.950, 1.170))', () => {
    const map = mapForSeed(withMap({ rivers: 0, trunkDensity: 0 }), 7);
    const seen = reachableCells(map);
    const grass = typesOf(map).flatMap((t, i) => (t === 'grass' ? [i] : []));
    expect(grass).toHaveLength(2284);
    expect(grass.every((i) => seen[i] === 1)).toBe(true);
    expect(seen[14 * 64 + 32]).toBe(1);
    expect(countOf(map, 'castle')).toBe(20);
  });
});

// Design 0016 §3.4 paso 4: postcondición del castillo, con borradores rotos en el comprobador puro.
describe('checkCastle · postcondición del castillo', () => {
  const RULES = mapRules();
  const check = (layout: Layout) => () => {
    checkCastle(mapWith(RULES, layout), RULES);
  };

  it('un borrador correcto (solo la huella) pasa', () => {
    expect(check(castleBlock())).not.toThrow();
  });

  it('falta una celda de la huella', () => {
    expect(check({ ...castleBlock(), '32,17': 'grass' })).toThrow(/Invariante rota/);
  });

  it('una celda castle fuera de la huella', () => {
    expect(check({ ...castleBlock(), '3,3': 'castle' })).toThrow(/Invariante rota/);
  });

  it('puerta no caminable', () => {
    expect(check({ ...castleBlock(), '32,19': 'trunk' })).toThrow(/Invariante rota/);
  });

  it('celda caminable sin alcanzar desde la puerta', () => {
    const walled: Layout = { ...castleBlock(), '0,1': 'trunk', '1,0': 'trunk' };
    expect(check(walled)).toThrow(/Invariante rota/);
  });
});

describe('Salida ante la puerta del castillo (spec player-movement 0016)', () => {
  it('Scenario: Partida nueva con el mapa generado (1..50: jugador en (1.950, 1.170))', () => {
    const elsewhere = BALANCE_SEEDS.filter((seed) => {
      const { x, y } = startSeededRun(CONFIG, seed).snapshot().player;
      return x !== 1950 || y !== 1170;
    });
    expect(elsewhere).toEqual([]);
  });

  it('Scenario: Choque con la fachada del castillo (semilla 42: 60 ticks hacia arriba)', () => {
    const map = mapForSeed(CONFIG, 42);
    const path = ticks(startSeededRun(CONFIG, 42), 60, PlayerInput.of(0, -1));
    const end = path[path.length - 1]?.player;
    expect(end?.x).toBe(1950);
    expect(Math.abs((end?.y ?? 0) - 1156)).toBeLessThan(0.001);
    expect(path.some((s) => map.overlapsBlocked(s.player.x, s.player.y, 16))).toBe(false);
  });
});
