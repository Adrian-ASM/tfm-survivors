import { describe, expect, it } from 'vitest';
import type { DeclaredStructure } from '../../../src/domain/map/TerrainSource';
import { Run, type RunSetup } from '../../../src/domain/run/Run';
import {
  SETUP_GUARD_NEEDS_POST,
  SETUP_HOUSE_UNKNOWN,
  SETUP_POST_NOT_GUARD,
} from '../../../src/domain/run/RunSetup';
import { Mulberry32RandomGenerator } from '../../../src/infrastructure/random/Mulberry32RandomGenerator';
import { inState } from '../../support/builders';
import {
  HOUSE_AT_20_10,
  aCampScenario,
  aGuardAt,
  startDeclared,
  startOn,
} from '../../support/camps';
import { cellsWith, mapRules, type Layout } from '../../support/mapLayouts';
import { ticks } from '../../support/runs';

const POST = { x: 1000, y: 1000 };
const FAR = { x: 3000, y: 1000 };
/** Troncos en las celdas (10, 2) a (10, 6): x en [600, 660], y en [120, 420]. */
const WALL: Layout = {
  '10,2': 'trunk',
  '10,3': 'trunk',
  '10,4': 'trunk',
  '10,5': 'trunk',
  '10,6': 'trunk',
};

const inWall = (x: number, y: number): boolean => {
  const c = Math.floor(x / 60);
  const r = Math.floor(y / 60);
  return c === 10 && r >= 2 && r <= 6;
};

describe('Guardia · navegación hacia un punto fijo (enemy-behavior)', () => {
  it('Scenario: Línea recta hasta el punto', () => {
    const run = startDeclared(aCampScenario(), [], {
      player: FAR,
      enemies: [aGuardAt(1300, 1000, inState('return'))],
    });
    const snaps = ticks(run, 300);
    const at = (t: number) => snaps[t - 1]?.enemies[0];
    expect(at(299)?.x).toBeCloseTo(1001, 3);
    expect(at(299)?.y).toBeCloseTo(1000, 3);
    expect(at(300)?.x).toBeCloseTo(1000, 3);
    expect(at(300)?.y).toBeCloseTo(1000, 3);
  });

  it('Scenario: Rodeo de un muro hasta el puesto', () => {
    const config = aCampScenario();
    const rules = mapRules(config.map, config.arena.width, config.arena.height);
    const run = startOn(
      config,
      { kind: 'cells', cells: cellsWith(rules, WALL) },
      {
        player: { x: 3000, y: 2000 },
        enemies: [aGuardAt(330, 270, { post: { x: 930, y: 270 }, ...inState('return') })],
      },
    );
    const positions = ticks(run, 1200).map((s) => s.enemies[0] ?? { x: NaN, y: NaN });
    expect(positions.filter((p) => inWall(p.x, p.y))).toEqual([]);
    const arrived =
      positions.findIndex((p) => Math.abs(p.x - 930) <= 0.001 && Math.abs(p.y - 270) <= 0.001) + 1;
    expect(arrived).toBeGreaterThanOrEqual(601);
    expect(arrived).toBeLessThanOrEqual(960);
  });
});

describe('RunSetup · puesto de los guardias', () => {
  const config = aCampScenario();
  const start = (
    enemies: NonNullable<RunSetup['enemies']>,
    structures: readonly DeclaredStructure[] = [HOUSE_AT_20_10],
  ) =>
    Run.start(
      config,
      new Mulberry32RandomGenerator(1),
      { player: FAR, enemies },
      {
        kind: 'open',
        structures,
      },
    );

  it('un guardia sin puesto ni casa no crea la partida', () => {
    const r = start([{ type: 'guard', x: 1000, y: 1000 }]);
    expect(!r.ok && r.error.field).toBe('setup.enemies.0');
    expect(!r.ok && r.error.message).toContain(SETUP_GUARD_NEEDS_POST);
  });

  it('un guardia con puesto y casa a la vez no crea la partida', () => {
    const r = start([{ type: 'guard', x: 1, y: 1, post: POST, house: 0 }]);
    expect(!r.ok && r.error.message).toContain(SETUP_GUARD_NEEDS_POST);
  });

  it('un enemigo que no es guardia no puede tener puesto ni casa', () => {
    for (const extra of [{ post: POST }, { house: 0 }]) {
      const r = start([{ type: 'probe', x: 1000, y: 1000, ...extra }]);
      expect(!r.ok && r.error.message).toContain(SETUP_POST_NOT_GUARD);
    }
  });

  it('la casa de un guardia debe ser una casa de la partida', () => {
    const tower = { ...HOUSE_AT_20_10, type: 'goblin-tower' };
    const cases: [number, DeclaredStructure][] = [
      [1, HOUSE_AT_20_10],
      [0, tower],
      [0.5, HOUSE_AT_20_10],
    ];
    for (const [house, structure] of cases) {
      const r = start([aGuardAt(1, 1, { house })], [structure]);
      expect(!r.ok && r.error.field).toBe('setup.enemies.0.house');
      expect(!r.ok && r.error.message).toContain(SETUP_HOUSE_UNKNOWN);
    }
    expect(start([aGuardAt(1000, 1000, { house: 0 })]).ok).toBe(true);
  });
});
