import { describe, expect, it } from 'vitest';
import { seededRun } from '../../src/composition/seedSource';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { aDefaultConfig, withPlayer, withShop } from '../support/builders';
import { CountingRandom } from '../support/random';

// Spec simulation-loop (0024): "La política de tienda fija no cambia la partida" y "Partida con
// tienda y compras reproducible". Semilla 42 con su mapa generado (puerta en (1.950, 1.170)).

const SEED = 42;
const DOWN = PlayerInput.of(0, 1);
const UP = PlayerInput.of(0, -1);
/** 100 ticks hacia abajo (≈ 358 px, más que el re-armado) y 100 de vuelta, en bucle. */
const awayAndBack = (t: number) => (t % 200 < 100 ? DOWN : UP);

function start(config: RunConfig) {
  const { random, terrain } = seededRun(SEED);
  const counted = new CountingRandom(random);
  const r = Run.start(config, counted, {}, terrain);
  if (!r.ok) throw new Error(r.error.message);
  return { run: r.value, random: counted };
}

/** Lo que la política de tienda fija no puede cambiar (todo salvo la fase y la puerta). */
const play = (s: RunSnapshot) => {
  const { enemies, player, sheep, pickups, resources, progression, offer, upgrades } = s;
  return { enemies, player, sheep, pickups, resources, progression, offer, upgrades };
};

describe('Tienda y determinismo (simulation-loop 0024)', () => {
  it('Scenario: La política de tienda fija no cambia la partida (3.600 ticks, ≥ 2 visitas)', () => {
    const config = withPlayer(aDefaultConfig(), { maxHealth: 1e9 });
    const a = start(config);
    // "Sin puerta": un re-armado inalcanzable; la tienda no se abre nunca.
    const b = start(withShop(config, { rearmDistance: 1e9 }));
    let visits = 0;
    for (let t = 0; t < 3600; t++) {
      for (const { run } of [a, b]) {
        while (run.status === 'choosing') run.chooseUpgrade(0);
        if (run.status === 'shopping') {
          if (run === a.run) visits++;
          run.leaveShop();
        }
        run.tick(awayAndBack(t));
      }
      expect(play(a.run.snapshot())).toEqual(play(b.run.snapshot()));
      expect(a.random.calls).toBe(b.random.calls);
    }

    expect(visits).toBeGreaterThanOrEqual(2);
  });

  it('Scenario: Partida con tienda y compras reproducible (vida 1.000; misma 1.ª compra)', () => {
    const trace = () => {
      const { run } = start(withPlayer(aDefaultConfig(), { maxHealth: 1000 }));
      const snaps: RunSnapshot[] = [];
      let first: { tick: number; gold: number } | null = null;
      for (let t = 0; t < 14_400 && run.status !== 'over'; t++) {
        while (run.status === 'choosing') run.chooseUpgrade(0);
        if (run.status === 'shopping') {
          const products = run.snapshot().shop.products;
          for (const p of products) {
            if (run.buy(p.id).ok && !first)
              first = { tick: run.snapshot().tick, gold: run.snapshot().resources.gold };
          }
          snaps.push(run.snapshot());
          run.leaveShop();
        }
        run.tick(awayAndBack(t));
        snaps.push(run.snapshot());
        if (first && snaps.length > 0 && run.snapshot().tick >= first.tick + 600) break;
      }
      return { snaps, first };
    };
    const a = trace();
    const b = trace();

    expect(a.first).not.toBeNull();
    expect(b.first).toEqual(a.first);
    expect(b.snaps).toEqual(a.snaps);
  }, 60_000);
});
