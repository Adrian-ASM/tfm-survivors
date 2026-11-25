import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { seededRun } from '../../src/composition/seedSource';
import type { TerrainSource } from '../../src/domain/map/TerrainSource';
import { Run } from '../../src/domain/run/Run';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { CONTACT_EPS } from '../../src/domain/site/BuildingRules';
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
  TEST_SITE,
  TOUCH,
  aSiteConfig,
  gapOf,
  leaveSiteIfOpen,
  startWithSites,
  untilBuilding,
  withCosts,
  withStock,
} from '../support/sites';

// Spec build-sites 0027, "Solares de la partida", "Apertura del solar con re-armado" y "Oferta de
// obra"; simulation-loop, paso 12. Solar de prueba con huella x en [1.200, 1.320] e y en [600, 720],
// jugador de radio 16 a 60 px/s (1 px por tick), ε = 1 y re-armado X = 64 (contenido por defecto).
const UP = PlayerInput.of(0, -1);
const DOWN = PlayerInput.of(0, 1);
const RIGHT = PlayerInput.of(1, 0);
const building = (snaps: readonly RunSnapshot[]) => snaps.some((s) => s.status === 'building');
const NONE = { wood: 0, stone: 0 };
const option = (
  kind: 'house' | 'tower',
  cost: { wood: number; stone: number },
  have: { wood: number; stone: number },
) => ({
  kind,
  ...cost,
  affordable: have.wood >= cost.wood && have.stone >= cost.stone,
  missing: {
    wood: Math.max(0, cost.wood - have.wood),
    stone: Math.max(0, cost.stone - have.stone),
  },
});
const HOUSE = { wood: 15, stone: 0 };
const TOWER = { wood: 30, stone: 15 };
/** Solo el catálogo de personaje (los escenarios no llevan armas). */
const CHARACTER = { character: DEFAULT_CHARACTER_UPGRADES, weapons: [] };
/** El jugador en (1.260, 800), a g = 64 bajo la cara inferior. */
const BELOW = { x: 1260, y: 800 };

/** Partida del solar de prueba con el jugador tangente (toca en el tick 1) y estos recursos. */
const touching = (wood: number, stone = 0, config = aSiteConfig()): Run =>
  startWithSites(config, withStock(wood, stone));

describe('Solares de la partida (spec build-sites 0027)', () => {
  it('Scenario: Solares al crear la partida (semilla 42: libres, armados y sin acceso)', () => {
    const run = startSeededRun(aDefaultConfig(), 42);
    const s = run.snapshot();
    expect(s.sites).toHaveLength(6);
    expect(new Set(s.sites.map((x) => x.id)).size).toBe(6);
    expect(s.sites.every((x) => x.state === 'free' && x.armed)).toBe(true);
    expect(s.sites.some((x) => 'access' in x)).toBe(false);
    expect(run.map.sites.some((x) => 'access' in x)).toBe(false);
    for (const site of s.sites) {
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

describe('Apertura del solar con re-armado (spec build-sites 0027)', () => {
  it('Scenario: Se abre al tocar una cara', () => {
    const run = startWithSites(aSiteConfig(), { ...withStock(15), player: BELOW });
    const snaps = ticks(run, 100, UP);
    const n = snaps.findIndex((s) => gapOf(s) <= CONTACT_EPS);
    expect(n).toBeGreaterThan(0);
    expect(snaps.slice(0, n).every((s) => s.status === 'running')).toBe(true);
    const s = snaps[n];
    expect(s?.status).toBe('building');
    expect(s?.build.siteId).toBe(0);
    expect(s?.sites[0]?.armed).toBe(false);
  });

  it('Scenario: Se abre al tocar una esquina', () => {
    const d = 16 / Math.SQRT2;
    const player = { x: 1200 - d, y: 600 - d };
    const run = startWithSites(aSiteConfig(), { ...withStock(0), player });
    const [s] = ticks(run, 1);
    expect(Math.hypot(1200 - player.x, 600 - player.y)).toBeCloseTo(16, 3);
    expect(s?.status).toBe('building');
    expect(s?.build.siteId).toBe(0);
  });

  it.each([
    ['g = ε', 584 - CONTACT_EPS, true],
    ['g = 2', 582, false],
    ['g = 1,5', 582.5, false],
  ])('Scenario: Límite del contacto (%s)', (_name, y, opens) => {
    const run = startWithSites(aSiteConfig(), { ...withStock(15), player: { x: 1260, y } });
    const snaps = ticks(run, 600);
    expect(snaps[0]?.status === 'building').toBe(opens);
    expect(building(snaps)).toBe(opens);
    expect(snaps.at(-1)?.sites[0]?.armed).toBe(!opens);
  });

  it('Scenario: Se abre aunque nada sea asequible', () => {
    const [s] = ticks(touching(0, 0), 1);
    expect(s?.status).toBe('building');
    expect(s?.build.options).toEqual([option('house', HOUSE, NONE), option('tower', TOWER, NONE)]);
    expect(s?.build.options.some((o) => o.affordable)).toBe(false);
  });

  it.each([
    ['Asequibilidad con los recursos del mismo tick (build-sites)'],
    ['Solar abierto con los recursos del mismo tick (simulation-loop)'],
  ])('Scenario: %s', () => {
    // Un `wood` de valor 1 sobre el jugador: se recoge en el tick 1, el del primer contacto.
    const wood = { ...TOUCH, value: 1, kind: 'wood' as const };
    const run = startWithSites(aSiteConfig(), { ...withStock(14), gems: [wood] });
    const [s] = ticks(run, 1);
    expect(s?.resources.wood).toBe(15);
    expect(s?.status).toBe('building');
    expect(s?.build.options[0]).toMatchObject({ kind: 'house', affordable: true });
  });

  /** "Salir no reabre": abre en el tick 1 con g = 0, sale, 600 ticks quieto y 600 empujando. */
  const leftOnce = (config = aSiteConfig()) => {
    const run = startWithSites(config, withStock(15));
    expect(untilBuilding(run, 1)).toBe(1);
    leaveSiteIfOpen(run);
    const after = [...ticks(run, 600), ...ticks(run, 600, UP)];
    return { run, after };
  };

  it('Scenario: Salir no reabre', () => {
    const { after } = leftOnce();
    expect(after.every((s) => s.status === 'running')).toBe(true);
    expect([after.at(-1)?.player.x, after.at(-1)?.player.y]).toEqual([1260, 736]);
    expect(after.every((s) => s.sites[0]?.armed === false)).toBe(true);
  });

  it('Scenario: Volver sin alejarse lo suficiente (g = 63,9 y vuelta a tocar)', () => {
    // 6 px/s = 0,1 px por tick: 639 ticks hacia abajo dejan g = 63,9.
    const { run } = leftOnce(aSiteConfig({ player: { speed: 6 } }));
    const away = ticks(run, 639, DOWN);
    const back = ticks(run, 639, UP);
    const rest = ticks(run, 60, UP);
    expect(gapOf(away.at(-1))).toBeCloseTo(63.9, 6);
    expect(gapOf(back.at(-1))).toBeCloseTo(0, 6);
    expect(building([...away, ...back, ...rest])).toBe(false);
    expect(rest.at(-1)?.sites[0]?.armed).toBe(false);
  });

  it('Scenario: Volver tras alejarse (g ≥ 64 en a, primera g ≤ ε tras a en b)', () => {
    const { run } = leftOnce();
    const away = ticks(run, 64, DOWN);
    const a = away.at(-1);
    const back: RunSnapshot[] = [];
    while (run.status === 'running' && back.length < 200) back.push(...ticks(run, 1, UP));
    const b = back.at(-1);
    expect(gapOf(a)).toBe(64);
    expect(away.slice(0, -1).some((s) => s.sites[0]?.armed)).toBe(false);
    expect(a?.sites[0]?.armed).toBe(true);
    expect(b?.status).toBe('building');
    expect(gapOf(b)).toBeLessThanOrEqual(CONTACT_EPS);
    expect(back.slice(0, -1).every((s) => gapOf(s) > CONTACT_EPS && s.status === 'running')).toBe(
      true,
    );
  });

  it('Scenario: Re-armado medido desde cualquier lado (g = 64 de la cara derecha)', () => {
    const run = touching(15);
    untilBuilding(run, 1);
    leaveSiteIfOpen(run);
    // Rodea la esquina inferior derecha sin alejarse 64 y se aleja de la cara derecha.
    const around = [...ticks(run, 76, RIGHT), ...ticks(run, 76, UP), ...ticks(run, 63, RIGHT)];
    const [last] = ticks(run, 1, RIGHT);
    expect(around.every((s) => gapOf(s) < 64 && s.sites[0]?.armed === false)).toBe(true);
    expect([last?.player.x, last?.player.y]).toEqual([1400, 660]);
    expect(gapOf(last)).toBe(64);
    expect(last?.sites[0]?.armed).toBe(true);
    expect(building([...around, ...(last ? [last] : [])])).toBe(false);
  });

  it('Scenario: Oferta de mejora en el mismo tick', () => {
    const config = withUpgrades(aSiteConfig(), CHARACTER);
    const gem = { ...TOUCH, value: 9 };
    const run = startWithSites(config, { ...withStock(15), gems: [gem] });
    const [n] = ticks(run, 1);
    expect(n?.status).toBe('choosing');
    expect(n?.sites[0]?.armed).toBe(true);
    run.chooseUpgrade(0);
    const [next] = ticks(run, 1);
    expect(next?.status).toBe('building');
  });

  it('Scenario: Tienda y solar en el mismo tick', () => {
    // Huella en las columnas 17–18 y filas 16–17: x en [1.020, 1.140]; el jugador a g = 0 de su
    // cara izquierda y a 4 px de la puerta (1.000, 1.000).
    const config = withShop(aSiteConfig(), { radius: 40, rearmDistance: 300 });
    const run = startWithSites(
      config,
      { ...withStock(15), player: { x: 1004, y: 1000 }, shop: { armed: true } },
      [{ col: 17, row: 16 }],
      { door: { x: 1000, y: 1000 } },
    );
    const [n] = ticks(run, 1);
    expect(gapOf(n, { left: 1020, top: 960, right: 1140, bottom: 1080 })).toBe(0);
    expect(n?.status).toBe('shopping');
    expect(n?.sites[0]?.armed).toBe(true);
    run.leaveShop();
    expect(ticks(run, 1)[0]?.status).toBe('building');
  });

  it('Scenario: Dos solares a la vez', () => {
    // s2 (22, 12): x en [1.320, 1.440] e y en [720, 840]; toca a s1 solo en la esquina (1.320, 720).
    const run = startWithSites(aSiteConfig(), { ...withStock(15), player: { x: 1304, y: 736 } }, [
      TEST_SITE,
      { col: 22, row: 12 },
    ]);
    const [n] = ticks(run, 1);
    expect(n?.status).toBe('building');
    expect(n?.build.siteId).toBe(0);
    expect(n?.sites[1]?.armed).toBe(true);
    leaveSiteIfOpen(run);
    const [next] = ticks(run, 1);
    expect(next?.status).toBe('building');
    expect(next?.build.siteId).toBe(1);
  });

  it('Scenario: Sin oferta en el tick de la victoria (duración 120 ticks)', () => {
    // A 1 px por tick desde y = 857: la primera g ≤ ε es la del tick 120 (y = 737).
    const run = startWithSites(withDuration(aSiteConfig(), 2), {
      ...withStock(15),
      player: { x: 1260, y: 857 },
    });
    const snaps = ticks(run, 120, UP);
    expect(snaps.slice(0, 119).every((s) => gapOf(s) > CONTACT_EPS)).toBe(true);
    expect(gapOf(snaps[119])).toBeLessThanOrEqual(CONTACT_EPS);
    expect([snaps[119]?.status, snaps[119]?.outcome]).toEqual(['over', 'won']);
    expect(building(snaps)).toBe(false);
  });

  it('Scenario: Solar construido (se aleja a g = 400 y vuelve a tocar)', () => {
    const run = startWithSites(aSiteConfig(), {
      ...withStock(100, 100),
      sites: [{ state: 'house' }],
    });
    const away = ticks(run, 400, DOWN);
    const back = ticks(run, 400, UP);
    const rest = ticks(run, 60, UP);
    expect(gapOf(away.at(-1))).toBe(400);
    expect(gapOf(back.at(-1))).toBe(0);
    expect(building([...away, ...back, ...rest])).toBe(false);
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

describe('Oferta de obra (spec build-sites 0027)', () => {
  it('Scenario: Oferta en el snapshot (s2, madera 40 y piedra 20, 600 ticks pedidos)', () => {
    // s2 (20, 20): y en [1.200, 1.320]; el jugador tangente a su cara inferior.
    const run = startWithSites(
      aSiteConfig(),
      { ...withStock(40, 20), player: { x: 1260, y: 1336 } },
      [TEST_SITE, { col: 20, row: 20 }],
    );
    untilBuilding(run, 5);
    const first = run.snapshot();
    const during = ticks(run, 600, RIGHT);
    const have = { wood: 40, stone: 20 };
    expect(first.build).toEqual({
      open: true,
      siteId: 1,
      options: [option('house', HOUSE, have), option('tower', TOWER, have)],
    });
    expect(first.build.options.every((o) => o.affordable)).toBe(true);
    expect(during.every((s) => JSON.stringify(s.build) === JSON.stringify(first.build))).toBe(true);
  });

  it('Scenario: La torre no asequible por la piedra (madera 30 y piedra 14)', () => {
    const run = touching(30, 14);
    untilBuilding(run, 1);
    expect(run.snapshot().build.options).toEqual([
      { kind: 'house', wood: 15, stone: 0, affordable: true, missing: { wood: 0, stone: 0 } },
      { kind: 'tower', wood: 30, stone: 15, affordable: false, missing: { wood: 0, stone: 1 } },
    ]);
  });

  it('Scenario: Coste exacto (madera 30 y piedra 15)', () => {
    const run = touching(30, 15);
    untilBuilding(run, 1);
    expect(run.snapshot().build.options.map((o) => o.affordable)).toEqual([true, true]);
  });

  it('Scenario: Solo la torre asequible', () => {
    const config = withCosts(aSiteConfig(), { wood: 20, stone: 0 }, { wood: 10, stone: 5 });
    const run = touching(12, 5, config);
    untilBuilding(run, 1);
    expect(run.snapshot().build.options).toEqual([
      { kind: 'house', wood: 20, stone: 0, affordable: false, missing: { wood: 8, stone: 0 } },
      { kind: 'tower', wood: 10, stone: 5, affordable: true, missing: { wood: 0, stone: 0 } },
    ]);
  });

  it('Scenario: Madera a 1 de la casa (madera 14 y piedra 100)', () => {
    const run = touching(14, 100);
    const [s] = ticks(run, 1);
    expect(s?.status).toBe('building');
    expect(s?.build.options.map((o) => [o.kind, o.affordable])).toEqual([
      ['house', false],
      ['tower', false],
    ]);
  });

  it('Scenario: Sin oferta fuera de la obra (en curso, eligiendo, en tienda y terminado)', () => {
    const closed = { open: false, siteId: null, options: [] };
    const runningRun = startWithSites(aSiteConfig(), withStock(0));
    const choosing = startWithSites(withUpgrades(aSiteConfig(), CHARACTER), {
      gems: [{ ...TOUCH, value: 9 }],
    });
    ticks(choosing, 1);
    const shopping = startWithSites(
      withShop(aSiteConfig(), { radius: 40, rearmDistance: 300 }),
      { player: { x: 1010, y: 995 }, shop: { armed: true } },
      [],
      { door: { x: 1000, y: 1000 } },
    );
    ticks(shopping, 1);
    const over = startWithSites(withDuration(aSiteConfig(), 1), withStock(0), []);
    ticks(over, 60);
    const snaps = [runningRun, choosing, shopping, over].map((r) => r.snapshot());
    expect(snaps.map((s) => s.status)).toEqual(['running', 'choosing', 'shopping', 'over']);
    expect(snaps.every((s) => JSON.stringify(s.build) === JSON.stringify(closed))).toBe(true);
  });
});

// Spec build-sites 0027, "Solar libre que bloquea el paso": marcar las huellas al crear la partida no
// consume azar.
describe('Marcado de las huellas (spec build-sites 0027)', () => {
  it('Scenario: Marcar no consume azar (semilla 7, mapa vacío, con el solar de prueba y sin él)', () => {
    const created = (withSite: boolean) => {
      const seeding = seededRun(7, 'empty');
      const random = new CountingRandom(seeding.random);
      const stones = new CountingRandom(seeding.stoneRandom);
      const sheep = new CountingRandom(sheepRandom(7));
      const terrain: TerrainSource = {
        kind: 'open',
        sites: withSite ? [TEST_SITE] : [],
        sheep: { at: [{ x: 3000, y: 1800 }], random: sheep },
      };
      const r = Run.start(aDefaultConfig(), random, {}, terrain, stones);
      if (!r.ok) throw new Error(r.error.message);
      expect(r.value.snapshot().sites).toHaveLength(withSite ? 1 : 0);
      // Estado de cada generador: valores consumidos y el siguiente que daría.
      return [random, sheep, stones].map((g) => [g.calls, g.next()]);
    };
    expect(created(true)).toEqual(created(false));
  });
});
