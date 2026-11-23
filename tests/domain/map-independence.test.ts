import { beforeAll, describe, expect, it } from 'vitest';
import type { CellType } from '../../src/domain/map/CellType';
import { Run } from '../../src/domain/run/Run';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aContactConfig, play, startRun, startSeededRun, ticks } from '../support/runs';
import { aDefaultConfig } from '../support/builders';
import { cellsWith, mapRules } from '../support/mapLayouts';

// Spec procedural-map, "Azar del mapa independiente del de la partida", y enemy-behavior, "Los
// enemigos ignoran el mapa". Semilla 7, input (0, 0) y política de elección fija.
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
    empty = snaps(startSeededRun(CONFIG, 7, 'empty'), TICKS);
  });

  it('el mapa generado no es el vacío (la comparación tiene sentido)', () => {
    const map = startSeededRun(CONFIG, 7).map;
    expect(map.counts.trunk).toBeGreaterThan(0);
    expect(startSeededRun(CONFIG, 7, 'empty').map.counts.grass).toBe(576);
  });

  it('Scenario: Mismos spawns con y sin mapa (1.200 ticks: id, tipo y posición)', () => {
    expect(generated).toHaveLength(TICKS);
    expect(generated.some((s) => s.enemies.length > 0)).toBe(true);
    expect(generated.every((s) => s.offer.length === 0)).toBe(true);
    expect(spawnsPerTick(generated)).toEqual(spawnsPerTick(empty));
  });

  it('Scenario: Misma trayectoria con mapa generado y vacío (id, tipo, posición y vida)', () => {
    const enemies = (list: RunSnapshot[]) =>
      list.map((s) => s.enemies.map((e) => [e.id, e.type, e.x, e.y, e.health]));
    expect(enemies(generated)).toEqual(enemies(empty));
  });
});

describe('Primera oferta con y sin mapa (semilla 7, quieto)', () => {
  /** Juega hasta la primera oferta y devuelve el tick y sus opciones. */
  function firstOffer(run: Run): { tick: number; options: string[] } {
    play(run, 10_800, (_t, r) => r.status === 'choosing');
    const s = run.snapshot();
    return { tick: s.tick, options: s.offer.map((o) => o.id) };
  }

  it('Scenario: Primera oferta igual con y sin mapa (mismo tick, mismas opciones y orden)', () => {
    const generated = firstOffer(startSeededRun(CONFIG, 7));
    const empty = firstOffer(startSeededRun(CONFIG, 7, 'empty'));
    expect(generated.options).toHaveLength(3);
    expect(generated.tick).toBe(empty.tick);
    expect(generated.options).toEqual(empty.options);
  });
});

describe('Los enemigos ignoran el mapa (spec enemy-behavior)', () => {
  it('Scenario: Persecución a través del agua (celdas (3..6, 4) de agua)', () => {
    const config = aContactConfig();
    const water: Record<string, CellType> = {
      '3,4': 'water',
      '4,4': 'water',
      '5,4': 'water',
      '6,4': 'water',
    };
    const r = Run.start(
      config,
      new Mulberry32RandomGenerator(42),
      { player: { x: 480, y: 270 }, enemies: [{ type: 'probe', x: 100, y: 270 }] },
      { kind: 'cells', cells: cellsWith(mapRules(undefined, 960, 540), water) },
    );
    if (!r.ok) throw new Error(r.error.message);
    const path = ticks(r.value, 240);
    const at = (n: number) => path[n - 1]?.enemies[0];
    expect(at(60)?.x).toBeCloseTo(160, 3);
    expect(at(60)?.y).toBe(270);
    expect(at(240)?.x).toBeCloseTo(340, 3);
    const open = ticks(
      startRun(config, {
        player: { x: 480, y: 270 },
        enemies: [{ type: 'probe', x: 100, y: 270 }],
      }),
      240,
    );
    expect(open.map((s) => s.enemies[0]?.x)).toEqual(path.map((s) => s.enemies[0]?.x));
  });
});
