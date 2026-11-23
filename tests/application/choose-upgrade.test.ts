import { describe, expect, it } from 'vitest';
import { StartRun } from '../../src/application/StartRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { aDefaultConfig, aSegment, aWavesConfig, TICK_MS } from '../support/builders';
import { CountingRandom, StubRandom } from '../support/random';

/** Contenido por defecto sin spawns: el jugador del centro recoge en el tick 1 una gema de 1 XP. */
function started(random = new CountingRandom(new StubRandom(0.5))) {
  const base = aDefaultConfig();
  const config: RunConfig = {
    ...base,
    waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves,
  };
  const r = new StartRun().execute(config, random, {
    gems: [{ x: base.arena.width / 2 + 20, y: base.arena.height / 2, value: 1 }],
    experience: { level: 1, xp: 4 },
  });
  if (!r.ok) throw new Error(r.error.message);
  return { ...r.value, random };
}

describe('ChooseUpgrade', () => {
  it('Scenario: Elección válida (devuelve el snapshot en curso con la mejora en nivel 1)', () => {
    const { tickRun, chooseUpgrade } = started();
    const offer = tickRun.execute(TICK_MS, PlayerInput.NONE).offer;
    expect(offer).toHaveLength(3);
    const r = chooseUpgrade.execute(1);
    if (!r.ok) throw new Error(r.error.code);
    expect(r.value.status).toBe('running');
    expect(r.value.upgrades).toEqual([{ id: offer[1]?.id, level: 1 }]);
    expect(tickRun.snapshot()).toStrictEqual(r.value);
  });

  it.each([3, -1, 1.5])(
    'Scenario: Índice fuera de rango (%s: error, snapshot y azar intactos)',
    (i) => {
      const { tickRun, chooseUpgrade, random } = started();
      const before = tickRun.execute(TICK_MS, PlayerInput.NONE);
      const calls = random.calls;
      expect(chooseUpgrade.execute(i)).toEqual({
        ok: false,
        error: { code: 'choice-out-of-range', index: i, size: 3 },
      });
      expect(tickRun.snapshot()).toStrictEqual(before);
      expect(random.calls).toBe(calls);
      expect(chooseUpgrade.execute(0).ok).toBe(true);
    },
  );

  it('Scenario: Sin oferta abierta (no-offer)', () => {
    const { chooseUpgrade } = started();
    expect(chooseUpgrade.execute(0)).toEqual({ ok: false, error: { code: 'no-offer' } });
  });
});
