import { describe, expect, it } from 'vitest';
import { GameMap } from '../../src/domain/map/GameMap';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { BALANCE_SEEDS } from '../support/balanceSeeds';
import { LONG_RUN_HEALTH, aDefaultConfig, withPlayer } from '../support/builders';
import { randomInputs } from '../support/inputs';
import { mapRules } from '../support/mapLayouts';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';

// Invariantes largos con edificios (0026): enemy-behavior "Semillas del conjunto con edificios" y
// player-movement "Partida larga sin solapes con edificios". Escenario preparado con
// `RunSetup.sites`: los 6 solares de cada mapa construidos al empezar (3 casas y 3 torres). La spec
// de enemy-behavior los construye en el tick 1.800; en el núcleo no hay forma de construir sin
// llegar al acceso, así que se preparan en el tick 0 (más ticks con edificios que la spec).
const CONFIG = withPlayer(aDefaultConfig(), { maxHealth: LONG_RUN_HEALTH });
const RULES = mapRules(CONFIG.map, CONFIG.arena.width, CONFIG.arena.height);
const HALF = [
  { state: 'house' },
  { state: 'house' },
  { state: 'house' },
  { state: 'tower' },
  { state: 'tower' },
  { state: 'tower' },
] as const;
const INPUT_SEED = 2026;
const TIMEOUT = 300_000;

/**
 * Partida de la semilla (con sus 6 solares construidos o, con `free`, libres) y su mapa con las
 * huellas de obra, para auditar (0027: las huellas libres bloquean desde el tick 0).
 */
function builtRun(seed: number, free = false) {
  const run = startSeededRun(CONFIG, seed, 'generated', free ? {} : { sites: HALF });
  const grid = GameMap.fromCells(run.map.cells, RULES);
  if (!grid.ok) throw new Error(grid.error.message);
  for (const s of run.map.sites) grid.value.build(s.col, s.row, s.cols, s.rows);
  return { run, map: grid.value };
}

describe('Invariantes con los solares libres (0027)', () => {
  it(
    'Scenario: Semillas del conjunto (6 solares libres, 7.200 ticks, ningún enemigo en celda bloqueada)',
    () => {
      const inputs = randomInputs(7200, INPUT_SEED);
      const bad: string[] = [];
      for (const seed of BALANCE_SEEDS) {
        const { run, map } = builtRun(seed, true);
        for (let t = 0; t < 7200 && run.status !== 'over'; t++) {
          chooseFirstWhileOpen(run);
          run.tick(inputs[t] ?? PlayerInput.NONE);
          for (const e of run.snapshot().enemies) {
            if (!map.isWalkable(map.colAt(e.x), map.rowAt(e.y)))
              bad.push(`${String(seed)}#${String(e.id)}`);
          }
        }
        expect(run.snapshot().sites.every((x) => x.state === 'free')).toBe(true);
      }
      expect(bad.slice(0, 10)).toEqual([]);
    },
    TIMEOUT,
  );

  it(
    'Scenario: Partida larga sin solapes con los solares libres (semilla 7, 36.000 ticks)',
    () => {
      const inputs = randomInputs(36_000, INPUT_SEED);
      const { run, map } = builtRun(7, true);
      let overlaps = 0;
      for (let t = 0; t < 36_000 && run.status !== 'over'; t++) {
        chooseFirstWhileOpen(run);
        run.tick(inputs[t] ?? PlayerInput.NONE);
        const { x, y, radius } = run.snapshot().player;
        if (map.overlapsBlocked(x, y, radius)) overlaps++;
      }
      expect(run.snapshot().tick).toBe(36_000);
      expect(overlaps).toBe(0);
    },
    TIMEOUT,
  );
});

describe('Invariantes con edificios (0026)', () => {
  it(
    'Scenario: Semillas del conjunto con edificios (7.200 ticks, ningún enemigo en celda bloqueada)',
    () => {
      const inputs = randomInputs(7200, INPUT_SEED);
      const bad: string[] = [];
      for (const seed of BALANCE_SEEDS) {
        const { run, map } = builtRun(seed);
        for (let t = 0; t < 7200 && run.status !== 'over'; t++) {
          chooseFirstWhileOpen(run);
          run.tick(inputs[t] ?? PlayerInput.NONE);
          for (const e of run.snapshot().enemies) {
            if (!map.isWalkable(map.colAt(e.x), map.rowAt(e.y)))
              bad.push(`${String(seed)}#${String(e.id)}`);
          }
        }
        expect(run.snapshot().sites.filter((x) => x.state !== 'free')).toHaveLength(6);
      }
      expect(bad.slice(0, 10)).toEqual([]);
    },
    TIMEOUT,
  );

  it(
    'Scenario: Partida larga sin solapes con edificios (semilla 7, 36.000 ticks)',
    () => {
      const inputs = randomInputs(36_000, INPUT_SEED);
      const { run, map } = builtRun(7);
      let overlaps = 0;
      for (let t = 0; t < 36_000 && run.status !== 'over'; t++) {
        chooseFirstWhileOpen(run);
        run.tick(inputs[t] ?? PlayerInput.NONE);
        const { x, y, radius } = run.snapshot().player;
        if (map.overlapsBlocked(x, y, radius)) overlaps++;
      }
      expect(run.snapshot().tick).toBe(36_000);
      expect(overlaps).toBe(0);
    },
    TIMEOUT,
  );
});
