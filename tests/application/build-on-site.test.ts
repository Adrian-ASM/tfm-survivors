import { describe, expect, it } from 'vitest';
import { StartRun } from '../../src/application/StartRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { TICK_MS } from '../support/builders';
import { NEAR_ACCESS, aSiteConfig, declaredSites, withStock } from '../support/sites';

// Spec build-sites 0026, "Construcción en el solar" y "Salida de la obra sin construir", a través
// de los casos de uso `BuildOnSite` y `LeaveSite` (patrón de `BuyFromShop`/`LeaveShop`). La obra
// del solar de prueba se abre en el tick 1 (jugador a d = 10 del acceso).

function started(wood: number, stone = 0, gold = 0) {
  const r = new StartRun().execute(
    aSiteConfig(),
    new Mulberry32RandomGenerator(42),
    { player: NEAR_ACCESS, ...withStock(wood, stone, gold) },
    declaredSites([{ col: 20, row: 10 }]),
  );
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('BuildOnSite y LeaveSite', () => {
  it('Scenario: Construir una casa (madera 20, piedra 7 y oro 3)', () => {
    const { tickRun, buildOnSite } = started(20, 7, 3);
    const open = tickRun.execute(TICK_MS, PlayerInput.NONE);
    expect([open.status, open.tick]).toEqual(['building', 1]);

    const built = buildOnSite.execute('house');

    expect(built.ok && built.value.resources).toEqual({ gold: 3, wood: 5, stone: 7 });
    expect(built.ok && [built.value.status, built.value.tick, built.value.sites[0]?.state]).toEqual(
      ['running', 1, 'house'],
    );
  });

  it('un error tipado devuelve el error y no cambia el snapshot', () => {
    const { tickRun, buildOnSite } = started(30, 14);
    tickRun.execute(TICK_MS, PlayerInput.NONE);
    const before = tickRun.snapshot();

    expect(buildOnSite.execute('tower')).toEqual({
      ok: false,
      error: { code: 'not-affordable', kind: 'tower' },
    });
    expect(tickRun.snapshot()).toEqual(before);
  });

  it('sale y devuelve el snapshot en curso sin ejecutar ticks', () => {
    const { tickRun, leaveSite } = started(15);
    tickRun.execute(TICK_MS, PlayerInput.NONE);

    const left = leaveSite.execute();

    expect(left.ok && [left.value.status, left.value.tick, left.value.sites[0]?.armed]).toEqual([
      'running',
      1,
      false,
    ]);
  });

  it('Scenario: Salir fuera de la obra (en curso: not-building y sin cambios)', () => {
    const { tickRun, leaveSite, buildOnSite } = started(0);
    tickRun.execute(TICK_MS, PlayerInput.NONE);
    const before = tickRun.snapshot();

    expect(leaveSite.execute()).toEqual({ ok: false, error: { code: 'not-building' } });
    expect(buildOnSite.execute('house')).toEqual({ ok: false, error: { code: 'not-building' } });
    expect(tickRun.snapshot()).toEqual(before);
  });
});
