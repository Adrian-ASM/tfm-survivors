import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { Run, RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import {
  DEFAULT_WEAPON_UPGRADES,
  aDefaultConfig,
  aSegment,
  withDuration,
  withShop,
} from '../support/builders';
import { startOn } from '../support/camps';
import { aBehaviorConfig, aProbeType, play, startSeededRun, ticks } from '../support/runs';
import { withPlayerStat } from '../support/upgrades';

// Spec castle-shop (0024), "Apertura por la puerta con re-armado" y "Productos de la tienda";
// simulation-loop, pasos 10 y 11. Escenarios: mapa vacío con puerta declarada en (1.000, 1.000),
// radio 40 y re-armado 300; jugador a 60 px/s (1 px por tick), sin armas ni oleadas.

const DOOR = { x: 1000, y: 1000 };
const RIGHT = PlayerInput.of(1, 0);
const LEFT = PlayerInput.of(-1, 0);

const doorConfig = (o: Parameters<typeof aBehaviorConfig>[1] = {}): RunConfig =>
  withShop(aBehaviorConfig([aProbeType()], { ...o, player: { speed: 60, ...o.player } }), {
    radius: 40,
    rearmDistance: 300,
  });
const atDoor = (setup: RunSetup = {}, config = doorConfig()): Run =>
  startOn(config, { kind: 'open', door: DOOR }, { player: DOOR, ...setup });

/** Ejecuta n ticks con `input` y devuelve los snapshots (índice 0 = primero ejecutado). */
const run = (r: Run, n: number, input = PlayerInput.NONE): RunSnapshot[] => ticks(r, n, input);
const shopped = (snaps: readonly RunSnapshot[]) => snaps.some((s) => s.status === 'shopping');

describe('Apertura por la puerta con re-armado (castle-shop 0024)', () => {
  it('Scenario: No se abre al nacer (semilla 42, mapa generado, quieto en la puerta)', () => {
    const r = startSeededRun(aDefaultConfig(), 42);
    let shopping = false;
    play(r, 36_000, (_, x) => {
      shopping ||= x.status === 'shopping';
      return shopping;
    });

    expect([r.map.door, shopping, r.status]).toEqual([{ x: 1950, y: 1170 }, false, 'over']);
  });

  it('Scenario: Volver sin alejarse lo suficiente (d = 299, vuelta a 0 y 60 ticks)', () => {
    const r = atDoor();
    const away = run(r, 299, RIGHT);
    const back = run(r, 299, LEFT);
    const rest = run(r, 60);

    expect(away.at(-1)?.player.x).toBeCloseTo(1299, 6);
    expect(back.at(-1)?.player.x).toBeCloseTo(1000, 6);
    expect(shopped([...away, ...back, ...rest])).toBe(false);
    expect([...away, ...back, ...rest].some((s) => s.shop.armed)).toBe(false);
  });

  it('Scenario: Volver tras alejarse (armada en el tick a = 300; en tienda en b, no antes)', () => {
    const r = atDoor();
    const away = run(r, 300, RIGHT);
    const back = run(r, 261, LEFT);
    const b = back.findIndex((s) => s.status === 'shopping');

    expect(away.at(-1)?.shop.armed).toBe(true);
    expect(away.at(-2)?.shop.armed).toBe(false);
    expect(b).toBe(back.length - 1);
    expect(back.at(-1)?.player.x).toBeCloseTo(1039, 6);
    expect(back.at(-2)?.player.x).toBeCloseTo(1040, 6);
    expect(back.at(-1)?.shop).toMatchObject({ armed: false, open: true });
  });

  it('Scenario: Tangencia con el radio no abre (600 ticks a d = 40; a d = 39,9 sí)', () => {
    const tangent = atDoor({ player: { x: 1040, y: 1000 }, shop: { armed: true } });
    const slow = doorConfig({ player: { speed: 6 } });
    const inside = atDoor({ player: { x: 1040, y: 1000 }, shop: { armed: true } }, slow);

    expect(shopped(run(tangent, 600))).toBe(false);
    const [s] = run(inside, 1, LEFT);
    expect(s?.player.x).toBeCloseTo(1039.9, 6);
    expect(s?.status).toBe('shopping');
  });

  it('Scenario: Oferta y tienda en el mismo tick (manda la oferta; en tienda en n + 1)', () => {
    const config = withPlayerStat(doorConfig(), 'shortcuts', 20, 5);
    const r = atDoor(
      {
        player: { x: 1039, y: 1000 },
        shop: { armed: true },
        gems: [{ x: 1039, y: 1000, value: 1 }],
        experience: { level: 1, xp: 4 },
      },
      config,
    );
    const [n] = run(r, 1);
    expect([n?.status, n?.shop.armed]).toEqual(['choosing', true]);

    expect(r.chooseUpgrade(0).ok).toBe(true);
    const [next] = run(r, 1);

    expect([next?.tick, next?.status]).toEqual([2, 'shopping']);
  });

  it('Scenario: Sin tienda en el tick de la victoria (entra a d < 40 en el tick 120)', () => {
    const r = atDoor(
      { player: { x: 1159, y: 1000 }, shop: { armed: true } },
      withDuration(doorConfig(), 2),
    );
    const snaps = run(r, 120, LEFT);

    expect(snaps.at(-1)?.player.x).toBeCloseTo(1039, 6);
    expect(snaps.at(-1)).toMatchObject({ tick: 120, status: 'over', outcome: 'won' });
    expect(shopped(snaps)).toBe(false);
  });

  it('Scenario: Mapa sin puerta (semilla 7, vacío: 400 px y vuelta en 1.200 ticks)', () => {
    const r = startSeededRun(aDefaultConfig(), 7, 'empty');
    const snaps: RunSnapshot[] = [];
    for (let t = 1; t <= 1200 && r.status !== 'over'; t++) {
      while (r.status === 'choosing') r.chooseUpgrade(0);
      r.tick(t <= 112 ? RIGHT : t <= 224 ? LEFT : PlayerInput.NONE);
      snaps.push(r.snapshot());
    }

    expect(Math.max(...snaps.map((s) => s.player.x)) - 1920).toBeGreaterThan(399);
    expect(shopped(snaps)).toBe(false);
  });

  it('Scenario: La tienda se abre tras el director (el goblin nuevo ya figura en tienda)', () => {
    const config = doorConfig({ segments: [aSegment(['probe'], 600)], maxBudget: 1000 });
    const r = atDoor({ player: { x: 1039, y: 1000 }, shop: { armed: true } }, config);
    const [n] = run(r, 1);

    expect(n?.status).toBe('shopping');
    expect(n?.enemies.length).toBeGreaterThan(0);
  });
});

describe('Productos de la tienda (castle-shop 0024)', () => {
  const WEAPON_IDS = DEFAULT_WEAPON_UPGRADES.map((u) => u.id);

  it('Scenario: Productos al empezar (7: las 6 de arma en orden y la curación, nivel 0)', () => {
    const { products } = startSeededRun(aDefaultConfig(), 42).snapshot().shop;

    expect(products.map((p) => p.id)).toEqual([...WEAPON_IDS, 'heal']);
    for (const [i, u] of DEFAULT_WEAPON_UPGRADES.entries()) {
      expect(products[i]).toMatchObject({
        kind: 'upgrade',
        id: u.id,
        name: u.name,
        description: u.description,
        level: 0,
        maxLevel: u.maxLevel,
        price: u.prices?.[0],
      });
    }
    expect(products[6]).toMatchObject({ kind: 'heal', amount: 25, price: 8 });
  });

  it('Scenario: Producto en su nivel máximo (coverage al máximo: nivel 5 y sin precio)', () => {
    const r = startSeededRun(aDefaultConfig(), 42, 'generated', { upgrades: { coverage: 5 } });
    const coverage = r.snapshot().shop.products.find((p) => p.id === 'coverage');

    expect(coverage).toMatchObject({ level: 5, maxLevel: 5, price: null, affordable: false });
  });
});

describe('Tienda en el snapshot (simulation-loop 0024)', () => {
  it('Scenario: Partida recién creada (vacío sin puerta; generado con la puerta desarmada)', () => {
    const empty = startSeededRun(aDefaultConfig(), 7, 'empty').snapshot();
    const generated = startSeededRun(aDefaultConfig(), 7).snapshot();

    expect(empty.shop).toMatchObject({ door: null, armed: false, open: false, gold: 0 });
    expect(generated.shop).toMatchObject({
      door: { x: 1950, y: 1170, radius: 40 },
      armed: false,
      open: false,
    });
    for (const s of [empty, generated]) {
      expect(s.shop.products).toHaveLength(7);
      expect(s.shop.products.filter((p) => p.kind === 'upgrade').every((p) => p.level === 0)).toBe(
        true,
      );
    }
  });

  it('Scenario: Oferta en el snapshot (los productos no cambian al abrir la oferta)', () => {
    const config = aDefaultConfig();
    const r = startOn(
      config,
      { kind: 'open' },
      {
        player: { x: 480, y: 270 },
        gems: [{ x: 500, y: 270, value: 9 }],
        upgrades: { guardrail: 2 },
      },
    );
    const before = r.snapshot().shop.products;
    const [n] = ticks(r, 1);

    expect(n?.status).toBe('choosing');
    expect(n?.shop.products).toEqual(before);
  });
});
