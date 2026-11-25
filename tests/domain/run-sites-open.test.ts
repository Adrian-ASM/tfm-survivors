import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { Run } from '../../src/domain/run/Run';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  CONTENT_BUILDINGS,
  DEFAULT_CHARACTER_UPGRADES,
  aDefaultConfig,
  withBuildings,
  withDuration,
  withShop,
  withUpgrades,
} from '../support/builders';
import { CountingRandom } from '../support/random';
import { advance, startSeededRun, ticks } from '../support/runs';
import { declaredSheep, sheepRandom } from '../support/sheep';
import {
  NEAR_ACCESS,
  TEST_ACCESS,
  TEST_SITE,
  aSiteConfig,
  dAccess,
  leaveSiteIfOpen,
  startWithSites,
  untilBuilding,
  withCosts,
  withStock,
} from '../support/sites';

// Spec build-sites 0026, "Solares de la partida", "Apertura del solar con re-armado" y "Oferta de
// obra"; simulation-loop, paso 12. Solar de prueba con acceso en (1.260, 810), radio 40 y re-armado
// 300; jugador a 60 px/s (1 px por tick) salvo que se diga otra cosa.
const UP = PlayerInput.of(0, -1);
const RIGHT = PlayerInput.of(1, 0);
const LEFT = PlayerInput.of(-1, 0);
const building = (snaps: readonly RunSnapshot[]) => snaps.some((s) => s.status === 'building');
/** Jugador a d = 45 bajo el acceso: con 1 px por tick hacia arriba entra a d < 40 en el tick 6. */
const BELOW = { x: TEST_ACCESS.x, y: TEST_ACCESS.y + 45 };
const HOUSE = { kind: 'house', wood: 15, stone: 0 };
const TOWER = { kind: 'tower', wood: 30, stone: 15 };
/** Solo el catálogo de personaje (los escenarios no llevan armas). */
const CHARACTER = { character: DEFAULT_CHARACTER_UPGRADES, weapons: [] };

/** Partida del solar de prueba que entra a d < 40 en el tick 6 (desde `BELOW`). */
const entering = (wood: number, stone = 0, config = aSiteConfig()): Run =>
  startWithSites(config, { ...withStock(wood, stone), player: BELOW });

describe('Solares de la partida (spec build-sites 0026)', () => {
  it('Scenario: Solares al crear la partida (semilla 42)', () => {
    const run = startSeededRun(aDefaultConfig(), 42);
    const s = run.snapshot();
    expect(s.sites).toHaveLength(6);
    expect(new Set(s.sites.map((x) => x.id)).size).toBe(6);
    expect(s.sites.every((x) => x.state === 'free' && x.armed)).toBe(true);
    for (const site of s.sites) {
      expect(site.access).toEqual(run.map.sites[site.id]?.access);
      expect(site.house).toEqual(site.tower);
      const { col, row, cols, rows } = site.house;
      for (let r = row; r < row + rows; r++)
        for (let c = col; c < col + cols; c++) expect(run.map.cells[r * 64 + c]).toBe('grass');
    }
  });

  it('Scenario: Sin solares en el mapa vacío (semilla 42, 3.600 ticks)', () => {
    const run = startSeededRun(aDefaultConfig(), 42, 'empty');
    const snaps = advance(run, 3600);
    expect(snaps.every((s) => s.sites.length === 0)).toBe(true);
    expect(building(snaps)).toBe(false);
  });

  it('Scenario: Sin solares (0 por mapa, semilla 42, 3.600 ticks)', () => {
    const sites = { ...CONTENT_BUILDINGS.sites, count: 0 };
    const config = withBuildings(aDefaultConfig(), { ...CONTENT_BUILDINGS, sites });
    const snaps = advance(startSeededRun(config, 42), 3600);
    expect(snaps.every((s) => s.sites.length === 0)).toBe(true);
  });
});

describe('Apertura del solar con re-armado (spec build-sites 0026)', () => {
  it('Scenario: Se abre con el coste exacto de la casa', () => {
    const run = entering(15);
    const snaps = ticks(run, 6, UP);
    const s = snaps[5];
    expect(snaps.slice(0, 5).some((x) => x.status === 'building')).toBe(false);
    expect(s?.status).toBe('building');
    expect(s?.tick).toBe(6);
    expect(s?.build).toEqual({ open: true, siteId: 0, options: [HOUSE] });
    expect(s?.sites[0]?.armed).toBe(false);
  });

  it('Scenario: Sin madera suficiente el solar no se abre', () => {
    const run = startWithSites(aSiteConfig(), withStock(14, 100));
    const snaps = ticks(run, 600);
    expect(building(snaps)).toBe(false);
    expect(snaps.at(-1)?.sites[0]?.armed).toBe(true);
  });

  it('Scenario: La torre no se ofrece sin piedra suficiente', () => {
    const run = entering(30, 14);
    untilBuilding(run, 10, UP);
    expect(run.snapshot().build.options).toEqual([HOUSE]);
  });

  it('Scenario: Las dos opciones', () => {
    const run = entering(30, 15);
    untilBuilding(run, 10, UP);
    expect(run.snapshot().build.options).toEqual([HOUSE, TOWER]);
  });

  it('Scenario: Solo la torre asequible', () => {
    const config = withCosts(aSiteConfig(), { wood: 20, stone: 0 }, { wood: 10, stone: 5 });
    const run = entering(12, 5, config);
    untilBuilding(run, 10, UP);
    expect(run.snapshot().build.options).toEqual([{ kind: 'tower', wood: 10, stone: 5 }]);
  });

  it.each([
    ['Recursos que llegan dentro del radio (build-sites)'],
    ['Solar abierto con los recursos del mismo tick (simulation-loop)'],
  ])('Scenario: %s', () => {
    // Un `wood` de valor 1 a 60 px: el imán lo atrae y se recoge en un tick m > 1.
    const wood = { x: NEAR_ACCESS.x + 60, y: NEAR_ACCESS.y, value: 1, kind: 'wood' as const };
    const run = startWithSites(aSiteConfig({ player: { pickupRadius: 128 } }), {
      ...withStock(14),
      gems: [wood],
    });
    const snaps = ticks(run, 60);
    const m = snaps.findIndex((s) => s.resources.wood === 15);
    expect(m).toBeGreaterThan(0);
    expect(snaps.slice(0, m).some((s) => s.status === 'building')).toBe(false);
    expect(snaps[m]?.status).toBe('building');
  });

  it('Scenario: Tangencia con el radio no abre', () => {
    // 6 px/s = 0,1 px por tick: un tick a la izquierda lleva de d = 40 a d = 39,9.
    const config = aSiteConfig({ player: { speed: 6 } });
    const run = startWithSites(config, {
      ...withStock(15),
      player: { x: TEST_ACCESS.x + 40, y: TEST_ACCESS.y },
    });
    const still = ticks(run, 600);
    const [inside] = ticks(run, 1, LEFT);
    expect(building(still)).toBe(false);
    expect(dAccess(inside ?? still[0])).toBeCloseTo(39.9, 6);
    expect(inside?.status).toBe('building');
  });

  /** "Salir no reabre": abre en el tick 1 a d = 10, sale y 600 ticks quieto. */
  const leftOnce = (): { run: Run; after: RunSnapshot[] } => {
    const run = startWithSites(aSiteConfig(), withStock(15));
    expect(untilBuilding(run)).toBe(1);
    leaveSiteIfOpen(run);
    return { run, after: ticks(run, 600) };
  };

  it('Scenario: Salir no reabre', () => {
    const { after } = leftOnce();
    expect(after.every((s) => s.status === 'running')).toBe(true);
    expect(after.at(-1)?.sites[0]?.armed).toBe(false);
  });

  it('Scenario: Volver sin alejarse lo suficiente (d = 299 y vuelta a 0)', () => {
    const { run } = leftOnce();
    const away = ticks(run, 289, RIGHT);
    const back = ticks(run, 299, LEFT);
    const rest = ticks(run, 60);
    expect(dAccess(away.at(-1))).toBeCloseTo(299, 6);
    expect(dAccess(back.at(-1))).toBeCloseTo(0, 6);
    expect(building([...away, ...back, ...rest])).toBe(false);
  });

  it('Scenario: Volver tras alejarse (d = 300 en a, primera d < 40 en b)', () => {
    const { run } = leftOnce();
    const away = ticks(run, 290, RIGHT);
    const a = away.at(-1);
    const back: RunSnapshot[] = [];
    while (run.status === 'running' && back.length < 400) back.push(...ticks(run, 1, LEFT));
    const b = back.at(-1);
    expect(dAccess(a)).toBeCloseTo(300, 6);
    expect(a?.sites[0]?.armed).toBe(true);
    expect(away.slice(0, -1).some((s) => s.sites[0]?.armed)).toBe(false);
    expect(b?.status).toBe('building');
    expect(dAccess(b)).toBeLessThan(40);
    expect(dAccess(back.at(-2))).toBeGreaterThanOrEqual(40);
    expect(building(back.slice(0, -1))).toBe(false);
  });

  it('Scenario: Oferta de mejora en el mismo tick', () => {
    const config = withUpgrades(aSiteConfig(), CHARACTER);
    const gem = { ...NEAR_ACCESS, value: 9 };
    const run = startWithSites(config, { ...withStock(15), gems: [gem] });
    const [n] = ticks(run, 1);
    expect(n?.status).toBe('choosing');
    expect(n?.sites[0]?.armed).toBe(true);
    run.chooseUpgrade(0);
    const [next] = ticks(run, 1);
    expect(next?.status).toBe('building');
  });

  it('Scenario: Tienda y solar en el mismo tick', () => {
    // Acceso del solar (16, 13) en (1.020, 990): a 22,4 px de la puerta (1.000, 1.000).
    const config = withShop(aSiteConfig(), { radius: 40, rearmDistance: 300 });
    const run = startWithSites(
      config,
      { ...withStock(15), player: { x: 1010, y: 995 }, shop: { armed: true } },
      [{ col: 16, row: 13 }],
      { door: { x: 1000, y: 1000 } },
    );
    const [n] = ticks(run, 1);
    expect(n?.status).toBe('shopping');
    expect(n?.sites[0]?.armed).toBe(true);
    run.leaveShop();
    expect(ticks(run, 1)[0]?.status).toBe('building');
  });

  it('Scenario: Dos solares a la vez', () => {
    // s1 (20, 10) con acceso en (1.260, 810) y s2 (20, 11) con acceso en (1.260, 870).
    const run = startWithSites(aSiteConfig(), { ...withStock(15), player: { x: 1260, y: 840 } }, [
      TEST_SITE,
      { col: 20, row: 11 },
    ]);
    const [n] = ticks(run, 1);
    expect(n?.build.siteId).toBe(0);
    expect(n?.sites[1]?.armed).toBe(true);
    leaveSiteIfOpen(run);
    const [next] = ticks(run, 1);
    expect(next?.status).toBe('building');
    expect(next?.build.siteId).toBe(1);
  });

  it('Scenario: Sin oferta en el tick de la victoria (duración 120 ticks)', () => {
    // A 1 px por tick desde d = 159,5: la primera d < 40 es la del tick 120.
    const run = startWithSites(withDuration(aSiteConfig(), 2), {
      ...withStock(15),
      player: { x: TEST_ACCESS.x, y: TEST_ACCESS.y + 159.5 },
    });
    const snaps = ticks(run, 120, UP);
    expect(dAccess(snaps[119])).toBeCloseTo(39.5, 6);
    expect([snaps[119]?.status, snaps[119]?.outcome]).toEqual(['over', 'won']);
    expect(building(snaps)).toBe(false);
  });

  it('Scenario: Abrir no consume azar (semilla 7)', () => {
    const counted = (withSite: boolean) => {
      const random = new CountingRandom(new Mulberry32RandomGenerator(7));
      const stones = new CountingRandom(new Mulberry32RandomGenerator(8));
      const sheep = new CountingRandom(sheepRandom(7));
      const flock = declaredSheep([{ x: 3000, y: 1800 }], { random: sheep });
      const run = startWithSites(aSiteConfig(), withStock(15), withSite ? [TEST_SITE] : [], {
        random,
        stoneRandom: stones,
        ...(flock.kind === 'open' && flock.sheep ? { sheep: flock.sheep } : {}),
      });
      const [n] = ticks(run, 1);
      return { status: n?.status, calls: [random.calls, sheep.calls, stones.calls] };
    };
    const opened = counted(true);
    const none = counted(false);
    expect([opened.status, none.status]).toEqual(['building', 'running']);
    expect(opened.calls).toEqual(none.calls);
  });
});

describe('Oferta de obra (spec build-sites 0026)', () => {
  it('Scenario: Oferta en el snapshot (s2, madera 40 y piedra 20, 600 ticks pedidos)', () => {
    const s2 = { col: 20, row: 20 };
    const run = startWithSites(
      aSiteConfig(),
      { ...withStock(40, 20), player: { x: 1270, y: 1410 } },
      [TEST_SITE, s2],
    );
    untilBuilding(run, 5);
    const first = run.snapshot();
    const during = ticks(run, 600, RIGHT);
    expect(first.build).toEqual({ open: true, siteId: 1, options: [HOUSE, TOWER] });
    expect(during.every((s) => JSON.stringify(s.build) === JSON.stringify(first.build))).toBe(true);
  });

  it('Scenario: Sin oferta fuera de la obra (en curso, eligiendo, en tienda y terminado)', () => {
    const closed = { open: false, siteId: null, options: [] };
    const runningRun = startWithSites(aSiteConfig(), withStock(0));
    const choosing = startWithSites(withUpgrades(aSiteConfig(), CHARACTER), {
      gems: [{ ...NEAR_ACCESS, value: 9 }],
    });
    ticks(choosing, 1);
    const shopping = startWithSites(
      withShop(aSiteConfig(), { radius: 40, rearmDistance: 300 }),
      { player: { x: 1010, y: 995 }, shop: { armed: true } },
      [],
      { door: { x: 1000, y: 1000 } },
    );
    ticks(shopping, 1);
    const over = startWithSites(withDuration(aSiteConfig(), 1), withStock(0));
    ticks(over, 60);
    const snaps = [runningRun, choosing, shopping, over].map((r) => r.snapshot());
    expect(snaps.map((s) => s.status)).toEqual(['running', 'choosing', 'shopping', 'over']);
    expect(snaps.every((s) => JSON.stringify(s.build) === JSON.stringify(closed))).toBe(true);
  });
});
