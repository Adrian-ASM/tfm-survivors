import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { Run, RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { UpgradeTypeConfig } from '../../src/domain/upgrade/UpgradeType';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  DEFAULT_WEAPONS,
  anUpgrade,
  DEFAULT_WEAPON_UPGRADES,
  aBarrelType,
  aDynamite,
  aStillType,
  inState,
  withDuration,
  withShop,
  withWeapons,
} from '../support/builders';
import { CountingRandom } from '../support/random';
import { aBehaviorConfig, ticks } from '../support/runs';
import { weaponsOf } from '../support/weapons';
import { LINTER, TESTS } from '../support/builders';
import { INSIDE_DOOR, SHOP_DOOR, buyAll, startAtDoor, untilShopping } from '../support/shop';

// Spec castle-shop (0024), "Compra en la tienda" y "Salida de la tienda"; player-health "Curación de
// pago"; upgrades "Efectos de las mejoras"; run-state "Simulación congelada en la tienda". Mapa
// vacío con la puerta en (1.000, 1.000); precios de escenario 10, 15, 20, 25, 30 en las 6 mejoras
// de arma y curación de 25 por 10 de oro.

const PRICES = [10, 15, 20, 25, 30];
const LEFT = PlayerInput.of(-1, 0);

/** Contenido de escenario: armas por defecto, solo el catálogo de arma, jugador a 60 px/s. */
function shopConfig(o: { weapons?: RunConfig['weapons']; maxHealth?: number } = {}): RunConfig {
  const types = [
    aStillType({ id: 'hitter', damage: 10 }),
    aStillType({ id: 'dummy', health: 1000 }),
    aBarrelType(),
  ];
  const base = withWeapons(
    aBehaviorConfig(types, { player: { speed: 60, maxHealth: o.maxHealth ?? 100 } }),
    o.weapons ?? DEFAULT_WEAPONS,
  );
  const weapons = DEFAULT_WEAPON_UPGRADES.filter((u) =>
    (o.weapons ?? DEFAULT_WEAPONS).weapons.some(
      (w) => u.target.kind === 'weapon' && w.id === u.target.weapon,
    ),
  ).map((u): UpgradeTypeConfig => ({ ...u, prices: PRICES }));
  return withShop({ ...base, upgrades: { character: [], weapons } }, {}, { amount: 25, price: 10 });
}

/** En tienda en el tick 1 con el oro (y el resto del `RunSetup`) dado. */
function shopping(gold: number, setup: RunSetup = {}, config = shopConfig()): Run {
  const run = startAtDoor(config, { resources: { gold, wood: 0 }, ...setup });
  untilShopping(run, 1);
  return run;
}

const product = (s: RunSnapshot, id: string) => s.shop.products.find((p) => p.id === id);
/** Ticks (desde 1) en que aparece un proyectil nuevo. */
const launches = (snaps: readonly RunSnapshot[]) => {
  const seen = new Set<number>();
  return snaps.flatMap((s) => {
    const fresh = s.projectiles.filter((p) => !seen.has(p.id));
    for (const p of fresh) seen.add(p.id);
    return fresh.length > 0 ? [s.tick] : [];
  });
};

describe('Compra en la tienda (castle-shop 0024)', () => {
  it('Scenario: Compra de una mejora de arma (oro 30 → 20, nivel 1, precio 15; Linter 9)', () => {
    const run = shopping(30, { enemies: [{ type: 'dummy', x: 1339, y: 1000 }] });
    const r = run.buy('strict-rules');
    const s = run.snapshot();

    expect(r.ok).toBe(true);
    expect([s.resources.gold, s.status, s.shop.gold]).toEqual([20, 'shopping', 20]);
    expect(product(s, 'strict-rules')).toMatchObject({ level: 1, price: 15 });
    expect(s.upgrades).toEqual([{ id: 'strict-rules', level: 1 }]);
    expect(run.leaveShop().ok).toBe(true);
    const lives = [...new Set(ticks(run, 120).map((x) => x.enemies[0]?.health ?? 0))];
    // El proyectil del tick 1 (en vuelo) conserva su daño 6; los siguientes hacen 9.
    expect(lives.slice(0, 4)).toEqual([1000, 1000 - 6, 1000 - 15, 1000 - 24]);
  });

  it('Scenario: Varias compras en una visita (5 de oro y nivel 2; fast-ci sin oro)', () => {
    const run = shopping(30);
    buyAll(run, ['strict-rules', 'strict-rules']);
    const before = run.snapshot();
    const third = run.buy('fast-ci');

    expect(before.resources.gold).toBe(5);
    expect(product(before, 'strict-rules')).toMatchObject({ level: 2 });
    expect(third).toEqual({ ok: false, error: { code: 'not-enough-gold', price: 10, gold: 5 } });
    expect(run.snapshot()).toEqual(before);
  });

  it('Scenario: Oro exacto (oro 10 y coverage a 10: oro 0 y nivel 1)', () => {
    const s = buyAll(shopping(10), ['coverage']);

    expect(s.resources.gold).toBe(0);
    expect(product(s, 'coverage')).toMatchObject({ level: 1 });
  });

  it('Scenario: Compras rechazadas (nivel máximo, producto desconocido y vida llena)', () => {
    const random = new CountingRandom(new Mulberry32RandomGenerator(42));
    const run = startAtDoor(
      shopConfig(),
      {
        resources: { gold: 1000, wood: 0 },
        upgrades: { 'fast-ci': 5 },
      },
      random,
    );
    untilShopping(run, 1);
    const before = run.snapshot();
    const calls = random.calls;
    const errors = ['fast-ci', 'refactor', 'heal'].map((id) => {
      const r = run.buy(id);
      return r.ok ? null : r.error;
    });

    expect(errors).toEqual([
      { code: 'max-level', id: 'fast-ci' },
      { code: 'unknown-product', id: 'refactor' },
      { code: 'health-full' },
    ]);
    expect(run.snapshot()).toEqual(before);
    expect(random.calls).toBe(calls);
  });

  it('Scenario: Compra fuera de la tienda (en curso, eligiendo y terminada: not-shopping)', () => {
    const running = startAtDoor(shopConfig(), {
      player: { x: 1500, y: 1000 },
      resources: { gold: 1000, wood: 0 },
    });
    const character = [anUpgrade('shortcuts')];
    const choosingConfig = { ...shopConfig(), upgrades: { ...shopConfig().upgrades, character } };
    const choosing = startAtDoor(choosingConfig, {
      player: { x: 1500, y: 1000 },
      gems: [{ x: 1500, y: 1000, value: 5 }],
      resources: { gold: 1000, wood: 0 },
    });
    ticks(choosing, 1);
    const over = startAtDoor(withDuration(shopConfig(), 1), { player: { x: 1500, y: 1000 } });
    ticks(over, 60);

    expect([running.status, choosing.status, over.status]).toEqual(['running', 'choosing', 'over']);
    for (const run of [running, choosing, over]) {
      const before = run.snapshot();
      expect(run.buy('strict-rules')).toEqual({ ok: false, error: { code: 'not-shopping' } });
      expect(run.snapshot()).toEqual(before);
    }
  });

  it('Scenario: Comprar no consume azar (2 compras frente a ninguna: mismo azar y ovejas)', () => {
    const pair = () => {
      const random = new CountingRandom(new Mulberry32RandomGenerator(7));
      const flock = new CountingRandom(new Mulberry32RandomGenerator(77));
      const run = startAtDoor(shopConfig(), { resources: { gold: 50, wood: 0 } }, random, {
        at: [{ x: 3000, y: 300 }],
        random: flock,
      });
      untilShopping(run, 1);
      return { run, random, flock };
    };
    const a = pair();
    const b = pair();
    buyAll(a.run, ['strict-rules', 'coverage']);
    a.run.leaveShop();
    b.run.leaveShop();

    expect([a.random.calls, a.flock.calls]).toEqual([b.random.calls, b.flock.calls]);
    expect([a.random.next(), a.flock.next()]).toEqual([b.random.next(), b.flock.next()]);
  });
});

describe('Curación de pago (player-health 0024)', () => {
  it('Scenario: Curación de pago completa (40 de 100, oro 20, dos curaciones: 90 y 0)', () => {
    const s = buyAll(shopping(20, { player: { ...INSIDE_DOOR, health: 40 } }), ['heal', 'heal']);

    expect([s.player.health, s.resources.gold]).toEqual([90, 0]);
  });

  it('Scenario: Curación recortada por el tope (99 de 100 y oro 10: 100 y 0)', () => {
    const s = buyAll(shopping(10, { player: { ...INSIDE_DOOR, health: 99 } }), ['heal']);

    expect([s.player.health, s.resources.gold]).toEqual([100, 0]);
  });

  it('Scenario: Vida llena (error, vida 100 y oro 10)', () => {
    const run = shopping(10);

    expect(run.buy('heal')).toEqual({ ok: false, error: { code: 'health-full' } });
    expect([run.snapshot().player.health, run.snapshot().resources.gold]).toEqual([100, 10]);
  });

  it('Scenario: La curación de pago no cambia la invulnerabilidad (sin daño de 21 a 40, sí en 41)', () => {
    // Golpe de una dinamita en el tick 10; el jugador (1 px/tick a la izquierda) entra en el radio
    // en el tick 20, ya en contacto con el `hitter` quieto (aún invulnerable hasta el 40).
    const run = startAtDoor(shopConfig({ weapons: weaponsOf([]) }), {
      player: { x: 1059, y: 1000 },
      resources: { gold: 10, wood: 0 },
      dynamites: [aDynamite({ x: 1049, y: 1000 }, 10, { damage: 10 })],
      enemies: [{ type: 'hitter', x: 1039 - 25, y: 1000 }],
    });
    const first = ticks(run, 20, LEFT);
    expect([first[9]?.player.health, first.at(-1)?.status]).toEqual([90, 'shopping']);
    buyAll(run, ['heal']);
    run.leaveShop();
    const after = ticks(run, 21);
    const health = after.map((s) => s.player.health);

    expect(run.snapshot().player.invulnerable).toBe(true);
    expect(health.slice(0, 20)).toEqual(Array(20).fill(100));
    expect([after[20]?.tick, health[20]]).toEqual([41, 90]);
  });
});

describe('Oro en la tienda (resources 0024)', () => {
  it('Scenario: El oro solo baja al comprar (30 → 0 y vuelve a subir; con 29, error)', () => {
    const config = withShop(shopConfig(), {}, { price: 30 });
    const run = startAtDoor(config, {
      player: { ...INSIDE_DOOR, health: 50 },
      resources: { gold: 30, wood: 0 },
      gems: [{ kind: 'gold', x: SHOP_DOOR.x + 300, y: 1000, value: 4, attracted: true }],
    });
    untilShopping(run, 1);
    buyAll(run, ['heal']);
    expect(run.snapshot().resources.gold).toBe(0);
    run.leaveShop();
    const later = ticks(run, 120);
    const poor = startAtDoor(config, {
      player: { ...INSIDE_DOOR, health: 50 },
      resources: { gold: 29, wood: 0 },
    });
    untilShopping(poor, 1);

    expect(later.at(-1)?.resources.gold).toBe(4);
    expect(poor.buy('heal')).toEqual({
      ok: false,
      error: { code: 'not-enough-gold', price: 30, gold: 29 },
    });
    expect(poor.snapshot().resources.gold).toBe(29);
  });
});

describe('Salida de la tienda (castle-shop 0024)', () => {
  it('Scenario: Salir y seguir (en curso con tick n y luego n + 1)', () => {
    const run = shopping(0);
    expect(run.leaveShop()).toEqual({ ok: true, value: undefined });
    const out = run.snapshot();
    const [next] = ticks(run, 1);

    expect([out.status, out.tick, next?.tick]).toEqual(['running', 1, 2]);
  });

  it('Scenario: Salir fuera de la tienda (en curso, eligiendo y terminada: error)', () => {
    const running = startAtDoor(shopConfig(), { player: { x: 1500, y: 1000 } });
    const over = startAtDoor(withDuration(shopConfig(), 1), { player: { x: 1500, y: 1000 } });
    ticks(over, 60);
    for (const run of [running, over]) {
      const before = run.snapshot();
      expect(run.leaveShop()).toEqual({ ok: false, error: { code: 'not-shopping' } });
      expect(run.snapshot()).toEqual(before);
    }
  });

  it('Scenario: Salir no reabre · Segunda visita (600 ticks a d = 10; alejarse y volver)', () => {
    const run = startAtDoor(shopConfig({ weapons: weaponsOf([]) }), {
      player: { x: 1010, y: 1000 },
    });
    untilShopping(run, 1);
    run.leaveShop();
    const stay = ticks(run, 600);
    expect(stay.every((s) => s.status === 'running' && !s.shop.armed)).toBe(true);
    ticks(run, 290, PlayerInput.of(1, 0));
    expect(run.snapshot().shop.armed).toBe(true);

    expect(untilShopping(run, 400, LEFT)).toBeGreaterThan(601);
  });

  it('Scenario: Visita sin compras · La tienda no consume azar (600 ticks pedidos en la tienda)', () => {
    const start = () =>
      startAtDoor(
        shopConfig(),
        { enemies: [{ type: 'dummy', x: 1300, y: 1000 }] },
        new Mulberry32RandomGenerator(7),
      );
    const a = start();
    const b = start();
    untilShopping(a, 1);
    untilShopping(b, 1);
    a.leaveShop();
    ticks(b, 600, PlayerInput.of(1, 1));
    b.leaveShop();

    expect(ticks(b, 600)).toEqual(ticks(a, 600));
  });
});

describe('Simulación congelada en la tienda (run-state 0024)', () => {
  it('Scenario: En tienda y vuelta a en curso (sin resultado en ambos)', () => {
    const run = shopping(0);
    const inShop = run.snapshot();
    run.leaveShop();

    expect([inShop.status, inShop.outcome]).toEqual(['shopping', null]);
    expect([run.status, run.outcome]).toEqual(['running', null]);
  });

  it('Scenario: 600 ticks en la tienda (enemigo, proyectil, gema atraída e invulnerable)', () => {
    const run = startAtDoor(shopConfig(), {
      enemies: [
        { type: 'dummy', x: 1300, y: 1000 },
        { type: 'hitter', x: 1039, y: 1000 },
      ],
      gems: [{ x: 1300, y: 1300, value: 1, attracted: true }],
    });
    untilShopping(run, 1);
    const n = run.snapshot();
    const during = ticks(run, 600, PlayerInput.of(1, 1));

    expect(n.projectiles.length).toBeGreaterThan(0);
    expect(n.player.invulnerable).toBe(true);
    expect(during.every((s) => s === during[0])).toBe(false);
    for (const s of during) expect(s).toEqual(n);
  });

  it('Scenario: Peligros e invulnerabilidad en pausa durante la tienda (explota en n + 4, contacto en n + 21)', () => {
    // Golpe de una dinamita en el tick 10 (= n − 10); el jugador entra en el radio en el tick 20.
    const run = startAtDoor(shopConfig({ weapons: weaponsOf([]) }), {
      player: { x: 1059, y: 1000 },
      dynamites: [aDynamite({ x: 1049, y: 1000 }, 10, { damage: 10 })],
      enemies: [
        { type: 'hitter', x: 1039 - 25, y: 1000 },
        { type: 'goblin-barrel', x: 1600, y: 1000, ...inState('fuse', 6) },
      ],
    });
    // El barril, lejos, lleva 6 de sus 30 ticks de mecha: explota en el tick 24 = n + 4.
    ticks(run, 20, LEFT);
    expect(run.status).toBe('shopping');
    ticks(run, 600);
    run.leaveShop();
    const after = ticks(run, 25);
    const blast = after.findIndex((s) => s.blasts.some((b) => b.x === 1600));
    const hits = after.flatMap((s, i) =>
      s.player.health < (after[i - 1]?.player.health ?? 90) ? [s.tick] : [],
    );

    expect(after[blast]?.tick).toBe(24);
    expect(hits).toEqual([41]);
  });

  it('Scenario: Tienda abierta justo antes del tick de la victoria (119 en tienda; 120 gana)', () => {
    const run = startAtDoor(withDuration(shopConfig({ weapons: weaponsOf([]) }), 2), {
      player: { x: 1158, y: 1000 },
    });
    const before = ticks(run, 119, LEFT);
    const during = ticks(run, 600);
    run.leaveShop();
    const [last] = ticks(run, 1);

    expect(before.at(-1)).toMatchObject({ tick: 119, status: 'shopping', outcome: null });
    expect(during.every((s) => s.tick === 119 && s.status === 'shopping')).toBe(true);
    expect(last).toMatchObject({ tick: 120, status: 'over', outcome: 'won' });
  });

  it('Scenario: Sin oferta abierta (en tienda: no-offer y snapshot igual)', () => {
    const run = shopping(0);
    const before = run.snapshot();

    expect(run.chooseUpgrade(0)).toEqual({ ok: false, error: { code: 'no-offer' } });
    expect(run.snapshot()).toEqual(before);
  });
});

describe('Efectos de las mejoras compradas (upgrades 0024)', () => {
  it('Scenario: Cadencia mejorada sin reiniciar la carga (fast-ci comprado en el tick 10: 1, 31, 57, 83)', () => {
    const run = startAtDoor(shopConfig({ weapons: weaponsOf([LINTER]) }), {
      player: { x: 1049, y: 1000 },
      resources: { gold: 10, wood: 0 },
      enemies: [{ type: 'dummy', x: 1099, y: 1000 }],
    });
    const first = ticks(run, 10, LEFT);
    expect(first.at(-1)?.status).toBe('shopping');
    buyAll(run, ['fast-ci']);
    run.leaveShop();

    expect(launches([...first, ...ticks(run, 80)])).toEqual([1, 31, 57, 83]);
  });

  it('Scenario: Cadencia de Tests mejorada (watch-mode 1 antes del tick 1: 1, 79 y 157)', () => {
    const run = startAtDoor(shopConfig({ weapons: weaponsOf([TESTS]) }), {
      player: { x: 1500, y: 1000 },
      upgrades: { 'watch-mode': 1 },
      enemies: [{ type: 'dummy', x: 1530, y: 1000 }],
    });
    const fired = [...new Set(ticks(run, 157).flatMap((s) => s.pulses.map((p) => p.firedAt)))];

    expect(fired).toEqual([1, 79, 157]);
  });

  it('Scenario: Proyectil en vuelo durante una mejora de daño (el del tick 1 hace 6; luego 9)', () => {
    const lives = (health: number) => {
      const run = startAtDoor(shopConfig({ weapons: weaponsOf([LINTER]) }), {
        player: { x: 1042, y: 1000 },
        resources: { gold: 10, wood: 0 },
        enemies: [{ type: 'dummy', x: 1142, y: 1000, health }],
      });
      const first = ticks(run, 3, LEFT);
      expect(first.at(-1)?.status).toBe('shopping');
      buyAll(run, ['strict-rules']);
      run.leaveShop();
      const all = [...first, ...ticks(run, 120)];
      return [...new Set(all.map((s) => s.enemies[0]?.health ?? 0))];
    };

    expect(lives(10)).toEqual([10, 4, 0]);
    expect(lives(19)).toEqual([19, 13, 4, 0]);
  });

  it('Scenario: Pulso visible durante una mejora de radio (90 de 1 a 8; el siguiente, 105)', () => {
    const run = startAtDoor(shopConfig({ weapons: weaponsOf([TESTS]) }), {
      resources: { gold: 10, wood: 0 },
      enemies: [{ type: 'dummy', x: INSIDE_DOOR.x + 30, y: 1000 }],
    });
    const [n] = ticks(run, 1);
    expect(n?.status).toBe('shopping');
    buyAll(run, ['coverage']);
    run.leaveShop();
    const snaps = [n as RunSnapshot, ...ticks(run, 94)];
    const first = snaps.slice(0, 8).map((s) => s.pulses.map((p) => [p.firedAt, p.radius]));

    expect(first).toEqual(Array(8).fill([[1, 90]]));
    expect(snaps[90]?.pulses).toEqual([expect.objectContaining({ firedAt: 91, radius: 105 })]);
  });
});

describe('Tienda en el snapshot y determinismo (simulation-loop 0024)', () => {
  it('Scenario: Tienda en el snapshot (oro 25, compra de 10: 15, nivel nuevo y puerta desarmada)', () => {
    const s = buyAll(shopping(25), ['hard-asserts']);

    expect(s.status).toBe('shopping');
    expect(s.shop).toMatchObject({ gold: 15, armed: false, open: true });
    expect(product(s, 'hard-asserts')).toMatchObject({ level: 1, price: 15 });
  });

  it('Scenario: Compras distintas divergen (strict-rules frente a fast-ci)', () => {
    const a = buyAll(shopping(10), ['strict-rules']);
    const b = buyAll(shopping(10), ['fast-ci']);

    expect(a.upgrades).not.toEqual(b.upgrades);
  });
});
