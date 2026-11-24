import { describe, expect, it } from 'vitest';
import {
  BEHAVIOR_INITIAL_UNKNOWN,
  BEHAVIOR_KIND_UNKNOWN,
  BEHAVIOR_STATE_REPEATED,
  BEHAVIOR_TARGET_UNKNOWN,
  BEHAVIOR_TICKS_MUST_BE_INTEGER,
  BEHAVIOR_VALUE_MUST_BE_POSITIVE,
  Behavior,
} from '../../../src/domain/enemy/behavior/Behavior';
import type { BehaviorConfig } from '../../../src/domain/enemy/behavior/BehaviorConfig';

const TNT: BehaviorConfig = {
  initial: 'approach',
  states: [
    { name: 'approach', kind: 'chase', exit: { distance: 260, to: 'aim' } },
    {
      name: 'aim',
      kind: 'charge',
      ticks: 30,
      to: 'reload',
      dynamite: { flightTicks: 45, radius: 56, damage: 15 },
    },
    { name: 'reload', kind: 'wait', ticks: 90, to: 'approach' },
  ],
};

const BARREL: BehaviorConfig = {
  initial: 'approach',
  states: [
    { name: 'approach', kind: 'chase', exit: { distance: 40, to: 'fuse' } },
    { name: 'fuse', kind: 'fuse', ticks: 40, radius: 64, damage: 20 },
  ],
};

const CHASE_ONLY: BehaviorConfig = {
  initial: 'chase',
  states: [{ name: 'chase', kind: 'chase' }],
};

function created(config: BehaviorConfig, typeId = 'goblin-tnt'): Behavior {
  const r = Behavior.create(config, typeId, 'enemies.types.1.behavior');
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

function failure(config: BehaviorConfig, typeId = 'goblin-tnt') {
  const r = Behavior.create(config, typeId, 'enemies.types.1.behavior');
  if (r.ok) throw new Error('se esperaba un error');
  return r.error;
}

describe('Behavior (compilado del contenido)', () => {
  it('compila las cuatro clases a arrays por índice con el estado inicial', () => {
    const b = created(TNT);
    expect(b.initial).toBe(0);
    expect(b.names).toEqual(['approach', 'aim', 'reload']);
    expect(b.kinds).toEqual(['chase', 'charge', 'wait']);
    expect(b.ticks).toEqual([0, 30, 90]);
    expect(b.to).toEqual([1, 2, 0]);
    expect(b.exitDistSq).toEqual([260 * 260, -1, -1]);
    expect(b.blastRadius).toEqual([0, 56, 0]);
    expect(b.blastDamage).toEqual([0, 15, 0]);
    expect(b.flightTicks).toEqual([0, 45, 0]);
  });

  it('la mecha guarda su radio y daño y no tiene destino', () => {
    const b = created(BARREL, 'goblin-barrel');
    expect(b.kinds).toEqual(['chase', 'fuse']);
    expect(b.to).toEqual([1, -1]);
    expect(b.ticks).toEqual([0, 40]);
    expect(b.blastRadius).toEqual([0, 64]);
    expect(b.blastDamage).toEqual([0, 20]);
    expect(b.hasKind('fuse')).toBe(true);
    expect(b.hasKind('charge')).toBe(false);
  });

  it('una persecución sin salida no tiene distancia ni destino', () => {
    const b = created(CHASE_ONLY, 'goblin-torch');
    expect(b.exitDistSq).toEqual([-1]);
    expect(b.to).toEqual([-1]);
  });

  it('es inmutable', () => {
    const b = created(TNT);
    expect(Object.isFrozen(b)).toBe(true);
    expect(Object.isFrozen(b.kinds)).toBe(true);
  });

  it('Scenario: Destino inexistente', () => {
    const states = TNT.states.map((s) =>
      s.kind === 'chase' ? { ...s, exit: { distance: 260, to: 'hide' } } : s,
    );
    const e = failure({ ...TNT, states });
    expect(e.field).toBe('enemies.types.1.behavior.states.0.exit.to');
    expect(e.message).toContain(BEHAVIOR_TARGET_UNKNOWN);
    expect(e.message).toContain('goblin-tnt');
    expect(e.message).toContain('hide');
  });

  it('Scenario: Destino inexistente (carga y espera)', () => {
    const states = TNT.states.map((s) => (s.kind === 'wait' ? { ...s, to: 'nowhere' } : s));
    const e = failure({ ...TNT, states });
    expect(e.field).toBe('enemies.types.1.behavior.states.2.to');
    expect(e.message).toContain('nowhere');
  });

  it('Scenario: Estado inicial ausente o inexistente (inexistente)', () => {
    const e = failure({ ...CHASE_ONLY, initial: 'sleep' }, 'goblin-torch');
    expect(e.field).toBe('enemies.types.1.behavior.initial');
    expect(e.message).toContain(BEHAVIOR_INITIAL_UNKNOWN);
    expect(e.message).toContain('goblin-torch');
    expect(e.message).toContain('sleep');
  });

  it('Scenario: Nombre de estado repetido', () => {
    const states = [...TNT.states, { name: 'aim', kind: 'wait' as const, ticks: 5, to: 'aim' }];
    const e = failure({ ...TNT, states });
    expect(e.field).toBe('enemies.types.1.behavior.states.3.name');
    expect(e.message).toContain(BEHAVIOR_STATE_REPEATED);
    expect(e.message).toContain('goblin-tnt');
    expect(e.message).toContain('aim');
  });

  it('rechaza una clase fuera del catálogo (defensa sin zod)', () => {
    const states = [{ name: 'x', kind: 'teleport' }] as unknown as BehaviorConfig['states'];
    const e = failure({ initial: 'x', states }, 'goblin-barrel');
    expect(e.field).toBe('enemies.types.1.behavior.states.0.kind');
    expect(e.message).toContain(BEHAVIOR_KIND_UNKNOWN);
    expect(e.message).toContain('teleport');
  });

  it.each([
    ['states.0.exit.distance', { ...BARREL.states[0], exit: { distance: 0, to: 'fuse' } }, 0],
    ['states.1.radius', { ...BARREL.states[1], radius: 0 }, 1],
    ['states.1.damage', { ...BARREL.states[1], damage: -5 }, 1],
  ] as const)('rechaza un valor no positivo en %s', (field, state, at) => {
    const states = BARREL.states.map((s, i) => (i === at ? state : s));
    const e = failure({ ...BARREL, states } as BehaviorConfig, 'goblin-barrel');
    expect(e.field).toBe(`enemies.types.1.behavior.${field}`);
    expect(e.message).toContain(BEHAVIOR_VALUE_MUST_BE_POSITIVE);
    expect(e.message).toContain('goblin-barrel');
  });

  it.each([0, -3, 2.5])('rechaza una duración de mecha %s', (ticks) => {
    const states = BARREL.states.map((s) => (s.kind === 'fuse' ? { ...s, ticks } : s));
    const e = failure({ ...BARREL, states }, 'goblin-barrel');
    expect(e.field).toBe('enemies.types.1.behavior.states.1.ticks');
    expect(e.message).toContain(BEHAVIOR_TICKS_MUST_BE_INTEGER);
  });

  it('rechaza un vuelo de dinamita de 0 ticks', () => {
    const states = TNT.states.map((s) =>
      s.kind === 'charge' ? { ...s, dynamite: { ...s.dynamite, flightTicks: 0 } } : s,
    );
    const e = failure({ ...TNT, states });
    expect(e.field).toBe('enemies.types.1.behavior.states.1.dynamite.flightTicks');
  });

  it('acepta duraciones de 1 tick', () => {
    const states = TNT.states.map((s) =>
      s.kind === 'chase'
        ? s
        : {
            ...s,
            ticks: 1,
            ...(s.kind === 'charge' ? { dynamite: { ...s.dynamite, flightTicks: 1 } } : {}),
          },
    );
    expect(Behavior.create({ ...TNT, states }, 'goblin-tnt', 'p').ok).toBe(true);
  });
});
