import { beforeAll, describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { BALANCE_SEEDS, WIN_BAND } from '../support/balanceSeeds';
import { aDefaultConfig } from '../support/builders';
import { isWin, perRun, traceBotBatch, type BotTrace } from '../support/balanceMeasure';
import { builderBot } from '../support/policies';

// Spec build-sites (0026), "Balance con los solares": un lote del bot v5 (el v4 más construcción,
// `REFERENCE_BUILD_POLICY`) con el contenido por defecto final, entre 25 y 35 victorias, y el
// invariante "Nada en la huella tras construir" comprobado en cada tick del mismo lote.
// M1 (apply): 29/50, 1,22 casas y 0,56 torres por partida, ~43 s en local (×2,8 ≈ 120 s en CI).
const BOT_BATCH_TIMEOUT_MS = 180_000;
const DEFAULT_CONFIG = aDefaultConfig();
const CELL = DEFAULT_CONFIG.map.cellSize;

/** Celdas construidas del snapshot (`col,row`). */
function builtCells(s: RunSnapshot): Set<string> {
  const out = new Set<string>();
  for (const site of s.sites) {
    if (site.state === 'free') continue;
    const { col, row, cols, rows } = site[site.state];
    for (let r = row; r < row + rows; r++)
      for (let c = col; c < col + cols; c++) out.add(`${String(c)},${String(r)}`);
  }
  return out;
}

const cellOf = (x: number, y: number) =>
  `${String(Math.floor(x / CELL))},${String(Math.floor(y / CELL))}`;

/** ¿Solapa el círculo alguna celda construida (tangencia no es solape)? */
function overlaps(cells: Set<string>, x: number, y: number, r: number): boolean {
  for (let row = Math.floor((y - r) / CELL); row <= Math.floor((y + r) / CELL); row++) {
    for (let col = Math.floor((x - r) / CELL); col <= Math.floor((x + r) / CELL); col++) {
      if (!cells.has(`${String(col)},${String(row)}`)) continue;
      const ex = Math.max(col * CELL - x, 0, x - (col + 1) * CELL);
      const ey = Math.max(row * CELL - y, 0, y - (row + 1) * CELL);
      if (ex * ex + ey * ey < r * r - 1e-6) return true;
    }
  }
  return false;
}

/**
 * Comprobación por tick de "Nada en la huella tras construir" en una partida. Las celdas
 * construidas se recalculan solo al cambiar los solares. Recogibles: los no atraídos no se mueven
 * nunca, así que uno nuevo (id no visto) en una celda construida, o uno que sigue en la misma
 * posición de una celda construida dos ticks seguidos, incumple; uno atraído que la cruza en vuelo
 * hacia el jugador, no (la spec exige los no atraídos).
 */
function footprintCheck(seed: number, broken: string[]) {
  let key = '';
  let cells = new Set<string>();
  let maxId = Infinity;
  let parked = new Map<number, string>();
  return (s: RunSnapshot): void => {
    let k = '';
    for (const site of s.sites) k += site.state;
    if (k !== key) [key, cells] = [k, builtCells(s)];
    const lastId = s.pickups.at(-1)?.id ?? -1;
    if (cells.size === 0) {
      maxId = lastId;
      return;
    }
    const bad = (what: string) => broken.push(`${String(seed)}@${String(s.tick)}: ${what}`);
    for (const e of s.enemies) if (cells.has(cellOf(e.x, e.y))) bad(`enemigo ${String(e.id)}`);
    const now = new Map<number, string>();
    for (const p of s.pickups) {
      if (!cells.has(cellOf(p.x, p.y))) continue;
      const at = `${String(p.x)},${String(p.y)}`;
      if (p.id > maxId || parked.get(p.id) === at) bad(`recogible ${String(p.id)}`);
      now.set(p.id, at);
    }
    parked = now;
    maxId = Math.max(maxId === Infinity ? -1 : maxId, lastId);
    for (const o of s.sheep) if (overlaps(cells, o.x, o.y, o.radius)) bad(`oveja ${String(o.id)}`);
    if (overlaps(cells, s.player.x, s.player.y, s.player.radius)) bad('jugador');
  };
}

describe('Balance con los solares y el bot v5 (spec build-sites 0026)', () => {
  let traces: BotTrace[] = [];
  let batchMs = 0;
  const broken: string[] = [];

  beforeAll(() => {
    const t0 = performance.now();
    traces = traceBotBatch(DEFAULT_CONFIG, builderBot, (seed) => footprintCheck(seed, broken));
    batchMs = performance.now() - t0;
  }, BOT_BATCH_TIMEOUT_MS);

  it('Scenario: Victorias del bot v5 (25–35; ≥ 1 casa y ≥ 1 torre en alguna partida)', () => {
    const wins = traces.filter((t) => isWin(t.final)).length;
    const message = `victorias del bot v5: ${String(wins)}/50`;

    expect(traces).toHaveLength(BALANCE_SEEDS.length);
    expect(wins, message).toBeGreaterThanOrEqual(WIN_BAND.min);
    expect(wins, message).toBeLessThanOrEqual(WIN_BAND.max);
    expect(traces.some((t) => t.buildings.houses >= 1)).toBe(true);
    expect(traces.some((t) => t.buildings.towers >= 1)).toBe(true);
  });

  it('Scenario: Nada en la huella tras construir (semillas 1 a 50, bot v5)', () => {
    expect(traces.some((t) => t.buildings.builtTicks.length > 0)).toBe(true);
    expect(broken.slice(0, 10)).toEqual([]);
  });

  it('edificios, oro de las casas, bajas por flechas y tiempo del lote (informativo)', () => {
    const per = (pick: (t: BotTrace) => number) => perRun(traces, pick).toFixed(2);
    const secs = (batchMs / 1000).toFixed(1);
    console.info(
      `v5: victorias ${String(traces.filter((t) => isWin(t.final)).length)}/50 · casas ` +
        `${per((t) => t.buildings.houses)} · torres ${per((t) => t.buildings.towers)} · oro de ` +
        `casas ${per((t) => t.buildings.houseGold)} · bajas por flechas ` +
        `${per((t) => t.buildings.arrowKills)} · lote ${secs} s (×2,8 ≈ ` +
        `${((batchMs / 1000) * 2.8).toFixed(0)} s en CI)`,
    );
    expect(batchMs).toBeLessThan(BOT_BATCH_TIMEOUT_MS);
  });
});
