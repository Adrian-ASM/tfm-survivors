import { describe, expect, it } from 'vitest';
import {
  BEHAVIOR_GUARD_NEEDS_PATROL,
  BEHAVIOR_LOSE_NOT_ABOVE_DETECT,
  BEHAVIOR_TARGET_UNKNOWN,
  BEHAVIOR_VALUE_MUST_BE_POSITIVE,
  Behavior,
} from '../../../src/domain/enemy/behavior/Behavior';
import type {
  BehaviorConfig,
  StateConfig,
} from '../../../src/domain/enemy/behavior/BehaviorConfig';

/** Comportamiento del `goblin-tnt-guard` del design §2.2. */
const GUARD: BehaviorConfig = {
  initial: 'patrol',
  states: [
    { name: 'patrol', kind: 'patrol', radius: 120, detect: { distance: 240, to: 'alert' } },
    {
      name: 'alert',
      kind: 'alert',
      exit: { distance: 100, to: 'aim' },
      lose: { distance: 360, to: 'return' },
    },
    {
      name: 'aim',
      kind: 'charge',
      ticks: 30,
      to: 'reload',
      dynamite: { flightTicks: 45, radius: 56, damage: 15 },
    },
    { name: 'reload', kind: 'wait', ticks: 90, to: 'alert' },
    { name: 'return', kind: 'return', detect: { distance: 240, to: 'alert' }, to: 'patrol' },
  ],
};

const PATH = 'enemies.types.3.behavior';

function failure(config: BehaviorConfig, typeId = 'goblin-tnt-guard') {
  const r = Behavior.create(config, typeId, PATH);
  if (r.ok) throw new Error('se esperaba un error');
  return r.error;
}

/** El comportamiento de guardia con el estado `i` cambiado. */
const withState = (i: number, state: unknown): BehaviorConfig => ({
  ...GUARD,
  states: GUARD.states.map((s, k) => (k === i ? (state as StateConfig) : s)),
});

describe('Behavior · clases de guardia (patrulla, alerta y vuelta)', () => {
  it('compila patrulla, alerta y vuelta a arrays por índice', () => {
    const r = Behavior.create(GUARD, 'goblin-tnt-guard', PATH);
    if (!r.ok) throw new Error(r.error.message);
    const b = r.value;
    expect(b.kinds).toEqual(['patrol', 'alert', 'charge', 'wait', 'return']);
    expect(b.initial).toBe(0);
    expect(b.patrolRadius).toEqual([120, 0, 0, 0, 0]);
    expect(b.detectDistSq).toEqual([240 * 240, -1, -1, -1, 240 * 240]);
    expect(b.detectTo).toEqual([1, -1, -1, -1, 1]);
    expect(b.exitDistSq).toEqual([-1, 100 * 100, -1, -1, -1]);
    expect(b.to).toEqual([-1, 2, 3, 1, -1]);
    expect(b.loseDistSq).toEqual([-1, 360 * 360, -1, -1, -1]);
    expect(b.loseTo).toEqual([-1, 4, -1, -1, -1]);
    expect(b.arriveTo).toEqual([-1, -1, -1, -1, 0]);
    expect(b.hasKind('patrol')).toBe(true);
    expect(Object.isFrozen(b.detectTo)).toBe(true);
  });

  it('los tipos sin estados de guardia no cambian', () => {
    const chase: BehaviorConfig = { initial: 'chase', states: [{ name: 'chase', kind: 'chase' }] };
    const r = Behavior.create(chase, 'goblin-torch', PATH);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.patrolRadius).toEqual([0]);
    expect(r.value.detectTo).toEqual([-1]);
  });

  it.each([
    ['radio de patrulla 0', 0, { ...GUARD.states[0], radius: 0 }, 'states.0.radius'],
    [
      'detección de la patrulla −1',
      0,
      { ...GUARD.states[0], detect: { distance: -1, to: 'alert' } },
      'states.0.detect.distance',
    ],
    [
      'abandono ausente',
      1,
      { ...GUARD.states[1], lose: { to: 'return' } },
      'states.1.lose.distance',
    ],
    [
      'lanzamiento 0',
      1,
      { ...GUARD.states[1], exit: { distance: 0, to: 'aim' } },
      'states.1.exit.distance',
    ],
    [
      'detección de la vuelta 0',
      4,
      { ...GUARD.states[4], detect: { distance: 0, to: 'alert' } },
      'states.4.detect.distance',
    ],
  ] as const)('Scenario: Parámetros de guardia inválidos (%s)', (_label, at, state, field) => {
    const e = failure(withState(at, state));
    expect(e.field).toBe(`${PATH}.${field}`);
    expect(e.message).toContain(BEHAVIOR_VALUE_MUST_BE_POSITIVE);
    expect(e.message).toContain('goblin-tnt-guard');
  });

  it('Scenario: Parámetros de guardia inválidos (abandono igual a la detección)', () => {
    const lose = { distance: 240, to: 'return' };
    const e = failure(withState(1, { ...GUARD.states[1], lose }));
    expect(e.field).toBe(`${PATH}.states.1.lose.distance`);
    expect(e.message).toContain(BEHAVIOR_LOSE_NOT_ABOVE_DETECT);
    expect(e.message).toContain('goblin-tnt-guard');
  });

  it('el abandono debe superar también la detección de la vuelta', () => {
    const detect = { distance: 400, to: 'alert' };
    const e = failure(withState(4, { ...GUARD.states[4], detect }));
    expect(e.field).toBe(`${PATH}.states.1.lose.distance`);
    expect(e.message).toContain(BEHAVIOR_LOSE_NOT_ABOVE_DETECT);
  });

  it.each([
    ['detección de la patrulla', 0, { ...GUARD.states[0], detect: { distance: 240, to: 'x' } }],
    ['pérdida de la alerta', 1, { ...GUARD.states[1], lose: { distance: 360, to: 'x' } }],
    ['llegada de la vuelta', 4, { ...GUARD.states[4], to: 'x' }],
  ] as const)('rechaza un destino inexistente en la %s', (_label, at, state) => {
    const e = failure(withState(at, state));
    expect(e.message).toContain(BEHAVIOR_TARGET_UNKNOWN);
    expect(e.message).toContain('goblin-tnt-guard');
  });

  it('Scenario: Estados de guardia sin patrulla inicial (guardia que empieza en alerta)', () => {
    const e = failure({ ...GUARD, initial: 'alert' });
    expect(e.field).toBe(`${PATH}.initial`);
    expect(e.message).toContain(BEHAVIOR_GUARD_NEEDS_PATROL);
    expect(e.message).toContain('goblin-tnt-guard');
  });

  it('Scenario: Estados de guardia sin patrulla inicial (goblin-torch con una vuelta)', () => {
    const torch: BehaviorConfig = {
      initial: 'chase',
      states: [
        { name: 'chase', kind: 'chase' },
        { name: 'back', kind: 'return', detect: { distance: 100, to: 'chase' }, to: 'chase' },
      ],
    };
    const e = failure(torch, 'goblin-torch');
    expect(e.field).toBe(`${PATH}.initial`);
    expect(e.message).toContain(BEHAVIOR_GUARD_NEEDS_PATROL);
    expect(e.message).toContain('goblin-torch');
  });
});
