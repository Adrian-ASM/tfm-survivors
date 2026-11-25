import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from '../../src/application/FixedStepLoop';
import { StartRun } from '../../src/application/StartRun';
import { TickRun } from '../../src/application/TickRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import {
  DEFAULT_WEAPONS,
  DEFAULT_WEAPON_UPGRADES,
  TICK_MS,
  withWeapons,
} from '../support/builders';
import { aBehaviorConfig, aProbeType } from '../support/runs';
import { INSIDE_DOOR, SHOP_DOOR, startAtDoor, withScenarioDoor } from '../support/shop';

/** Mapa vacío, armas y catálogo de arma por defecto, sin oleadas. */
const shopContent = (): RunConfig => ({
  ...withWeapons(aBehaviorConfig([aProbeType()]), DEFAULT_WEAPONS),
  upgrades: { character: [], weapons: DEFAULT_WEAPON_UPGRADES },
});

// Spec castle-shop (0024), casos de uso de comprar y salir; simulation-loop "Sin tiempo acumulado
// en la tienda". La tienda se abre en el tick 1 (jugador dentro del radio, puerta armada).

function started(gold = 0) {
  const r = new StartRun().execute(
    withScenarioDoor(shopContent()),
    new Mulberry32RandomGenerator(42),
    { player: INSIDE_DOOR, shop: { armed: true }, resources: { gold, wood: 0 } },
    { kind: 'open', door: SHOP_DOOR },
  );
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('BuyFromShop y LeaveShop', () => {
  it('compra y devuelve el snapshot en tienda; un error tipado no cambia nada', () => {
    const { tickRun, buyFromShop } = started(30);
    expect(tickRun.execute(TICK_MS, PlayerInput.NONE).status).toBe('shopping');

    const bought = buyFromShop.execute('strict-rules');
    const before = tickRun.snapshot();
    const refused = buyFromShop.execute('refactor');

    expect(bought.ok && [bought.value.status, bought.value.resources.gold]).toEqual([
      'shopping',
      20,
    ]);
    expect(refused).toEqual({ ok: false, error: { code: 'unknown-product', id: 'refactor' } });
    expect(tickRun.snapshot()).toEqual(before);
  });

  it('sale y devuelve el snapshot en curso; fuera de la tienda, not-shopping', () => {
    const { tickRun, leaveShop } = started();
    tickRun.execute(TICK_MS, PlayerInput.NONE);

    const left = leaveShop.execute();

    expect(left.ok && [left.value.status, left.value.tick]).toEqual(['running', 1]);
    expect(leaveShop.execute()).toEqual({ ok: false, error: { code: 'not-shopping' } });
  });
});

describe('Sin tiempo acumulado en la tienda (simulation-loop 0024)', () => {
  it('Scenario: Frames en la tienda (600 frames: 0 ticks; tras salir, 1 frame = 1 tick)', () => {
    const { tickRun, leaveShop } = started();
    const n = tickRun.execute(TICK_MS, PlayerInput.NONE).tick;
    const during = Array.from({ length: 600 }, () => tickRun.execute(TICK_MS, PlayerInput.NONE));
    leaveShop.execute();
    const after = tickRun.execute(TICK_MS, PlayerInput.NONE);

    expect(during.every((s) => s.tick === n && s.status === 'shopping')).toBe(true);
    expect(after.tick).toBe(n + 1);
  });

  it('Scenario: Tienda a mitad de frame (50 ms = 3 ticks: se ejecuta 1 y el acumulador queda a 0)', () => {
    const loop = new FixedStepLoop();
    const run = new TickRun(startAtDoor(shopContent()), loop);

    const s = run.execute(50, PlayerInput.NONE);

    expect([s.tick, s.status, loop.accumulatedMs]).toEqual([1, 'shopping', 0]);
  });
});
