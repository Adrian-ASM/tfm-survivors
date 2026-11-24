import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../../src/domain/run/RunSnapshot';
import { withWeapons } from '../../support/builders';
import { aCampScenario, aGuardAt, startDeclared, startOn } from '../../support/camps';
import { cellsWith, mapRules } from '../../support/mapLayouts';
import { ticks } from '../../support/runs';
import { aLinter, weaponsOf } from '../../support/weapons';

const FAR = { x: 3000, y: 1000 };
const guardOf = (s: RunSnapshot | undefined) => {
  const e = s?.enemies[0];
  if (!e) throw new Error('sin guardia');
  return e;
};
const near = (a: { x: number; y: number }, x: number, y: number) =>
  Math.abs(a.x - x) <= 0.001 && Math.abs(a.y - y) <= 0.001;

describe('Guardia · patrulla (enemy-behavior)', () => {
  it('Scenario: Patrulla en el mapa vacío', () => {
    const run = startDeclared(aCampScenario(), [], {
      player: FAR,
      enemies: [aGuardAt(1000, 1000)],
    });
    const snaps = ticks(run, 565);
    const at = (t: number) => guardOf(snaps[t - 1]);
    expect(near(at(85), 940, 940)).toBe(true);
    expect(near(at(205), 1060, 940)).toBe(true);
    expect(near(at(325), 1060, 1060)).toBe(true);
    expect(near(at(445), 940, 1060)).toBe(true);
    expect(near(at(565), 940, 940)).toBe(true);
    const guards = snaps.map(guardOf);
    expect(guards.every((g) => g.stateKind === 'patrol')).toBe(true);
    const inside = (v: number) => v >= 940 - 1e-9 && v <= 1060 + 1e-9;
    expect(guards.every((g) => inside(g.x) && inside(g.y))).toBe(true);
  });

  it('Scenario: Punto de patrulla recolocado', () => {
    const config = aCampScenario();
    const rules = mapRules(config.map, config.arena.width, config.arena.height);
    const run = startOn(
      config,
      { kind: 'cells', cells: cellsWith(rules, { '15,15': 'trunk' }) },
      { player: FAR, enemies: [aGuardAt(1000, 1000)] },
    );
    const guards = ticks(run, 600).map(guardOf);
    const firstArrival = guards.findIndex((g) => near(g, 990, 930));
    expect(firstArrival).toBeGreaterThanOrEqual(0);
    expect(guards.slice(0, firstArrival).some((g) => near(g, 1060, 940))).toBe(false);
    const cell = (v: number) => Math.floor(v / 60);
    expect(guards.filter((g) => cell(g.x) === 15 && cell(g.y) === 15)).toEqual([]);
  });

  it('Scenario: El daño no saca de la patrulla', () => {
    const base = aCampScenario();
    const setup = { player: { x: 1000, y: 700 }, enemies: [aGuardAt(1000, 1000)] };
    const quiet = ticks(startDeclared(base, [], setup), 100).map(guardOf);
    const shot = ticks(
      startDeclared(withWeapons(base, weaponsOf([aLinter()])), [], setup),
      100,
    ).map(guardOf);
    expect(shot.some((g) => g.health < 1e6)).toBe(true);
    const view = (g: ReturnType<typeof guardOf>) => [g.state, g.stateKind, g.x, g.y];
    expect(shot.slice(9).map(view)).toEqual(quiet.slice(9).map(view));
  });
});
