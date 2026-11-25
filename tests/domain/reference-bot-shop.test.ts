import { describe, expect, it } from 'vitest';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { aDefaultConfig, withExtraTypes, withShop } from '../support/builders';
import {
  REFERENCE_HEAL_THRESHOLD,
  REFERENCE_SHOP_ORDER,
  SHOP_DANGER_RANGE,
  referenceBot,
} from '../support/policies';
import { aProbeType, visitShop } from '../support/runs';
import { SHOP_DOOR, startAtDoor, untilShopping } from '../support/shop';

// Spec run-outcome (0024), "Bot de referencia para el balance" (v4): ida a la tienda y compras.
// Mapa vacío con puerta declarada en (1.000, 1.000), contenido por defecto (radio 16, 215 px/s).

const direction = (s: RunSnapshot) => {
  const bot = referenceBot(aDefaultConfig(), startAtDoor(aDefaultConfig()).map);
  const { x, y } = bot.input(s).direction;
  return { x, y };
};

/** Snapshot con la tienda armada, el jugador en (1.400, 1.000) y el oro y el resto dados. */
function at(gold: number, setup: RunSetup = {}) {
  const config = withExtraTypes(aDefaultConfig(), aProbeType({ speed: 1e-6, health: 1e6 }));
  const run = startAtDoor(config, {
    player: { x: 1400, y: 1000 },
    resources: { gold, wood: 0 },
    ...setup,
  });
  return run.snapshot();
}

const cheapest = (s: RunSnapshot) =>
  Math.min(...s.shop.products.flatMap((p) => (p.kind === 'upgrade' && p.price ? [p.price] : [])));

describe('Bot v4: ida a la tienda (run-outcome 0024)', () => {
  it('Scenario: Va a la tienda con oro y sin peligro (input (−1, 0))', () => {
    const price = cheapest(at(0));

    expect(direction(at(price))).toEqual({ x: -1, y: 0 });
  });

  it('Scenario: Sin oro suficiente no va (precio − 1 y vida llena: (0, 0))', () => {
    const price = cheapest(at(0));

    expect(direction(at(price - 1))).toEqual({ x: 0, y: 0 });
  });

  it('Scenario: El peligro gana a la tienda (enemigo a 100 px: huye, (1, 0))', () => {
    const price = cheapest(at(0));
    const s = at(price, { enemies: [{ type: 'probe', x: 1300, y: 1000 }] });

    expect(SHOP_DANGER_RANGE).toBeGreaterThan(100);
    expect(direction(s)).toEqual({ x: 1, y: 0 });
  });

  it('sin la tienda armada no va (huye o queda quieto)', () => {
    const price = cheapest(at(0));

    expect(direction(at(price, { shop: { armed: false } }))).toEqual({ x: 0, y: 0 });
  });
});

/** Bot v4 con la tienda abierta (tick 1) y el oro y la vida dados; devuelve compras y snapshot. */
function shopWith(gold: number, health = 100, healPrice?: number) {
  const base = aDefaultConfig();
  const config = healPrice === undefined ? base : withShop(base, {}, { price: healPrice });
  const run = startAtDoor(config, {
    player: { ...SHOP_DOOR, health },
    resources: { gold, wood: 0 },
  });
  untilShopping(run, 1);
  const bot = referenceBot(config, run.map);
  const bought = visitShop(run, bot);
  return { bought, after: run.snapshot() };
}

describe('Bot v4: compras (run-outcome 0024)', () => {
  const first = REFERENCE_SHOP_ORDER[0] ?? '';
  const firstPrice = () => {
    const p = at(0).shop.products.find((x) => x.id === first);
    return p?.price ?? 0;
  };

  it('Scenario: Orden de compra (bajo el umbral: solo la curación; por encima: solo la mejora)', () => {
    const price = firstPrice();
    // Curación al mismo precio que la mejora: oro para una de las dos, no para ambas.
    const low = shopWith(price, Math.floor(REFERENCE_HEAL_THRESHOLD * 100) - 1, price);
    const high = shopWith(price, 100, price);

    expect(low.bought).toEqual(['heal']);
    expect(high.bought).toEqual([first]);
    expect([low.after.status, high.after.status]).toEqual(['running', 'running']);
  });

  it('Scenario: Compra hasta agotar el oro (oro para 3 compras seguidas: 3 compras y sale)', () => {
    // Las tres primeras compras del orden con la vida llena: nivel 1 de las dos primeras mejoras y
    // nivel 2 de la primera (más caro), según los precios del contenido.
    const s0 = at(0).shop.products;
    const price = (id: string, level = 0) =>
      at(0, { upgrades: { [id]: level } }).shop.products.find((p) => p.id === id)?.price ?? 0;
    const [a = '', b = ''] = REFERENCE_SHOP_ORDER;
    const gold = price(a) + price(a, 1) + price(b);
    const { bought, after } = shopWith(gold);
    const remaining = after.shop.products.flatMap((p) =>
      p.kind === 'upgrade' && p.price !== null ? [p.price] : [],
    );

    expect(s0.length).toBe(7);
    expect(bought).toHaveLength(3);
    expect(after.status).toBe('running');
    expect(after.resources.gold).toBeLessThan(Math.min(...remaining));
  });
});
