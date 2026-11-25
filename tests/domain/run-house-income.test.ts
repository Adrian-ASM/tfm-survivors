import { describe, expect, it } from 'vitest';
import type { DeclaredSite } from '../../src/domain/map/TerrainSource';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { Run, RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import {
  DEFAULT_CHARACTER_UPGRADES,
  aBarrelType,
  inState,
  withDuration,
  withUpgrades,
} from '../support/builders';
import { aProbeType, ticks } from '../support/runs';
import {
  TEST_ACCESS,
  TEST_SITE,
  aSiteConfig,
  buildNow,
  leaveSiteIfOpen,
  startWithSites,
  untilBuilding,
  withIncome,
  withStock,
} from '../support/sites';
import { withPlayerStat } from '../support/upgrades';

// Spec build-sites 0026, "Oro periódico de las casas"; simulation-loop, paso 7.4; resources,
// "Contadores de oro y madera"; run-state, "Simulación congelada en obra". Jugador a 1 px por tick.
interface Point {
  readonly x: number;
  readonly y: number;
}
const S2 = { col: 28, row: 10 };
const A2 = { x: 1740, y: 810 };

/**
 * Lleva al jugador en recta hasta que su primera d < 40 al acceso `to` sea la del tick `tick`
 * (espera quieto lo que sobre) y construye `kind` allí.
 */
function buildAt(run: Run, to: Point, tick: number, kind = 'house'): RunSnapshot {
  const s = run.snapshot();
  const d0 = Math.hypot(to.x - s.player.x, to.y - s.player.y);
  const k = Math.floor(d0 - 40) + 1;
  const idle = tick - k - s.tick;
  if (idle < 0) throw new Error(`no llega a tiempo al tick ${String(tick)}`);
  ticks(run, idle);
  const dir = PlayerInput.of((to.x - s.player.x) / d0, (to.y - s.player.y) / d0);
  ticks(run, k, dir);
  if (run.status !== 'building' || run.snapshot().tick !== tick) {
    throw new Error(`obra no abierta en el tick ${String(tick)} (${run.status})`);
  }
  return buildNow(run, kind);
}

/** Ejecuta ticks hasta el `tick` dado y devuelve el oro de cada tick ejecutado (índice = tick). */
function goldUntil(run: Run, tick: number): Map<number, number> {
  const out = new Map<number, number>();
  while (run.snapshot().tick < tick) {
    const [s] = ticks(run, 1);
    if (!s) break;
    out.set(s.tick, s.resources.gold);
  }
  return out;
}

const start = (
  config: RunConfig,
  setup: RunSetup = {},
  sites: readonly DeclaredSite[] = [TEST_SITE],
) => startWithSites(config, { ...withStock(100), player: { x: 1260, y: 1400 }, ...setup }, sites);

describe('Oro periódico de las casas (spec build-sites 0026)', () => {
  it('Scenario: Pagos de una casa (construida en el tick 1.000)', () => {
    const run = start(aSiteConfig());
    buildAt(run, TEST_ACCESS, 1000);
    const gold = goldUntil(run, 4600);
    expect([gold.get(2799), gold.get(2800), gold.get(4599), gold.get(4600)]).toEqual([0, 1, 1, 2]);
  });

  it('Scenario: Dos casas (ticks 1.000 y 1.500)', () => {
    const run = start(aSiteConfig(), {}, [TEST_SITE, S2]);
    buildAt(run, TEST_ACCESS, 1000);
    buildAt(run, A2, 1500);
    const gold = goldUntil(run, 4600);
    expect([gold.get(2799), gold.get(2800), gold.get(3300), gold.get(4600)]).toEqual([0, 1, 2, 3]);
  });

  it('Scenario: Con bonificación de oro (periodo 10, g = 20: 10 pagos dan 12)', () => {
    const config = withPlayerStat(withIncome(aSiteConfig(), { everyTicks: 10 }), 'prospector', 20);
    const run = start(config, { player: TEST_ACCESS, upgrades: { prospector: 1 } });
    untilBuilding(run, 1);
    buildNow(run, 'house');
    const gold = goldUntil(run, 101);
    expect([gold.get(100), gold.get(101)]).toEqual([10, 12]);
  });

  it('Scenario: Pago de una casa como ingreso (resources: g = 10, 10 pagos dan 11)', () => {
    const config = withPlayerStat(withIncome(aSiteConfig(), { everyTicks: 10 }), 'prospector', 10);
    const run = start(config, { player: TEST_ACCESS, upgrades: { prospector: 1 } });
    untilBuilding(run, 1);
    buildNow(run, 'house');
    expect(goldUntil(run, 101).get(101)).toBe(11);
  });

  it('Scenario: Sin recogible ni tope (tope de oro en el suelo lleno)', () => {
    const config = withIncome(aSiteConfig(), { everyTicks: 10 });
    const golds = Array.from({ length: config.progression.maxGold }, (_, i) => ({
      x: 3000 + 10 * (i % 8),
      y: 300 + 10 * Math.floor(i / 8),
      value: 1,
      kind: 'gold' as const,
    }));
    const run = start(config, { player: TEST_ACCESS, gems: golds });
    untilBuilding(run, 1);
    buildNow(run, 'house');
    const before = ticks(run, 9).at(-1);
    const [paid] = ticks(run, 1);
    expect(paid?.tick).toBe(11);
    expect(paid?.resources.gold).toBe((before?.resources.gold ?? 0) + 1);
    expect(paid?.pickups).toEqual(before?.pickups);
  });

  it('Scenario: Sin pago en el tick de la victoria (duración 120, casa en el 60, periodo 60)', () => {
    const config = withIncome(withDuration(aSiteConfig(), 2), { everyTicks: 60 });
    const run = start(config, { player: { x: 1260, y: 870 } });
    buildAt(run, TEST_ACCESS, 60);
    const gold = goldUntil(run, 120);
    const end = run.snapshot();
    expect([end.status, end.outcome, end.tick]).toEqual(['over', 'won', 120]);
    expect(gold.get(120)).toBe(0);
  });

  it('Scenario: Las pausas no adelantan el pago (oferta en el 2.000 con 600 ticks pedidos)', () => {
    const CHARACTER = { character: DEFAULT_CHARACTER_UPGRADES, weapons: [] };
    // El jugador llega a (1.260, 849,5) en el tick 1.000; la gema, a 21,5 px a su derecha, se
    // recoge al moverse 1 px en el tick 2.000.
    const run = start(withUpgrades(aSiteConfig(), CHARACTER), {
      player: { x: 1260, y: 810 + 1039.5 },
      gems: [{ x: 1281.5, y: 849.5, value: 5 }],
    });
    buildAt(run, TEST_ACCESS, 1000);
    const idle = goldUntil(run, 1999);
    const [offer] = ticks(run, 1, PlayerInput.of(1, 0));
    expect([offer?.tick, offer?.status]).toEqual([2000, 'choosing']);
    ticks(run, 600);
    run.chooseUpgrade(0);
    const gold = goldUntil(run, 2800);
    expect([...idle.values(), offer?.resources.gold, gold.get(2799)].every((g) => g === 0)).toBe(
      true,
    );
    expect(gold.get(2800)).toBe(1);
  });
});

describe('Pagos en el orden del tick (spec simulation-loop 0026, paso 7.4)', () => {
  it('Scenario: Pago de la casa tras la regeneración (recogible y casa en el mismo tick, g = 50)', () => {
    // Casa en el tick 1 con periodo 10: paga en el 11. El `gold` a 21,5 px a la izquierda del
    // acceso se recoge al moverse 1 px en ese tick.
    const config = withPlayerStat(withIncome(aSiteConfig(), { everyTicks: 10 }), 'prospector', 50);
    const run = start(config, {
      player: TEST_ACCESS,
      upgrades: { prospector: 1 },
      gems: [{ x: TEST_ACCESS.x - 21.5, y: TEST_ACCESS.y, value: 1, kind: 'gold' }],
    });
    untilBuilding(run, 1);
    buildNow(run, 'house');
    const before = ticks(run, 9).at(-1);
    const [n] = ticks(run, 1, PlayerInput.of(-1, 0));
    expect([before?.resources.gold, n?.tick, n?.pickups.length, n?.resources.gold]).toEqual([
      0, 11, 0, 3,
    ]);
  });
});

describe('Simulación congelada en obra (spec run-state 0026)', () => {
  it('Scenario: Peligros, invulnerabilidad y pagos en pausa durante la obra', () => {
    // s1 con casa en el tick 1 (periodo 63: paga en 568); s2 (20, 20) con acceso en (1.260, 1.410)
    // se abre en n = 562; un `probe` golpea al jugador en 552 (n − 10) y un barril explota en 566.
    const types = [aProbeType(), aBarrelType({ fuseTicks: 566 })];
    const config = withIncome(aSiteConfig({ player: { maxHealth: 1000 } }, types), {
      everyTicks: 63,
    });
    const run = start(
      config,
      {
        player: TEST_ACCESS,
        enemies: [
          { type: 'probe', x: 1260, y: 1938 },
          { type: 'goblin-barrel', x: 3500, y: 300, ...inState('fuse') },
        ],
      },
      [TEST_SITE, { col: 20, row: 20 }],
    );
    untilBuilding(run, 1);
    buildNow(run, 'house');
    const down = PlayerInput.of(0, 1);
    while (run.status === 'running') ticks(run, 1, down);
    const n = run.snapshot();
    expect([n.tick, n.build.siteId]).toEqual([562, 1]);
    const hitAt = n.player.health;
    expect(hitAt).toBe(990);
    ticks(run, 600, down);
    leaveSiteIfOpen(run);
    const after = ticks(run, 25);
    const at = (t: number) => after.find((s) => s.tick === t);
    expect(after.find((s) => s.blasts.length > 0)?.blasts[0]?.tick).toBe(566);
    expect([at(567)?.resources.gold, at(568)?.resources.gold]).toEqual([
      n.resources.gold,
      n.resources.gold + 1,
    ]);
    expect(after.filter((s) => s.tick <= 582).every((s) => s.player.health === 990)).toBe(true);
    expect(at(583)?.player.health).toBe(980);
  });
});
