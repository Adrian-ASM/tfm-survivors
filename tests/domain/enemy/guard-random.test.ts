import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../../src/domain/player/PlayerInput';
import type { RunSetup } from '../../../src/domain/run/Run';
import { Mulberry32RandomGenerator } from '../../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aBarrelType, aStillType, aTntType, inState } from '../../support/builders';
import { aCampScenario, aGuardAt, startDeclared } from '../../support/camps';

const P = { x: 1000, y: 1000 };
type Enemies = NonNullable<RunSetup['enemies']>;

/** Guardias que en el tick 1 entran en alerta, en vuelta, en patrulla o siguen patrullando. */
const GUARDS: Enemies = [
  aGuardAt(1000, 1150, { post: { x: 1000, y: 1150 } }),
  aGuardAt(1500, 1000, { post: { x: 1500, y: 1000 }, ...inState('alert') }),
  aGuardAt(2001, 1500, { post: { x: 2000, y: 1500 }, ...inState('return') }),
  aGuardAt(2500, 1500, { post: { x: 2500, y: 1500 } }),
  aGuardAt(1100, 1000, { post: { x: 2000, y: 1000 }, ...inState('return') }),
];

const config = aCampScenario({ types: [aStillType(), aBarrelType(), aTntType()] });

/** Valor siguiente del azar de la partida tras el tick 1 y los estados antes y después. */
function afterTick(enemies: Enemies) {
  const random = new Mulberry32RandomGenerator(7);
  const run = startDeclared(config, [], { player: P, enemies }, random);
  const before = run.snapshot().enemies.map((e) => e.state);
  run.tick(PlayerInput.NONE);
  const after = run.snapshot().enemies.map((e) => e.state);
  return { next: random.next(), before, after };
}

const stills = (n: number): Enemies =>
  Array.from({ length: n }, (_, i) => ({ type: 'still', x: 3000, y: 200 + 100 * i }));

describe('Azar de los estados de guardia (enemy-behavior, simulation-loop)', () => {
  it('Scenario: Los estados de guardia no consumen azar', () => {
    const guards = afterTick(GUARDS);
    const quiet = afterTick(stills(5));
    expect(guards.after).toEqual(['alert', 'return', 'patrol', 'patrol', 'alert']);
    expect(guards.next).toBe(quiet.next);
  });

  it('Scenario: Los comportamientos no consumen azar (con alerta, vuelta y patrulla)', () => {
    const changing: Enemies = [
      ...GUARDS,
      { type: 'goblin-barrel', x: 1030, y: 1000 },
      { type: 'goblin-barrel', x: 1000, y: 1035 },
      { type: 'goblin-tnt', x: 1150, y: 900 },
      { type: 'goblin-tnt', x: 850, y: 1000 },
      { type: 'goblin-tnt', x: 1700, y: 1700, ...inState('reload', 59) },
    ];
    const moving = afterTick(changing);
    const quiet = afterTick(stills(10));
    const changed = moving.after.filter((s, i) => s !== moving.before[i]);
    expect(changed).toHaveLength(9);
    expect(moving.next).toBe(quiet.next);
  });
});
