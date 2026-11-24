import { describe, expect, it } from 'vitest';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import {
  SETUP_DYNAMITE_BLAST_MUST_BE_POSITIVE,
  SETUP_DYNAMITE_TICKS_LEFT,
  SETUP_ELAPSED_OUT_OF_RANGE,
  SETUP_POSITION_MUST_BE_FINITE,
  SETUP_STATE_UNKNOWN,
  SETUP_TOO_MANY_DYNAMITES,
} from '../../src/domain/run/RunSetup';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aBarrelType, aDynamite, aTntType, inState } from '../support/builders';
import { aBehaviorConfig, ticks } from '../support/runs';

const config = aBehaviorConfig([aBarrelType(), aTntType()], { hazards: { maxDynamites: 2 } });
const PLAYER = { x: 1000, y: 1000 };

function failure(setup: RunSetup) {
  const r = Run.start(config, new Mulberry32RandomGenerator(1), { player: PLAYER, ...setup });
  if (r.ok) throw new Error('se esperaba un error de setup');
  return r.error;
}

const barrelAt = (extra: object) => ({ type: 'goblin-barrel', x: 1500, y: 1000, ...extra });

describe('RunSetup · estado de comportamiento y dinamitas (0020)', () => {
  it('rechaza un estado que el tipo no declara', () => {
    const e = failure({ enemies: [barrelAt(inState('aim'))] });
    expect(e).toMatchObject({ field: 'setup.enemies.0.state', message: SETUP_STATE_UNKNOWN });
  });

  it.each([-1, 30, 2.5])('rechaza elapsed %s fuera de [0, ticks)', (elapsed) => {
    const e = failure({ enemies: [barrelAt(inState('fuse', elapsed))] });
    expect(e).toMatchObject({
      field: 'setup.enemies.0.elapsed',
      message: SETUP_ELAPSED_OUT_OF_RANGE,
    });
  });

  it('rechaza más dinamitas que el tope', () => {
    const d = aDynamite(PLAYER, 10);
    const e = failure({ dynamites: [d, d, d] });
    expect(e).toMatchObject({ field: 'setup.dynamites', message: SETUP_TOO_MANY_DYNAMITES });
  });

  it.each([0, 1.5])('rechaza una dinamita con %s ticks restantes', (ticksLeft) => {
    const e = failure({ dynamites: [aDynamite(PLAYER, ticksLeft)] });
    expect(e).toMatchObject({
      field: 'setup.dynamites.0.ticksLeft',
      message: SETUP_DYNAMITE_TICKS_LEFT,
    });
  });

  it.each([
    { x: Number.NaN, y: 0 },
    { x: 0, y: Number.POSITIVE_INFINITY },
  ])('rechaza una dinamita con un punto no finito (%o)', (target) => {
    const e = failure({ dynamites: [aDynamite(target, 5)] });
    expect(e).toMatchObject({ field: 'setup.dynamites.0', message: SETUP_POSITION_MUST_BE_FINITE });
  });

  it('rechaza una dinamita con radio o daño no positivos', () => {
    const e = failure({ dynamites: [aDynamite(PLAYER, 5, { radius: 0 })] });
    expect(e.message).toBe(SETUP_DYNAMITE_BLAST_MUST_BE_POSITIVE);
  });

  it('arranca en mecha o en carga con el tiempo ya pasado', () => {
    const run = Run.start(config, new Mulberry32RandomGenerator(1), {
      player: PLAYER,
      enemies: [
        barrelAt(inState('fuse', 29)),
        { type: 'goblin-tnt', x: 500, y: 500, ...inState('aim', 3) },
      ],
      dynamites: [aDynamite(PLAYER, 5)],
    });
    if (!run.ok) throw new Error(run.error.message);
    const s0 = run.value.snapshot();
    expect(s0.enemies.map((e) => e.stateKind)).toEqual(['fuse', 'charge']);
    const [s1] = ticks(run.value, 1);
    // La mecha de 30 ticks con 29 ya pasados explota en el tick 1; la carga sigue quieta.
    expect(s1?.enemies.map((e) => [e.type, e.x, e.y])).toEqual([['goblin-tnt', 500, 500]]);
    expect(s1?.blasts.map((b) => b.tick)).toEqual([1]);
  });
});
