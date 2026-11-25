import { describe, expect, it } from 'vitest';
import type { EnemyTypeConfig } from '../../src/domain/enemy/EnemyType';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { Run, RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  CONTENT_BUILDINGS,
  DEFAULT_CHARACTER_UPGRADES,
  DEFAULT_UPGRADES,
  DEFAULT_WEAPONS,
  LINTER,
  aStillType,
  withBuildings,
  withGoldPerKill,
  withStoneChance,
  withUpgrades,
  withWeapons,
} from '../support/builders';
import { ticks } from '../support/runs';
import { DEFAULT_STRUCTURES, aTowerType } from '../support/camps';
import { declaredSheep } from '../support/sheep';
import {
  TEST_SITE,
  aSiteConfig,
  leaveSiteIfOpen,
  startWithSites,
  withStock,
} from '../support/sites';

// Spec build-sites 0026, "Torre que dispara sola"; simulation-loop, paso 3 y "Snapshot para el
// motor". Torre en el solar de prueba (punto de disparo en el centro de la huella, C = (1.260, 660))
// construida al empezar (tick 0, `RunSetup.sites`) con el jugador quieto en P = (1.260, 810), a
// g = 74 de la huella (0027: sin acceso; así P queda a 150 px de C).
const C = { x: 1260, y: 660 };
const P = { x: 1260, y: 810 };
const CONTENT_ARROW = CONTENT_BUILDINGS.tower.weapon;
/** Enemigo inmóvil con vida de sobra (el objetivo "permanente" de los escenarios). */
const STILL = aStillType({ id: 'goblin-torch', health: 1e9 });
const towerConfig = (types: readonly EnemyTypeConfig[] = [STILL], o = {}): RunConfig =>
  aSiteConfig({ player: { maxHealth: 1e6 }, ...o }, types);

/** Partida con la torre construida en el tick 0 (n = 0) en el solar de prueba. */
function withTower(config: RunConfig, setup: RunSetup = {}, options = {}): Run {
  return startWithSites(
    config,
    { player: P, ...withStock(30, 15), sites: [{ state: 'tower' }], ...setup },
    [TEST_SITE],
    options,
  );
}

/** Ticks (de los snapshots dados) en los que se crea alguna flecha de torre nueva. */
function arrowTicks(snaps: readonly RunSnapshot[]): number[] {
  let seen = -1;
  const out: number[] = [];
  for (const s of snaps) {
    const newest = s.towerProjectiles.reduce((m, p) => Math.max(m, p.id), -1);
    if (newest > seen) out.push(s.tick);
    seen = Math.max(seen, newest);
  }
  return out;
}

describe('Torre que dispara sola (spec build-sites 0026)', () => {
  it('Scenario: Primer disparo de la torre', () => {
    // A 300 px de C y a 450 de P (fuera del alcance del Linter, 400).
    const config = withWeapons(towerConfig(), { ...DEFAULT_WEAPONS, weapons: [LINTER] });
    const run = withTower(config, { enemies: [{ type: 'goblin-torch', x: 1260, y: 360 }] });
    const [n1, n2] = ticks(run, 2);
    expect(n1?.tick).toBe(1);
    expect(n1?.towerProjectiles).toHaveLength(1);
    expect([n1?.towerProjectiles[0]?.x, n1?.towerProjectiles[0]?.y]).toEqual([C.x, C.y]);
    expect(n2?.towerProjectiles[0]?.x).toBeCloseTo(C.x, 9);
    expect(n2?.towerProjectiles[0]?.y).toBeCloseTo(C.y - 8, 9);
    expect(n1?.projectiles).toEqual([]);
  });

  it('Scenario: Cadencia de la torre (c = 45, objetivo a 100 px, n = 0)', () => {
    const run = withTower(towerConfig(), { enemies: [{ type: 'goblin-torch', x: 1260, y: 560 }] });
    const c = CONTENT_ARROW.cooldownTicks;
    expect(arrowTicks(ticks(run, 2 * c + 1))).toEqual([1, 1 + c, 1 + 2 * c]);
  });

  it('Scenario: Solo enemigos (estructura y oveja en alcance, sin enemigos)', () => {
    const flock = declaredSheep([{ x: 1140, y: 760 }]);
    const config: RunConfig = {
      ...towerConfig(),
      structures: { ...DEFAULT_STRUCTURES, types: { 'goblin-tower': aTowerType() } },
    };
    const run = withTower(
      config,
      {},
      {
        structures: [{ type: 'goblin-tower', col: 22, row: 9, cols: 2, rows: 3 }],
        ...(flock.kind === 'open' && flock.sheep ? { sheep: flock.sheep } : {}),
      },
    );
    const before = run.snapshot();
    const snaps = ticks(run, 60);
    expect(snaps.every((s) => s.towerProjectiles.length === 0)).toBe(true);
    expect(snaps.at(-1)?.structures[0]?.health).toBe(before.structures[0]?.health);
    expect(snaps.at(-1)?.sheep[0]?.health).toBe(before.sheep[0]?.health);
  });

  it('Scenario: Las mejoras no afectan a la torre (strict-rules y fast-ci al máximo)', () => {
    // Objetivo a 340 px de C y a 490 de P: el Linter (alcance 400) no le dispara.
    const config = withUpgrades(withWeapons(towerConfig(), DEFAULT_WEAPONS), DEFAULT_UPGRADES);
    const max = (id: string) => DEFAULT_UPGRADES.weapons.find((u) => u.id === id)?.maxLevel ?? 0;
    const play = (upgrades: Record<string, number>) => {
      const run = withTower(config, {
        enemies: [{ type: 'goblin-torch', x: 1260, y: 320 }],
        upgrades,
      });
      const snaps = ticks(run, 600);
      const hp = snaps.map((s) => s.enemies[0]?.health ?? 0);
      const drops = hp
        .slice(1)
        .map((h, i) => (hp[i] ?? 0) - h)
        .filter((d) => d > 0);
      return {
        fired: arrowTicks(snaps),
        drops,
        projectiles: snaps.some((s) => s.projectiles.length),
      };
    };
    const upgraded = play({ 'strict-rules': max('strict-rules'), 'fast-ci': max('fast-ci') });
    const plain = play({});
    expect(upgraded.fired).toEqual(plain.fired);
    expect(upgraded.drops.every((d) => d === CONTENT_ARROW.damage)).toBe(true);
    expect(upgraded.drops.length).toBeGreaterThan(5);
    expect([upgraded.projectiles, plain.projectiles]).toEqual([false, false]);
  });

  it('Scenario: Baja por una flecha (piedra 100, oro por baja 2)', () => {
    const torch = aStillType({ id: 'goblin-torch', health: CONTENT_ARROW.damage });
    const config = withStoneChance(withGoldPerKill(towerConfig([torch]), { 'goblin-torch': 2 }), {
      'goblin-torch': 100,
    });
    const run = withTower(
      config,
      { enemies: [{ type: 'goblin-torch', x: 1260, y: 560 }] },
      { stoneRandom: new Mulberry32RandomGenerator(5) },
    );
    const snaps = ticks(run, 60);
    const m = snaps.findIndex((s) => s.kills === 1);
    const s = snaps[m];
    expect(m).toBeGreaterThan(0);
    expect(snaps[m - 1]?.enemies).toHaveLength(1);
    const kinds = s?.pickups.map((p) => [p.kind, p.value, p.source ?? null]);
    expect(kinds).toEqual([
      ['xp', torch.xp, null],
      ['gold', 2, null],
      ['stone', 1, 'goblin-torch'],
    ]);
  });

  it('Scenario: Flechas congeladas en pausa (oferta de mejora con 600 ticks pedidos)', () => {
    const CHARACTER = { character: DEFAULT_CHARACTER_UPGRADES, weapons: [] };
    // La gema, a 21,5 px a la izquierda de P, se recoge al moverse 1 px en el tick 3.
    const run = withTower(withUpgrades(towerConfig(), CHARACTER), {
      enemies: [{ type: 'goblin-torch', x: 1260, y: 360 }],
      gems: [{ x: P.x - 21.5, y: P.y, value: 5 }],
    });
    ticks(run, 1);
    const [n] = ticks(run, 1, PlayerInput.of(-1, 0));
    expect([n?.status, n?.towerProjectiles.length]).toEqual(['choosing', 1]);
    const during = ticks(run, 600);
    expect(
      during.every(
        (s) => JSON.stringify(s.towerProjectiles) === JSON.stringify(n?.towerProjectiles),
      ),
    ).toBe(true);
    run.chooseUpgrade(0);
    const [next] = ticks(run, 1);
    expect(next?.towerProjectiles[0]?.y).toBeCloseTo((n?.towerProjectiles[0]?.y ?? 0) - 8, 9);
  });

  it('Scenario: 600 ticks en obra con una flecha de torre en vuelo (run-state)', () => {
    // Segundo solar (20, 14), y en [840, 960]: el jugador baja desde P y toca su cara superior.
    const run = startWithSites(
      towerConfig(),
      {
        player: P,
        ...withStock(60, 30),
        sites: [{ state: 'tower' }],
        enemies: [{ type: 'goblin-torch', x: 1260, y: 360 }],
      },
      [TEST_SITE, { col: 20, row: 14 }],
    );
    while (run.status === 'running') ticks(run, 1, PlayerInput.of(0, 1));
    const at = run.snapshot();
    expect(at.build.siteId).toBe(1);
    expect(at.towerProjectiles.length).toBeGreaterThanOrEqual(1);
    expect(
      ticks(run, 600, PlayerInput.of(1, 1)).every((s) => JSON.stringify(s) === JSON.stringify(at)),
    ).toBe(true);
  });
});

describe('Torres en el orden del tick y en el snapshot (spec simulation-loop 0026)', () => {
  it('Scenario: Las flechas después de las armas del jugador', () => {
    // Objetivo inmóvil T a la misma distancia de P y de C (en la mediatriz y = 735): el proyectil del
    // Linter y la flecha salen en el tick 1, avanzan 8 px por tick y lo solapan en el mismo tick.
    const T = { x: 1560, y: 735 };
    expect(Math.hypot(T.x - P.x, T.y - P.y)).toBeCloseTo(Math.hypot(T.x - C.x, T.y - C.y), 9);
    const torch = aStillType({ id: 'goblin-torch', health: 6 });
    const config = withWeapons(towerConfig([torch]), { ...DEFAULT_WEAPONS, weapons: [LINTER] });
    const run = withTower(config, { enemies: [{ type: 'goblin-torch', ...T }] });
    const snaps = ticks(run, 60);
    const k = snaps.findIndex((s) => s.kills === 1);
    const before = snaps[k - 1];
    const s = snaps[k];
    const arrow = s?.towerProjectiles[0];
    // El proyectil del tick 1 (id 0) impacta y desaparece; el del tick 31 sigue en vuelo.
    expect(before?.projectiles.map((p) => p.id)).toEqual([0, 1]);
    expect(s?.projectiles.map((p) => p.id)).toEqual([1]);
    expect(s?.towerProjectiles).toHaveLength(1);
    // La flecha solapa (radios 4 + 10) el punto donde estaba el torch y sigue en vuelo.
    expect(Math.hypot((arrow?.x ?? 0) - T.x, (arrow?.y ?? 0) - T.y)).toBeLessThan(14);
    expect(snaps[k + 1]?.towerProjectiles).toHaveLength(1);
  });

  it('Scenario: Solares y flechas en el snapshot (f1 impacta, f3 se crea)', () => {
    // Torre con cadencia 20 en s1 (tick 0); s2 (22, 13), x en [1.320, 1.440] e y en [780, 900], se
    // abre en el tick 1 (jugador quieto tangente a su cara izquierda) y se cierra: desarmado.
    // Objetivo a 300 px de C y a > 400 px del jugador.
    const base = towerConfig();
    const config = withWeapons(
      withBuildings(base, {
        ...base.buildings,
        tower: { ...base.buildings.tower, weapon: { ...CONTENT_ARROW, cooldownTicks: 20 } },
      }),
      { ...DEFAULT_WEAPONS, weapons: [LINTER] },
    );
    const run = startWithSites(
      config,
      {
        player: { x: 1304, y: 810 },
        ...withStock(60, 30),
        sites: [{ state: 'tower' }],
        enemies: [{ type: 'goblin-torch', x: 1260, y: 360 }],
      },
      [TEST_SITE, { col: 22, row: 13 }],
    );
    const ids = () => run.snapshot().towerProjectiles.map((p) => p.id);
    for (let t = 0; t < 200 && JSON.stringify(ids()) !== '[1,2]'; t++) {
      ticks(run, 1);
      leaveSiteIfOpen(run);
    }
    const s = run.snapshot();
    expect(s.sites.map((x) => [x.id, x.state, x.armed])).toEqual([
      [0, 'tower', true],
      [1, 'free', false],
    ]);
    expect(s.tick).toBe(41);
    expect(s.sites.some((x) => 'access' in x)).toBe(false);
    expect(s.sites[1]?.house).toEqual({ col: 22, row: 13, cols: 2, rows: 2 });
    expect(s.towerProjectiles.map((p) => p.id)).toEqual([1, 2]);
    expect(s.towerProjectiles.every((p) => p.radius === 4)).toBe(true);
    const arrows = new Set(s.towerProjectiles);
    expect(s.projectiles.some((p) => arrows.has(p))).toBe(false);
  });
});
