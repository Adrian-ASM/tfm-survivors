import { beforeAll, describe, expect, it } from 'vitest';
import type { Run } from '../../src/domain/run/Run';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { GameMap } from '../../src/domain/map/GameMap';
import { resolveTerrain } from '../../src/domain/map/TerrainSource';
import { seededRun } from '../../src/composition/seedSource';
import { mapRules } from '../support/mapLayouts';
import { play, startEmptyWithExit, startSeededRun } from '../support/runs';
import { aDefaultConfig } from '../support/builders';

// Spec procedural-map, "Azar del mapa independiente del de la partida" (los escenarios de
// enemy-behavior "Los enemigos ignoran el mapa" se retiran en 0019). Semilla 7, input (0, 0) y
// política de elección fija.
const CONFIG = aDefaultConfig();
const TICKS = 1200;

/**
 * Snapshots de hasta `n` ticks con la política fija; para tras el tick en que se abre la primera
 * oferta (spec: "hasta que una de las dos abre su primera oferta o termina").
 */
function snaps(run: Run, n: number): RunSnapshot[] {
  const out: RunSnapshot[] = [];
  play(run, n, (_t, r) => {
    out.push(r.snapshot());
    return r.status === 'choosing';
  });
  return out;
}

/**
 * Aparición del director: tipo y posición en el snapshot de su tick. Sin id: los guardias toman
 * identificadores de la misma secuencia (0021).
 */
interface Spawn {
  readonly type: string;
  readonly x: number;
  readonly y: number;
}

const GUARD = 'goblin-tnt-guard';

/** Enemigos que aparecen en cada tick: los del director o, con `guards`, solo los guardias. */
function spawnsPerTick(list: readonly RunSnapshot[], guards = false): Spawn[][] {
  const seen = new Set<number>();
  return list.map((s) =>
    s.enemies
      .filter((e) => !seen.has(e.id))
      .map((e) => {
        seen.add(e.id);
        return { type: e.type, x: e.x, y: e.y };
      })
      .filter((e) => (e.type === GUARD) === guards),
  );
}

/** Mapa generado por la semilla 7 (el de `startSeededRun`). */
/** Mapa generado de la semilla 7 con las huellas de sus solares libres (ADR-0026: bloquean). */
function generatedMap(): GameMap {
  const map = resolveTerrain(seededRun(7).terrain, mapRules());
  if (!map.ok) throw new Error(map.error.message);
  for (const s of startSeededRun(CONFIG, 7).map.sites)
    map.value.build(s.col, s.row, s.cols, s.rows);
  return map.value;
}

describe('Mapa generado frente a mapa vacío (semilla 7, quieto)', () => {
  let generated: RunSnapshot[];
  let empty: RunSnapshot[];
  beforeAll(() => {
    generated = snaps(startSeededRun(CONFIG, 7), TICKS);
    empty = snaps(startEmptyWithExit(CONFIG, 7), TICKS);
  });

  it('el mapa generado no es el vacío (la comparación tiene sentido)', () => {
    const map = startSeededRun(CONFIG, 7).map;
    expect(map.counts.trunk).toBeGreaterThan(0);
    expect(startSeededRun(CONFIG, 7, 'empty').map.counts.grass).toBe(2304);
  });

  // 0019: las apariciones que caen en una celda no caminable del mapa generado están en la
  // recolocación (nearestWalkable) de la posición del mapa vacío.
  // 0021: solo las apariciones del director (tipo, tick y posición), sin los guardias de las casas.
  it('Scenario: Mismos spawns con y sin mapa (tipo, tick y posición o su recolocación)', () => {
    const n = Math.min(generated.length, empty.length);
    expect(n).toBeGreaterThan(600);
    const map = generatedMap();
    const at = { x: 0, y: 0 };
    const raw = spawnsPerTick(empty.slice(0, n));
    const expected = raw.map((list) =>
      list.map((e) => {
        map.nearestWalkable(e.x, e.y, at);
        return { ...e, x: at.x, y: at.y };
      }),
    );
    const got = spawnsPerTick(generated.slice(0, n));
    expect(got.flat().length).toBeGreaterThan(0);
    expect(got).toEqual(expected);
    const moved = expected.flat().filter((e, i) => {
      const before = raw.flat()[i];
      return before !== undefined && (before.x !== e.x || before.y !== e.y);
    });
    expect(moved.length).toBeGreaterThan(0);
    expect(spawnsPerTick(empty.slice(0, n), true).flat()).toEqual([]);
  });
});

/** Plazo de primera subida (spec upgrades, "Primera subida en el núcleo"). */
const FIRST_OFFER_LIMIT = 4800;

describe('Primera oferta con y sin mapa (semilla 7, quieto)', () => {
  /** Juega hasta la primera oferta y devuelve el tick y sus opciones. */
  function firstOffer(run: Run): { tick: number; options: string[] } {
    play(run, FIRST_OFFER_LIMIT, (_t, r) => r.status === 'choosing');
    const s = run.snapshot();
    return { tick: s.tick, options: s.offer.map((o) => o.id) };
  }

  // 0017: se exige el plazo de primera subida en ambas, no el mismo tick ni las mismas opciones.
  // 0021 (casas, guardias y barril A3): medida en el tick 2.082 con el generado y 2.057 con el vacío.
  it('Scenario: Primera oferta en plazo con y sin mapa (ambas ≤ 4.800 ticks)', () => {
    const generated = firstOffer(startSeededRun(CONFIG, 7));
    const empty = firstOffer(startEmptyWithExit(CONFIG, 7));
    expect(generated.options).toHaveLength(3);
    expect(empty.options).toHaveLength(3);
    expect(generated.tick).toBeLessThanOrEqual(FIRST_OFFER_LIMIT);
    expect(empty.tick).toBeLessThanOrEqual(FIRST_OFFER_LIMIT);
  });
});
