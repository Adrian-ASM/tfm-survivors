import { describe, expect, it } from 'vitest';
import { StartRun } from '../../src/application/StartRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { TICK_MS, aStillType, withStoneChance, withWeapons } from '../support/builders';
import { CountingRandom, StubRandom } from '../support/random';
import { aBehaviorConfig } from '../support/runs';
import { aLinter, weaponsOf } from '../support/weapons';

// Spec resources (0025): StartRun pasa el azar de la piedra a la partida; sin él (escenarios), las
// bajas no sueltan piedra ni consumen nada.
const TORCH = aStillType({ id: 'goblin-torch', health: 4, xp: 1 });
const CONFIG: RunConfig = withStoneChance(
  withWeapons(aBehaviorConfig([TORCH]), weaponsOf([aLinter()])),
  { 'goblin-torch': 100 },
);
const SETUP = {
  player: { x: 1000, y: 1000 },
  enemies: [{ type: 'goblin-torch', x: 1200, y: 1000 }],
};

function play(stoneRandom?: RandomGenerator) {
  const r = new StartRun().execute(
    CONFIG,
    new Mulberry32RandomGenerator(42),
    SETUP,
    undefined,
    stoneRandom,
  );
  if (!r.ok) throw new Error(r.error.message);
  for (let i = 0; i < 120; i++) r.value.tickRun.execute(TICK_MS, PlayerInput.NONE);
  return r.value.tickRun.snapshot();
}

describe('StartRun con el azar de la piedra (resources 0025)', () => {
  it('con stoneRandom la baja tira 1 valor y suelta su piedra', () => {
    const stones = new CountingRandom(new StubRandom(0));
    const s = play(stones);

    expect(s.kills).toBe(1);
    expect(s.pickups.map((p) => p.kind)).toEqual(['xp', 'stone']);
    expect(stones.calls).toBe(1);
  });

  it('sin stoneRandom la misma baja no suelta piedra', () => {
    const s = play();

    expect(s.kills).toBe(1);
    expect(s.pickups.map((p) => p.kind)).toEqual(['xp']);
  });
});
