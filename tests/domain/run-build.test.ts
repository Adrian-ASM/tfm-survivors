import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { Run } from '../../src/domain/run/Run';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  DEFAULT_CHARACTER_UPGRADES,
  aDefaultConfig,
  aSegment,
  withDuration,
  withShop,
  withUpgrades,
} from '../support/builders';
import { MAP_GOLDEN, signatureOf } from '../support/mapGolden';
import { CountingRandom } from '../support/random';
import { advance, startSeededRun, ticks } from '../support/runs';
import { declaredSheep, sheepRandom } from '../support/sheep';
import {
  TEST_SITE,
  TOUCH,
  aSiteConfig,
  buildNow,
  leaveSiteIfOpen,
  startWithSites,
  untilBuilding,
  withStock,
} from '../support/sites';

// Spec build-sites 0026 y 0027, "Construcción en el solar" y "Salida de la obra sin construir"; resources,
// "Contadores de oro y madera" y "Contador de piedra"; run-state, "Estado de la partida".
const UP = PlayerInput.of(0, -1);
const RIGHT = PlayerInput.of(1, 0);
const LEFT = PlayerInput.of(-1, 0);
const CHARACTER = { character: DEFAULT_CHARACTER_UPGRADES, weapons: [] };

/** Partida en obra en el solar de prueba (abierta en el tick 1) con estos recursos. */
function inSite(wood: number, stone = 0, gold = 0, config = aSiteConfig()): Run {
  const run = startWithSites(config, withStock(wood, stone, gold));
  untilBuilding(run, 1);
  return run;
}

/** Las cuatro partidas "fuera de la obra": en curso, eligiendo mejora, en tienda y terminada. */
function outsideTheSite(): Run[] {
  const running = startWithSites(aSiteConfig(), {
    ...withStock(100, 100),
    player: { x: 3000, y: 2000 },
  });
  const choosing = startWithSites(withUpgrades(aSiteConfig(), CHARACTER), {
    ...withStock(100, 100),
    gems: [{ ...TOUCH, value: 9 }],
  });
  ticks(choosing, 1);
  const shopping = startWithSites(
    withShop(aSiteConfig(), { radius: 40, rearmDistance: 300 }),
    { ...withStock(100, 100), player: { x: 1010, y: 995 }, shop: { armed: true } },
    [],
    { door: { x: 1000, y: 1000 } },
  );
  ticks(shopping, 1);
  const over = startWithSites(withDuration(aSiteConfig(), 1), {
    ...withStock(100, 100),
    player: { x: 3000, y: 2000 },
  });
  ticks(over, 60);
  const all = [running, choosing, shopping, over];
  expect(all.map((r) => r.status)).toEqual(['running', 'choosing', 'shopping', 'over']);
  return all;
}

describe('Construcción en el solar (spec build-sites 0027)', () => {
  it('Scenario: Construir una casa', () => {
    const run = inSite(20, 7, 3);
    const n = run.snapshot().tick;
    const s = buildNow(run, 'house');
    expect(s.resources).toEqual({ gold: 3, wood: 5, stone: 7 });
    expect(s.sites[0]?.state).toBe('house');
    expect([s.status, s.tick, s.build.open]).toEqual(['running', n, false]);
  });

  it('Scenario: Construir una torre con el coste exacto', () => {
    const s = buildNow(inSite(30, 15), 'tower');
    expect([s.resources.wood, s.resources.stone, s.sites[0]?.state]).toEqual([0, 0, 'tower']);
  });

  it('Scenario: Torre no asequible (madera 30, piedra 14: en la oferta, no asequible)', () => {
    const run = inSite(30, 14);
    const before = run.snapshot();
    expect(before.build.options[1]).toMatchObject({ kind: 'tower', affordable: false });
    const r = run.build('tower');
    expect(r).toEqual({ ok: false, error: { code: 'not-affordable', kind: 'tower' } });
    expect(run.snapshot()).toEqual(before);
    expect(run.status).toBe('building');
  });

  it('Scenario: Nada asequible (madera 0 y piedra 0)', () => {
    const run = inSite(0, 0);
    const before = run.snapshot();
    expect(run.build('house')).toEqual({
      ok: false,
      error: { code: 'not-affordable', kind: 'house' },
    });
    expect(run.build('tower')).toEqual({
      ok: false,
      error: { code: 'not-affordable', kind: 'tower' },
    });
    expect(run.snapshot()).toEqual(before);
    expect(run.status).toBe('building');
    expect(run.leaveSite().ok).toBe(true);
    expect(run.status).toBe('running');
  });

  it('Scenario: Tipo desconocido (castle)', () => {
    const run = inSite(100, 100);
    const before = run.snapshot();
    expect(run.build('castle')).toEqual({
      ok: false,
      error: { code: 'unknown-kind', kind: 'castle' },
    });
    expect(run.snapshot()).toEqual(before);
  });

  it('Scenario: Construir fuera de la obra', () => {
    for (const run of outsideTheSite()) {
      const before = run.snapshot();
      expect(run.build('house')).toEqual({ ok: false, error: { code: 'not-building' } });
      expect(run.snapshot()).toEqual(before);
    }
  });

  it('Scenario: Un solo edificio por visita', () => {
    const run = inSite(100, 100);
    expect(run.build('house').ok).toBe(true);
    expect(run.build('tower').ok).toBe(false);
    expect(run.snapshot().resources.wood).toBe(85);
  });

  it('Scenario: Construir no consume azar (semilla 7)', () => {
    const counted = (build: boolean) => {
      const random = new CountingRandom(new Mulberry32RandomGenerator(7));
      const stones = new CountingRandom(new Mulberry32RandomGenerator(8));
      const sheep = new CountingRandom(sheepRandom(7));
      const flock = declaredSheep([{ x: 3000, y: 1800 }], { random: sheep });
      const run = startWithSites(aSiteConfig(), withStock(15), [TEST_SITE], {
        random,
        stoneRandom: stones,
        ...(flock.kind === 'open' && flock.sheep ? { sheep: flock.sheep } : {}),
      });
      untilBuilding(run, 1);
      if (build) buildNow(run, 'house');
      else leaveSiteIfOpen(run);
      return [random.calls, sheep.calls, stones.calls];
    };
    expect(counted(true)).toEqual(counted(false));
  });

  it.each([
    ['La madera baja al construir (resources)', 22, 0, 9, 'house', [9, 7, 0]],
    ['La piedra baja al construir una torre (resources)', 31, 16, 0, 'tower', [0, 1, 1]],
    ['La casa no gasta piedra (resources)', 15, 15, 0, 'house', [0, 0, 15]],
  ] as const)('Scenario: %s', (_name, wood, stone, gold, kind, [g, w, st]) => {
    const s = buildNow(inSite(wood, stone, gold), kind);
    expect([s.resources.gold, s.resources.wood, s.resources.stone]).toEqual([g, w, st]);
  });

  it('Scenario: La madera baja al construir (con madera 14 la casa no es asequible)', () => {
    // 0027: la oferta se abre siempre; "no se ofrece" (resources 0026) se lee como no asequible.
    const run = inSite(14);
    expect(run.snapshot().build.options[0]).toMatchObject({ kind: 'house', affordable: false });
    expect(run.build('house').ok).toBe(false);
    expect(run.snapshot().resources.wood).toBe(14);
  });

  it('Scenario: Construcciones distintas divergen (simulation-loop)', () => {
    const house = buildNow(inSite(30, 15), 'house');
    const tower = buildNow(inSite(30, 15), 'tower');
    expect(house.sites).not.toEqual(tower.sites);
    expect([house.resources.stone, tower.resources.stone]).toEqual([15, 0]);
  });

  it('el edificio bloquea al jugador desde el tick siguiente (choca con la cara inferior)', () => {
    const run = startWithSites(aSiteConfig(), { ...withStock(15), player: TOUCH });
    untilBuilding(run, 1);
    buildNow(run, 'house');
    const path = ticks(run, 120, UP);
    expect(path.at(-1)?.player.y).toBeCloseTo(720 + 16, 3);
  });
});

describe('Salida de la obra sin construir (spec build-sites 0026)', () => {
  it('Scenario: Salir y seguir', () => {
    const run = inSite(15);
    const n = run.snapshot().tick;
    expect(run.leaveSite().ok).toBe(true);
    const s = run.snapshot();
    expect([s.status, s.tick]).toEqual(['running', n]);
    expect(ticks(run, 1)[0]?.tick).toBe(n + 1);
  });

  it('Scenario: Salir fuera de la obra', () => {
    for (const run of outsideTheSite()) {
      const before = run.snapshot();
      expect(run.leaveSite()).toEqual({ ok: false, error: { code: 'not-building' } });
      expect(run.snapshot()).toEqual(before);
    }
  });

  it('Scenario: Visita sin construir (semilla 7)', () => {
    const config = aSiteConfig({ segments: [aSegment(['probe'], 1)] });
    const start = () =>
      startWithSites(config, withStock(15), [TEST_SITE], {
        random: new Mulberry32RandomGenerator(7),
      });
    const a = start();
    const b = start();
    untilBuilding(a, 1);
    untilBuilding(b, 1);
    leaveSiteIfOpen(a);
    ticks(b, 600, RIGHT);
    leaveSiteIfOpen(b);
    expect(JSON.stringify(ticks(a, 600, LEFT))).toBe(JSON.stringify(ticks(b, 600, LEFT)));
  });
});

describe('Lista de solares y estado de la partida con edificios', () => {
  it('Scenario: Lista estable (s2 con casa y 600 ticks)', () => {
    const sites = [{ col: 10, row: 10 }, TEST_SITE, { col: 40, row: 10 }];
    const run = startWithSites(aSiteConfig(), withStock(15), sites);
    untilBuilding(run, 1);
    expect(run.snapshot().build.siteId).toBe(1);
    buildNow(run, 'house');
    const snaps = ticks(run, 600);
    const expected = [
      [0, 'free'],
      [1, 'house'],
      [2, 'free'],
    ];
    expect(
      snaps.every(
        (s) => JSON.stringify(s.sites.map((x) => [x.id, x.state])) === JSON.stringify(expected),
      ),
    ).toBe(true);
  });

  it('Scenario: Snapshot de los solares no mutable desde fuera (simulation-loop)', () => {
    const run = startWithSites(aSiteConfig(), { ...withStock(0), player: { x: 3000, y: 2000 } });
    ticks(run, 10);
    const s = run.snapshot();
    const site = s.sites[0] as { state: string; armed: boolean; house: { col: number } };
    try {
      site.state = 'house';
      site.armed = false;
      site.house.col = 0;
    } catch {
      // Congelado: el adaptador no puede cambiarlo.
    }
    const [next] = ticks(run, 1);
    expect([next?.tick, next?.sites[0]?.state, next?.sites[0]?.armed]).toEqual([11, 'free', true]);
    expect(next?.sites[0]?.house).toEqual({ col: 20, row: 10, cols: 2, rows: 2 });
    expect(Object.isFrozen(s.sites) && Object.isFrozen(s.sites[0])).toBe(true);
  });

  it('Scenario: Obra abierta justo antes del tick de la victoria (duración 120)', () => {
    // A 1 px por tick desde y = 856: la primera g ≤ ε es la del tick 119 (y = 737).
    const run = startWithSites(withDuration(aSiteConfig(), 2), {
      ...withStock(15),
      player: { x: 1260, y: 856 },
    });
    expect(untilBuilding(run, 200, UP)).toBe(119);
    const during = ticks(run, 600, UP);
    expect(during.every((s) => s.status === 'building' && s.tick === 119)).toBe(true);
    buildNow(run, 'house');
    const [end] = ticks(run, 1, UP);
    expect([end?.status, end?.outcome, end?.tick]).toEqual(['over', 'won', 120]);
  });

  it('Scenario: En obra y vuelta a en curso (construir y salir)', () => {
    const a = inSite(15);
    const b = inSite(15);
    expect([a.snapshot().status, b.snapshot().status]).toEqual(['building', 'building']);
    buildNow(a, 'house');
    leaveSiteIfOpen(b);
    const after = [a.snapshot(), b.snapshot()];
    expect(after.map((s) => [s.status, s.outcome])).toEqual([
      ['running', null],
      ['running', null],
    ]);
  });

  it.each([
    ['Tipos constantes con edificios (procedural-map)'],
    ['El tipo de las celdas no cambia (build-sites)'],
  ])('Scenario: %s (semilla 42, casa en su primer solar)', () => {
    const config = aDefaultConfig();
    const run0 = startSeededRun(config, 42).map;
    const first = run0.sites[0];
    if (!first) throw new Error('sin solares');
    const run = startSeededRun(config, 42, 'generated', {
      player: { x: first.x, y: (first.row + first.rows) * run0.cellSize + 16 },
      resources: { gold: 0, wood: 15, stone: 0 },
    });
    const atStart = [...run.map.cells];
    untilBuilding(run, 1);
    buildNow(run, 'house');
    const afterBuild = [...run.map.cells];
    advance(run, 36_000);
    expect(run.status).toBe('over');
    expect([...run.map.cells]).toEqual(atStart);
    expect(afterBuild).toEqual(atStart);
    expect(signatureOf(run.map.cells)).toBe(MAP_GOLDEN[42]);
    for (let r = first.row; r < first.row + first.rows; r++)
      for (let c = first.col; c < first.col + first.cols; c++)
        expect(run.map.cells[r * 64 + c]).toBe('grass');
  });
});
