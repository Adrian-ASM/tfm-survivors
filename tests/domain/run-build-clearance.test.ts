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
  aStillType,
  inState,
  withSheep,
  withWeapons,
} from '../support/builders';
import { aCampScenario, aGuardAt, aGuardType } from '../support/camps';
import { cellsWith, mapRules } from '../support/mapLayouts';
import { CountingRandom, StubRandom } from '../support/random';
import { advance, ticks } from '../support/runs';
import { declaredSheep } from '../support/sheep';
import {
  FOOTPRINT,
  TEST_SITE,
  TEST_SITE_RECT,
  aSiteConfig,
  buildNow,
  leaveSiteIfOpen,
  startWithSites,
  TOUCH,
  touchPoint,
  untilBuilding,
  withStock,
} from '../support/sites';

// Spec build-sites 0026, "Huella despejada al construir", "Edificios que bloquean el paso" y
// "Edificios indestructibles y fuera del combate"; enemy-behavior, "Navegación con edificios
// construidos". Solar de prueba: huella (20..21, 10..11), x en [1.200, 1.320] e y en [600, 720];
// P = (1.260, 736), tangente a la cara inferior, donde está quieto el jugador (la obra se abre en el
// tick 1).
const P = TOUCH;
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

  it('Scenario: Oveja tangente a la huella (radio 20 en (1.260, 740), origen en su posición)', () => {
    // El jugador toca la cara superior, a 156 px de la oveja: con huida de radio 50 no la asusta.
    const flock = declaredSheep([{ x: 1260, y: 740 }]);
    const run = startWithSites(
      withSheep(aSiteConfig(), { flee: { radius: 50, speed: 180 } }),
      { player: touchPoint('top'), ...withStock(15) },
      [TEST_SITE],
      flock.kind === 'open' && flock.sheep ? { sheep: flock.sheep } : {},
    );
    untilBuilding(run, 1);
    const s = buildNow(run, 'house');
    const o = s.sheep[0];
    expect([o?.x, o?.y, o?.origin.x, o?.origin.y]).toEqual([1260, 740, 1260, 740]);
    const after = ticks(run, 600);
    expect(after.some((x) => x.sheep.some((q) => overlapsFootprint(q.x, q.y, q.radius)))).toBe(
      false,
    );
  });

  it('GuardPost.evict recoloca un punto de patrulla que cae en una celda de obra', () => {
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

  it('con una torre en el solar el guardia sigue fuera de la huella (partida, 1.200 ticks)', () => {
    const base = aCampScenario({ player: { speed: 210 } });
    const types = base.enemies.types.map((t) =>
      t.id === 'guard' ? aGuardType({ detect: 5, lose: 10 }) : t,
    );
    const config: RunConfig = { ...base, enemies: { ...base.enemies, types } };
    const site = { col: 32, row: 11 };
    // La casa goblin (30..31, 10..12), con puerta en (1.890, 810), declarada en el mapa vacío.
    const r = startWithSites(
      config,
      {
        player: { x: 1980, y: 796 },
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

describe('Solar libre y edificios que bloquean el paso, en la partida (spec build-sites 0027)', () => {
  /** Jugador quieto en Q = (1.260, 1.000) y torch en E = (1.260, 300): el segmento E–Q cruza la huella. */
  const Q = { x: 1260, y: 1000 };
  const chaseRun = (withSite: boolean) => {
    const run = startWithSites(
      torchConfig(),
      { player: Q, enemies: [{ type: 'goblin-torch', x: 1260, y: 300 }] },
      withSite ? [TEST_SITE] : [],
    );
    return advance(run, 3600);
  };
  const reachedAt = (snaps: readonly RunSnapshot[]) =>
    snaps.findIndex((s) => {
      const e = s.enemies[0];
      return !!e && Math.abs(e.x - Q.x) <= 0.001 && Math.abs(e.y - Q.y) <= 0.001;
    });
  const at = (s: RunSnapshot) => s.enemies[0] ?? { x: 0, y: 0 };

  it('Scenario: El enemigo rodea el solar libre (con el solar y sin él, 3.600 ticks)', () => {
    const without = chaseRun(false);
    const withSite = chaseRun(true);
    expect(without.some((s) => inFootprint(at(s).x, at(s).y))).toBe(true);
    expect(withSite.some((s) => inFootprint(at(s).x, at(s).y))).toBe(false);
    expect(reachedAt(without)).toBeGreaterThan(0);
    expect(reachedAt(withSite)).toBeGreaterThan(reachedAt(without));
  });

  it('Scenario: El enemigo rodea un solar libre desde el tick 0 (enemy-behavior, 1.200 ticks)', () => {
    const snaps = chaseRun(true).slice(0, 1200);
    // Sin línea libre en el tick 1: no avanza en recta hacia Q (x = 1.260).
    expect(snaps[0]?.enemies[0]?.x).not.toBe(1260);
    expect(snaps.some((s) => inFootprint(at(s).x, at(s).y))).toBe(false);
    expect(reachedAt(snaps)).toBeGreaterThan(0);
  });

  it('Scenario: El solar libre corta la línea libre (tick 0; con el mapa vacío sí la tiene)', () => {
    const [withSite] = chaseRun(true);
    const [without] = chaseRun(false);
    expect(withSite?.enemies[0]?.x).not.toBe(1260);
    expect(without?.enemies[0]?.x).toBe(1260);
  });

  /** Primer enemigo que aparece con el azar fijo 0,75 (ángulo 3π/2: el punto queda encima). */
  const spawnOver = (
    player: { x: number; y: number },
    ringRadius: number,
    sites: readonly { col: number; row: number }[],
    cells?: ReturnType<typeof cellsWith>,
    tower = false,
  ) => {
    const base = aSiteConfig({ segments: [aSegment(['probe'], 1)] });
    const config = {
      ...base,
      waves: { ...base.waves, spawn: { ringRadius, minDistance: 0, maxAttempts: 8 } },
    };
    const random = new CountingRandom(new StubRandom(0.75));
    const run = startWithSites(config, { player, ...withStock(30, 15) }, sites, {
      random,
      ...(cells ? { cells } : {}),
    });
    if (tower) {
      untilBuilding(run, 1);
      buildNow(run, 'tower');
    }
    let before = random.calls;
    for (let t = 0; t < 120 && run.snapshot().enemies.length === 0; t++) {
      before = random.calls;
      leaveSiteIfOpen(run);
      run.tick(PlayerInput.NONE);
    }
    return { enemy: run.snapshot().enemies[0], consumed: random.calls - before };
  };

  it('Scenario: Aparición sobre el solar libre (punto en la celda (20, 10), como con un tronco)', () => {
    // Desde (1.230, 800) con el anillo de 170: el punto es (1.230, 630), en la celda (20, 10).
    const onSite = spawnOver({ x: 1230, y: 800 }, 170, [TEST_SITE]);
    const trunk = spawnOver(
      { x: 1230, y: 800 },
      170,
      [],
      cellsWith(mapRules(), { '20,10': 'trunk' }),
    );
    expect(inFootprint(onSite.enemy?.x ?? 1230, onSite.enemy?.y ?? 630)).toBe(false);
    expect(isCellCenter(onSite.enemy?.x ?? 0, onSite.enemy?.y ?? 0)).toBe(true);
    // 1 valor para el tipo del director y 1 por el único intento, como con el tronco.
    expect([onSite.consumed, trunk.consumed]).toEqual([2, 2]);
  });

  it('Scenario: Aparición sobre el edificio (torre; 1 valor del azar por intento)', () => {
    // Desde P con el anillo de 76: el punto es (1.260, 660), en la huella.
    const onTower = spawnOver(P, 76, [TEST_SITE], undefined, true);
    expect(inFootprint(onTower.enemy?.x ?? 1260, onTower.enemy?.y ?? 660)).toBe(false);
    expect(isCellCenter(onTower.enemy?.x ?? 0, onTower.enemy?.y ?? 0)).toBe(true);
    expect(onTower.consumed).toBe(2);
  });

  it('Scenario: Recogible creado sobre el solar libre (torch de vida 4 en (1.230, 630))', () => {
    const torch = aStillType({ id: 'goblin-torch', health: 4 });
    const config = withWeapons(aSiteConfig({ player: { maxHealth: 1000 } }, [torch]), {
      maxProjectiles: 32,
      hitFlashTicks: 4,
      weapons: [LINTER],
    });
    const run = startWithSites(config, {
      player: { x: 1230, y: 800 },
      enemies: [{ type: 'goblin-torch', x: 1230, y: 630 }],
    });
    const snaps = advance(run, 120);
    const n = snaps.findIndex((s) => s.kills === 1);
    const gem = snaps[n]?.pickups.find((x) => x.kind === 'xp');
    expect(n).toBeGreaterThanOrEqual(0);
    expect(snaps[n - 1]?.enemies[0]).toMatchObject({ x: 1230, y: 630 });
    expect(inFootprint(gem?.x ?? 1230, gem?.y ?? 630)).toBe(false);
    expect(isCellCenter(gem?.x ?? 0, gem?.y ?? 0)).toBe(true);
  });

  it('una gema soltada en la huella de una casa se recoloca (PickupField sobre la capa de obra)', () => {
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
