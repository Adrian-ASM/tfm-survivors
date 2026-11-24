import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../../src/domain/player/PlayerInput';
import type { RunSnapshot } from '../../../src/domain/run/RunSnapshot';
import { aBarrelType, aDynamite, aTntType, inState } from '../../support/builders';
import { TNT_GUARD, aCampScenario, aGuardAt, startDeclared } from '../../support/camps';
import { enemyById, ticks } from '../../support/runs';

const FAR = { x: 3000, y: 1000 };
const config = (o: Parameters<typeof aCampScenario>[0] = {}) =>
  aCampScenario({ player: { maxHealth: 1e9, ...o.player }, ...o });
const guardOf = (s: RunSnapshot | undefined) => {
  const e = s?.enemies[0];
  if (!e) throw new Error('sin guardia');
  return e;
};

describe('Guardia · transiciones tras moverse (enemy-behavior)', () => {
  it('Scenario: Detección justo en el límite', () => {
    const at = (py: number) =>
      guardOf(
        ticks(
          startDeclared(config(), [], {
            player: { x: 1000, y: py },
            enemies: [aGuardAt(1000, 1000)],
          }),
          1,
        )[0],
      );
    const inside = at(1199);
    expect(inside.x).toBeCloseTo(999.293, 3);
    expect(inside.stateKind).toBe('alert');
    expect(at(1202).stateKind).toBe('patrol');
  });

  it('Scenario: Alerta, lanzamiento y vuelta a la alerta', () => {
    const run = startDeclared(config(), [], {
      player: { x: 1000, y: 1000 },
      enemies: [aGuardAt(1150, 1000, inState('alert'))],
    });
    const snaps = ticks(run, 130);
    const at = (t: number) => snaps[t - 1];
    expect(guardOf(at(49)).stateKind).toBe('alert');
    expect(guardOf(at(50))).toMatchObject({ stateKind: 'charge', x: 1100, y: 1000 });
    expect(at(69)?.dynamites).toHaveLength(0);
    expect(at(70)?.dynamites).toHaveLength(1);
    expect(at(70)?.dynamites[0]).toMatchObject({ x: 1100, y: 1000, targetX: 1000, targetY: 1000 });
    expect(guardOf(at(70)).stateKind).toBe('wait');
    const last = guardOf(at(130));
    expect(last.stateKind).toBe('charge');
    expect(last.x).toBeCloseTo(1099, 3);
    const kinds = snaps.map((s) => guardOf(s).stateKind);
    expect(kinds.filter((k) => k === 'patrol' || k === 'return')).toEqual([]);
  });

  it('Scenario: Abandono de la alerta', () => {
    const run = startDeclared(config({ player: { speed: 215 } }), [], {
      player: { x: 1300, y: 1000 },
      enemies: [aGuardAt(1000, 1000, inState('alert'))],
    });
    const snaps = ticks(run, 39, PlayerInput.of(1, 0));
    const distance = (s: RunSnapshot | undefined) => (s ? s.player.x - guardOf(s).x : NaN);
    expect(distance(snaps[37])).toBeCloseTo(398.167, 3);
    expect(guardOf(snaps[37]).stateKind).toBe('alert');
    expect(distance(snaps[38])).toBeCloseTo(400.75, 3);
    expect(guardOf(snaps[38]).stateKind).toBe('return');
  });

  it('Scenario: Llegada al puesto', () => {
    const run = startDeclared(config(), [], {
      player: FAR,
      enemies: [aGuardAt(1300, 1000, inState('return'))],
    });
    const snaps = ticks(run, 301);
    expect(guardOf(snaps[298]).stateKind).toBe('return');
    expect(guardOf(snaps[299])).toMatchObject({ stateKind: 'patrol', x: 1000, y: 1000 });
    const g = guardOf(snaps[300]);
    expect(Math.hypot(g.x - 1000, g.y - 1000)).toBeCloseTo(1, 3);
    expect(g.x).toBeLessThan(1000);
    expect(g.y).toBeLessThan(1000);
  });

  it('Scenario: Detección durante la vuelta', () => {
    const run = startDeclared(config(), [], {
      player: { x: 1150, y: 1000 },
      enemies: [aGuardAt(1300, 1000, inState('return'))],
    });
    expect(guardOf(ticks(run, 1)[0]).stateKind).toBe('alert');
  });

  it('Scenario: Estado de comportamiento en el snapshot', () => {
    const run = startDeclared(config({ types: [aBarrelType(), aTntType()] }), [], {
      player: FAR,
      enemies: [
        { type: 'goblin-barrel', x: 1500, y: 1500, ...inState('fuse') },
        { type: 'goblin-tnt', x: 500, y: 1500, ...inState('reload') },
        aGuardAt(1000, 1000),
        aGuardAt(1200, 1000, inState('alert')),
        aGuardAt(1400, 1000, inState('return')),
      ],
    });
    const s = run.snapshot();
    expect(enemyById(s, 0)).toMatchObject({ state: 'fuse', stateKind: 'fuse' });
    expect(enemyById(s, 1)).toMatchObject({ state: 'reload', stateKind: 'wait' });
    expect(enemyById(s, 2)).toMatchObject({ state: 'patrol', stateKind: 'patrol' });
    expect(enemyById(s, 3)).toMatchObject({ state: 'alert', stateKind: 'alert' });
    expect(enemyById(s, 4)).toMatchObject({ state: 'return', stateKind: 'return' });
  });

  it('Scenario: Guardia alcanzado por una explosión', () => {
    const run = startDeclared(config({ types: [TNT_GUARD] }), [], {
      player: FAR,
      enemies: [{ type: 'goblin-tnt-guard', x: 1000, y: 1000, post: { x: 1000, y: 1000 } }],
      dynamites: [aDynamite({ x: 1030, y: 1000 }, 1)],
    });
    const g = guardOf(ticks(run, 1)[0]);
    expect(g.health).toBe(25);
    expect(g.stateKind).toBe('patrol');
  });
});
