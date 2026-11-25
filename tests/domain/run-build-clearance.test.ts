import { describe, expect, it } from 'vitest';
import { Arena } from '../../src/domain/arena/Arena';
import { EnemyCatalog } from '../../src/domain/enemy/EnemyCatalog';
import { GuardPost } from '../../src/domain/enemy/GuardPost';
import { GameMap } from '../../src/domain/map/GameMap';
import { PickupField } from '../../src/domain/pickup/PickupField';
import { PickupRules } from '../../src/domain/pickup/PickupRules';
import { Flock } from '../../src/domain/sheep/Flock';
import { SheepRules } from '../../src/domain/sheep/SheepRules';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { Run } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  CONTENT_SHEEP,
  LINTER,
  LONG_RUN_HEALTH,
  SCENARIO_ENEMY_TYPES,
  aBarrelType,
  aDefaultConfig,
  aSegment,
  inState,
  withWeapons,
} from '../support/builders';
import { aCampScenario, aGuardAt, aGuardType } from '../support/camps';
import { cellsWith, mapRules } from '../support/mapLayouts';
import { CountingRandom, StubRandom } from '../support/random';
import { ticks } from '../support/runs';
import { declaredSheep } from '../support/sheep';
import {
  FOOTPRINT,
  TEST_ACCESS,
  TEST_SITE,
  TEST_SITE_RECT,
  aSiteConfig,
  buildNow,
  leaveSiteIfOpen,
  startWithSites,
  untilBuilding,
  withSiteAccess,
  withStock,
} from '../support/sites';

// Spec build-sites 0026, "Huella despejada al construir", "Edificios que bloquean el paso" y
// "Edificios indestructibles y fuera del combate"; enemy-behavior, "Navegación con edificios
// construidos". Solar de prueba: huella (20..21, 10..11), x en [1.200, 1.320] e y en [600, 720];
// acceso P = (1.260, 810), donde está quieto el jugador (la obra se abre en el tick 1).
const P = TEST_ACCESS;
const TORCH = SCENARIO_ENEMY_TYPES.filter((t) => t.id === 'goblin-torch');
const torchConfig = (o: Parameters<typeof aSiteConfig>[0] = {}): RunConfig =>
  aSiteConfig({ ...o, player: { maxHealth: LONG_RUN_HEALTH, ...o.player } }, TORCH);
const inFootprint = (x: number, y: number) =>
  x >= TEST_SITE_RECT.left &&
  x < TEST_SITE_RECT.right &&
  y >= TEST_SITE_RECT.top &&
  y < TEST_SITE_RECT.bottom;
const overlapsFootprint = (x: number, y: number, r: number) => {
  const ex = Math.max(TEST_SITE_RECT.left - x, 0, x - TEST_SITE_RECT.right);
  const ey = Math.max(TEST_SITE_RECT.top - y, 0, y - TEST_SITE_RECT.bottom);
  return ex * ex + ey * ey < r * r - 1e-6;
};
const isCellCenter = (x: number, y: number) => x % 60 === 30 && y % 60 === 30;

/** Partida del solar de prueba con el jugador en P, en obra desde el tick 1. */
function openAtP(config: RunConfig, setup: Parameters<typeof startWithSites>[1] = {}): Run {
  const run = startWithSites(config, { player: P, ...withStock(30, 15), ...setup });
  untilBuilding(run, 1);
  return run;
}

describe('Huella despejada al construir (spec build-sites 0026)', () => {
  it('Scenario: Enemigo dentro de la huella', () => {
    const run = openAtP(torchConfig(), {
      enemies: [
        { type: 'goblin-torch', x: 3000, y: 2000 },
        { type: 'goblin-torch', x: 1230, y: 630, health: 7 },
      ],
    });
    const before = run.snapshot().enemies;
    expect(inFootprint(before[1]?.x ?? 0, before[1]?.y ?? 0)).toBe(true);
    const s = buildNow(run, 'house');
    const x = s.enemies[1];
    expect(s.enemies.map((e) => e.id)).toEqual(before.map((e) => e.id));
    expect([x?.health, x?.state, x?.stateKind]).toEqual([7, 'chase', 'chase']);
    expect(inFootprint(x?.x ?? 1260, x?.y ?? 660)).toBe(false);
    expect(isCellCenter(x?.x ?? 0, x?.y ?? 0)).toBe(true);
    expect(s.enemies[0]).toEqual(before[0]);
  });

  it('Scenario: Recogibles dentro de la huella (torre)', () => {
    const run = openAtP(aSiteConfig(), {
      gems: [
        { x: 1290, y: 690, value: 3, kind: 'wood' },
        { x: 1230, y: 615, value: 2, kind: 'xp', attracted: true },
      ],
    });
    const before = run.snapshot().pickups;
    expect(before.every((p) => inFootprint(p.x, p.y))).toBe(true);
    const s = buildNow(run, 'tower');
    const strip = (l: RunSnapshot['pickups']) => l.map((p) => [p.id, p.kind, p.value]);
    expect(strip(s.pickups)).toEqual(strip(before));
    expect(s.pickups.some((p) => inFootprint(p.x, p.y))).toBe(false);
    expect(s.pickups.every((p) => isCellCenter(p.x, p.y))).toBe(true);
  });

  it('Scenario: Oveja que solapa la huella (y su origen en otra celda)', () => {
    const flock = declaredSheep([{ x: 1330, y: 650 }]);
    const run = startWithSites(
      aSiteConfig(),
      { player: P, ...withStock(15), sheep: [{ origin: { x: 1230, y: 630 } }] },
      [TEST_SITE],
      flock.kind === 'open' && flock.sheep ? { sheep: flock.sheep } : {},
    );
    untilBuilding(run, 1);
    const sheep = run.snapshot().sheep[0];
    expect(overlapsFootprint(sheep?.x ?? 0, sheep?.y ?? 0, sheep?.radius ?? 0)).toBe(true);
    const s = buildNow(run, 'house');
    const o = s.sheep[0];
    expect(overlapsFootprint(o?.x ?? 1260, o?.y ?? 660, o?.radius ?? 18)).toBe(false);
    expect(inFootprint(o?.origin.x ?? 1260, o?.origin.y ?? 660)).toBe(false);
    expect(isCellCenter(o?.origin.x ?? 0, o?.origin.y ?? 0)).toBe(true);
    const after = ticks(run, 600);
    expect(after.some((x) => x.sheep.some((q) => overlapsFootprint(q.x, q.y, q.radius)))).toBe(
      false,
    );
  });

  it('Scenario: Punto de patrulla dentro de la huella (GuardPost.evict)', () => {
    const config = aCampScenario();
    const arena = Arena.create(config.arena.width, config.arena.height);
    if (!arena.ok) throw new Error(arena.error.message);
    const catalog = EnemyCatalog.create([aGuardType()], arena.value);
    const guard = catalog.ok ? catalog.value.get('guard') : undefined;
    if (!guard) throw new Error('sin guardia');
    const map = GameMap.open(mapRules());
    // Puesto en (1.890, 810): la esquina 1 de la patrulla (radio 60) es (1.950, 750), celda (32, 12).
    const post = new GuardPost(1890, 810, guard, map, arena.value);
    const patrol = guard.behavior.names.indexOf('patrol');
    map.build(32, 11, FOOTPRINT.cols, FOOTPRINT.rows);
    post.evict(map);
    expect([post.pointX(patrol, 1), post.pointY(patrol, 1)]).toEqual([1890, 750]);
    expect([post.pointX(patrol, 0), post.pointY(patrol, 0)]).toEqual([1830, 750]);
    const out = { x: 0, y: 0 };
    post.steer(patrol, 1, 1800, 750, out);
    expect(out).toEqual({ x: 1890, y: 750 });
  });

  it('Scenario: Punto de patrulla dentro de la huella (partida, 1.200 ticks)', () => {
    const base = aCampScenario({ player: { speed: 210 } });
    const types = base.enemies.types.map((t) =>
      t.id === 'guard' ? aGuardType({ detect: 5, lose: 10 }) : t,
    );
    const config = withSiteAccess({ ...base, enemies: { ...base.enemies, types } });
    const site = { col: 32, row: 11 };
    // La casa goblin (30..31, 10..12), con puerta en (1.890, 810), declarada en el mapa vacío.
    const r = startWithSites(
      config,
      {
        player: { x: 1980, y: 870 },
        ...withStock(30, 15),
        enemies: [aGuardAt(1890, 810, { house: 0 })],
      },
      [site],
      { structures: [{ type: 'goblin-house', col: 30, row: 10, cols: 2, rows: 3 }] },
    );
    untilBuilding(r, 1);
    buildNow(r, 'tower');
    const path = ticks(r, 1200, PlayerInput.of(1, 1));
    const built = (x: number, y: number) => x >= 1920 && x < 2040 && y >= 660 && y < 780;
    expect(path.some((s) => s.enemies.some((e) => built(e.x, e.y)))).toBe(false);
    expect(path.some((s) => s.enemies.some((e) => e.x === 1890 && e.y === 750))).toBe(true);
  });

  it('Scenario: Despejar no consume azar (semilla 7)', () => {
    const counted = (inside: boolean) => {
      const random = new CountingRandom(new Mulberry32RandomGenerator(7));
      const at = inside ? { x: 1230, y: 630 } : { x: 2500, y: 1500 };
      const run = startWithSites(
        torchConfig(),
        {
          player: P,
          ...withStock(15),
          enemies: [0, 1, 2].map((i) => ({ type: 'goblin-torch', x: at.x + 20 * i, y: at.y })),
          gems: [0, 1].map((i) => ({ x: at.x + 30 * i, y: at.y + 40, value: 1 })),
        },
        [TEST_SITE],
        { random },
      );
      untilBuilding(run, 1);
      buildNow(run, 'house');
      return random.calls;
    };
    expect(counted(true)).toBe(counted(false));
  });
});

describe('Edificios que bloquean el paso, en la partida (spec build-sites 0026)', () => {
  /** Torch en E = (1.260, 300), arriba de la huella; P bajo ella: el segmento E–P la cruza. */
  const chaseRun = (build: boolean) => {
    const run = openAtP(torchConfig(), { enemies: [{ type: 'goblin-torch', x: 1260, y: 300 }] });
    if (build) buildNow(run, 'house');
    else leaveSiteIfOpen(run);
    return ticks(run, 3600);
  };
  const reachedAt = (snaps: readonly RunSnapshot[]) =>
    snaps.findIndex((s) => {
      const e = s.enemies[0];
      return !!e && Math.abs(e.x - P.x) <= 0.001 && Math.abs(e.y - P.y) <= 0.001;
    });

  it.each([
    ['El enemigo rodea el edificio nuevo (build-sites)'],
    ['El campo se recalcula y el enemigo rodea (enemy-behavior)'],
  ])('Scenario: %s', () => {
    const without = chaseRun(false);
    const withHouse = chaseRun(true);
    const at = (s: RunSnapshot) => s.enemies[0] ?? { x: 0, y: 0 };
    expect(without.some((s) => inFootprint(at(s).x, at(s).y))).toBe(true);
    expect(withHouse.some((s) => inFootprint(at(s).x, at(s).y))).toBe(false);
    // Sin línea libre en el tick n + 1: no avanza en recta hacia P (x = 1.260).
    expect(withHouse[0]?.enemies[0]?.x).not.toBe(1260);
    expect(reachedAt(withHouse)).toBeGreaterThan(reachedAt(without));
    expect(reachedAt(without)).toBeGreaterThan(0);
  });

  it('Scenario: Campo recalculado con el jugador en la misma celda', () => {
    // Troncos en (21, 9) y (20, 12): el torch en (20, 9) no tiene línea libre y su siguiente
    // celda en el tick 1 es (20, 10), de la huella. Tras la casa, la siguiente es (19, 9).
    const rules = mapRules();
    const cells = cellsWith(rules, { '21,9': 'trunk', '20,12': 'trunk' });
    const run = startWithSites(
      torchConfig(),
      { player: P, ...withStock(15), enemies: [{ type: 'goblin-torch', x: 1230, y: 570 }] },
      [TEST_SITE],
      { cells },
    );
    untilBuilding(run, 1);
    const n = run.snapshot().enemies[0];
    expect(n?.x).toBeCloseTo(1230, 6);
    expect(n?.y).toBeGreaterThan(570);
    buildNow(run, 'house');
    const next = ticks(run, 1)[0]?.enemies[0];
    expect(next?.x).toBeLessThan(n?.x ?? 0);
    expect(next?.y).toBeLessThanOrEqual(n?.y ?? 0);
  });

  it('Scenario: Aparición sobre el edificio (torre; 1 valor del azar por intento)', () => {
    // Azar fijo 0,75: ángulo 3π/2, punto (1.260, 660) desde P con el anillo de 150, en la huella.
    const calls = (build: boolean) => {
      const base = aSiteConfig({ segments: [aSegment(['probe'], 1)] });
      const config = {
        ...base,
        waves: { ...base.waves, spawn: { ringRadius: 150, minDistance: 0, maxAttempts: 8 } },
      };
      const random = new CountingRandom(new StubRandom(0.75));
      const run = startWithSites(config, { player: P, ...withStock(30, 15) }, [TEST_SITE], {
        random,
      });
      untilBuilding(run, 1);
      if (build) buildNow(run, 'tower');
      else leaveSiteIfOpen(run);
      let before = random.calls;
      for (let t = 0; t < 120 && run.snapshot().enemies.length === 0; t++) {
        before = random.calls;
        run.tick(PlayerInput.NONE);
      }
      return { enemy: run.snapshot().enemies[0], consumed: random.calls - before };
    };
    const onTower = calls(true);
    const free = calls(false);
    expect([free.enemy?.x, free.enemy?.y]).toEqual([1260, 660]);
    expect(inFootprint(onTower.enemy?.x ?? 1260, onTower.enemy?.y ?? 660)).toBe(false);
    expect(isCellCenter(onTower.enemy?.x ?? 0, onTower.enemy?.y ?? 0)).toBe(true);
    // 1 valor para el tipo del director y 1 por el único intento, igual que sin edificio.
    expect(onTower.consumed).toBe(2);
    expect(free.consumed).toBe(2);
  });

  it('Scenario: Recogible creado sobre el edificio (suelta en la huella de una casa)', () => {
    const config = aDefaultConfig();
    const rules = PickupRules.create(config.progression);
    if (!rules.ok) throw new Error(rules.error.message);
    const map = GameMap.open(mapRules());
    map.build(TEST_SITE.col, TEST_SITE.row, FOOTPRINT.cols, FOOTPRINT.rows);
    const field = new PickupField(rules.value, map);
    field.drop('xp', 1230, 630, 1);
    const gem = field.pickups[0];
    expect(inFootprint(gem?.x ?? 1260, gem?.y ?? 660)).toBe(false);
    expect(isCellCenter(gem?.x ?? 0, gem?.y ?? 0)).toBe(true);
  });
});

describe('Reaparición de ovejas con edificios (spec build-sites 0026, "Edificios que bloquean")', () => {
  it('una celda base de reaparición que solapa la obra deja de ser candidata', () => {
    const rules = SheepRules.create(CONTENT_SHEEP);
    if (!rules.ok) throw new Error(rules.error.message);
    const map = GameMap.open(mapRules());
    // Celdas base: (20, 10), de la huella, y (40, 10), libre; azar fijo 0 ⇒ la primera candidata.
    const cells = [10 * 64 + 20, 10 * 64 + 40];
    const flock = new Flock(rules.value, [{ x: 600, y: 600 }], 1, new StubRandom(0), {
      map,
      cells,
    });
    map.build(TEST_SITE.col, TEST_SITE.row, FOOTPRINT.cols, FOOTPRINT.rows);
    flock.all[0]?.takeDamage(1e6, 1);
    flock.settle(1, () => undefined);
    flock.respawn(1 + CONTENT_SHEEP.respawn.everyTicks, 3000, 2000);
    expect([flock.all[0]?.x, flock.all[0]?.y]).toEqual([40 * 60 + 30, 630]);
  });
});

describe('Edificios indestructibles y fuera del combate (regresión, spec build-sites 0026)', () => {
  it('Scenario: Explosión junto a una casa', () => {
    const barrel = aBarrelType({ blastRadius: 200, fuseTicks: 30 });
    const config = aSiteConfig({ player: { maxHealth: 1000 } }, [barrel]);
    const run = openAtP(config, {
      enemies: [{ type: 'goblin-barrel', x: 1340, y: 660, ...inState('fuse') }],
    });
    buildNow(run, 'house');
    const after = ticks(run, 630);
    expect(after.some((s) => s.blasts.length > 0)).toBe(true);
    expect(after.every((s) => s.sites[0]?.state === 'house' && s.structures.length === 0)).toBe(
      true,
    );
    // Sus celdas siguen sin poder pisarse: hacia arriba, el jugador queda tangente a y = 720.
    const up = ticks(run, 120, PlayerInput.of(0, -1));
    expect(up.at(-1)?.player.y).toBeCloseTo(736, 3);
  });

  it('Scenario: El Linter no apunta a un edificio', () => {
    const weapons = { maxProjectiles: 32, hitFlashTicks: 4, weapons: [LINTER] };
    const run = openAtP(withWeapons(aSiteConfig(), weapons));
    buildNow(run, 'house');
    const snaps = ticks(run, 60);
    expect(snaps.every((s) => s.projectiles.length === 0)).toBe(true);
  });
});
