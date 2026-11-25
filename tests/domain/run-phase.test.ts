import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  CHOOSING,
  LOST,
  RUNNING,
  SHOPPING,
  WON,
  type RunOutcome,
  type RunPhase,
} from '../../src/domain/run/RunPhase';
import type { RunStatus } from '../../src/domain/run/RunStatus';

describe('RunPhase (spec run-outcome: Invariante entre estado y resultado, modelo)', () => {
  const phases: readonly RunPhase[] = [RUNNING, CHOOSING, SHOPPING, WON, LOST];

  it('las 5 fases están congeladas (en tienda desde 0024)', () => {
    expect(phases.every((p) => Object.isFrozen(p))).toBe(true);
  });

  it('Scenario: Invariante entre estado y resultado: resultado si y solo si over', () => {
    expect(phases.map((p) => [p.status, p.outcome])).toEqual([
      ['running', null],
      ['choosing', null],
      ['shopping', null],
      ['over', 'won'],
      ['over', 'lost'],
    ]);
  });

  it('el tipo impide over sin resultado y resultado sin over', () => {
    expectTypeOf<Extract<RunPhase, { status: 'over' }>['outcome']>().toEqualTypeOf<RunOutcome>();
    expectTypeOf<Extract<RunPhase, { status: 'running' }>['outcome']>().toEqualTypeOf<null>();
    expectTypeOf<Extract<RunPhase, { status: 'choosing' }>['outcome']>().toEqualTypeOf<null>();
    expectTypeOf<Extract<RunPhase, { status: 'shopping' }>['outcome']>().toEqualTypeOf<null>();
    expectTypeOf<RunStatus>().toEqualTypeOf<'running' | 'choosing' | 'shopping' | 'over'>();
  });
});
