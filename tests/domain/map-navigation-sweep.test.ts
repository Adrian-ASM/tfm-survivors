import { beforeAll, describe, expect, it } from 'vitest';
import { GameMap } from '../../src/domain/map/GameMap';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { EnemySnapshot } from '../../src/domain/run/RunSnapshot';
import { BALANCE_SEEDS } from '../support/balanceSeeds';
import { LONG_RUN_HEALTH, aDefaultConfig, withPlayer } from '../support/builders';
import { randomInputs } from '../support/inputs';
import { mapRules } from '../support/mapLayouts';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';

// Barridos con el mapa generado de las semillas 1..50 (change 0019, design §9): enemy-behavior
// "Enemigos fuera de celdas no caminables en el mapa generado", enemy-spawning "Recolocación con
// castillo y río" y simulation-loop "Posiciones de enemigos reproducibles con el mapa generado".
// Un `beforeAll` por barrido y timeout propio, como balance.test.ts.
const CONFIG = withPlayer(aDefaultConfig(), { maxHealth: LONG_RUN_HEALTH });
const RULES = mapRules(CONFIG.map, CONFIG.arena.width, CONFIG.arena.height);
const MOVING_TICKS = 7200;
const STILL_TICKS = 3600;
const INPUT_SEED = 2026;
const SWEEP_TIMEOUT = 300_000;

interface Audit {
  /** Enemigos vivos (por tick) con el centro en una celda no caminable. */
  onBlocked: number;
  /** Enemigos vivos (por tick) con el centro en una celda `castle`. */
  inCastle: number;
  births: number;
  /** Apariciones en celda no caminable, fuera del mundo o a < 200 del jugador. */
  illegalBirths: number;
  /** Ticks con ≥ 1 enemigo en contacto con el jugador. */
  contactTicks: number;
}

const insideWorld = ({ x, y, radius }: EnemySnapshot): boolean =>
  x >= radius &&
  x <= CONFIG.arena.width - radius &&
  y >= radius &&
  y <= CONFIG.arena.height - radius;

/** Juega `n` ticks con la política fija y los inputs dados (sin ellos, quieto), auditando. */
function audit(seed: number, n: number, inputs?: readonly PlayerInput[]): Audit {
  const run = startSeededRun(CONFIG, seed);
  const built = GameMap.fromCells(run.map.cells, RULES);
  if (!built.ok) throw new Error(built.error.message);
  const map = built.value;
  const a: Audit = { onBlocked: 0, inCastle: 0, births: 0, illegalBirths: 0, contactTicks: 0 };
  let nextId = 0;
  for (let t = 0; t < n; t++) {
    chooseFirstWhileOpen(run);
    run.tick(inputs?.[t] ?? PlayerInput.NONE);
    const s = run.snapshot();
    let contact = false;
    for (const e of s.enemies) {
      const col = map.colAt(e.x);
      const row = map.rowAt(e.y);
      const walkable = map.isWalkable(col, row);
      if (!walkable) a.onBlocked += 1;
      if (map.typeAt(col, row) === 'castle') a.inCastle += 1;
      const d = Math.hypot(e.x - s.player.x, e.y - s.player.y);
      if (d <= e.radius + s.player.radius) contact = true;
      if (e.id < nextId) continue;
      nextId = e.id + 1;
      a.births += 1;
      if (!walkable || !insideWorld(e) || d < 200) a.illegalBirths += 1;
    }
    if (contact) a.contactTicks += 1;
  }
  return a;
}

describe('Enemigos fuera de celdas no caminables con el mapa generado (semillas 1..50)', () => {
  let moving: Map<number, Audit>;
  beforeAll(() => {
    const inputs = randomInputs(MOVING_TICKS, INPUT_SEED);
    moving = new Map(BALANCE_SEEDS.map((seed) => [seed, audit(seed, MOVING_TICKS, inputs)]));
  }, SWEEP_TIMEOUT);

  it('Scenario: Semillas del conjunto (7.200 ticks, input aleatorio)', () => {
    const offenders = BALANCE_SEEDS.filter((seed) => (moving.get(seed)?.onBlocked ?? 1) > 0);
    expect(offenders).toEqual([]);
    expect(BALANCE_SEEDS.every((seed) => (moving.get(seed)?.births ?? 0) > 0)).toBe(true);
  });
});

describe('Recolocación de las apariciones con el jugador quieto (semillas 1..50)', () => {
  let still: Map<number, Audit>;
  beforeAll(() => {
    still = new Map(BALANCE_SEEDS.map((seed) => [seed, audit(seed, STILL_TICKS)]));
  }, SWEEP_TIMEOUT);

  it('Scenario: Recolocación con castillo y río (ninguna aparición ilegal en 3.600 ticks)', () => {
    const offenders = BALANCE_SEEDS.filter((seed) => (still.get(seed)?.illegalBirths ?? 1) > 0);
    expect(offenders).toEqual([]);
    expect(BALANCE_SEEDS.every((seed) => (still.get(seed)?.births ?? 0) > 0)).toBe(true);
  });

  it('Scenario: Jugador quieto junto al castillo (semilla 42: nadie en el castillo, hay contacto)', () => {
    expect(startSeededRun(CONFIG, 42).snapshot().player).toMatchObject({ x: 1950, y: 1170 });
    const a = still.get(42);
    expect(a?.inCastle).toBe(0);
    expect(a?.contactTicks).toBeGreaterThan(0);
  });
});

describe('Posiciones de enemigos reproducibles con el mapa generado (semilla 42)', () => {
  it('Scenario: dos partidas con los mismos 3.600 inputs tienen la misma lista de enemigos', () => {
    const inputs = randomInputs(STILL_TICKS, INPUT_SEED);
    const enemies = (): string[] => {
      const run = startSeededRun(CONFIG, 42);
      const out: string[] = [];
      for (const input of inputs) {
        chooseFirstWhileOpen(run);
        run.tick(input);
        const list = run.snapshot().enemies;
        out.push(
          list
            .map(
              (e) => `${String(e.id)}:${e.type}:${String(e.x)},${String(e.y)}:${String(e.health)}`,
            )
            .join('|'),
        );
      }
      return out;
    };
    const a = enemies();
    expect(a.some((s) => s.length > 0)).toBe(true);
    expect(enemies()).toEqual(a);
  });
});
