import { beforeAll, describe, expect, it } from 'vitest';
import type { Run } from '../../src/domain/run/Run';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { play, startEmptyWithExit, startSeededRun } from '../support/runs';
import { aDefaultConfig } from '../support/builders';

// Spec procedural-map, "Azar del mapa independiente del de la partida" (los escenarios de
// enemy-behavior "Los enemigos ignoran el mapa" se retiran en 0019). Semilla 7, input (0, 0) y
// política de elección fija.
const CONFIG = aDefaultConfig();
const TICKS = 1200;

/** Snapshots de los `n` ticks con la política fija (sin ofertas en este plazo, ver más abajo). */
function snaps(run: Run, n: number): RunSnapshot[] {
  const out: RunSnapshot[] = [];
  play(run, n, (_t, r) => {
    out.push(r.snapshot());
    return false;
  });
  return out;
}

/** Enemigos que aparecen en cada tick: id, tipo y posición de aparición. */
function spawnsPerTick(list: readonly RunSnapshot[]): string[][] {
  const seen = new Set<number>();
  return list.map((s) =>
    s.enemies
      .filter((e) => !seen.has(e.id))
      .map((e) => {
        seen.add(e.id);
        return `${String(e.id)}:${e.type}:${String(e.x)},${String(e.y)}`;
      }),
  );
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

  it('Scenario: Mismos spawns con y sin mapa (1.200 ticks: id, tipo y posición)', () => {
    expect(generated).toHaveLength(TICKS);
    expect(generated.some((s) => s.enemies.length > 0)).toBe(true);
    expect(generated.every((s) => s.offer.length === 0)).toBe(true);
    expect(spawnsPerTick(generated)).toEqual(spawnsPerTick(empty));
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
  it('Scenario: Primera oferta en plazo con y sin mapa (ambas ≤ 4.800 ticks)', () => {
    const generated = firstOffer(startSeededRun(CONFIG, 7));
    const empty = firstOffer(startEmptyWithExit(CONFIG, 7));
    expect(generated.options).toHaveLength(3);
    expect(empty.options).toHaveLength(3);
    expect(generated.tick).toBeLessThanOrEqual(FIRST_OFFER_LIMIT);
    expect(empty.tick).toBeLessThanOrEqual(FIRST_OFFER_LIMIT);
  });
});
