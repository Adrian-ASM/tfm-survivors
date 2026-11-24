import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { UpgradeTypeConfig } from '../../src/domain/upgrade/UpgradeType';
import type { WeaponTypeConfig } from '../../src/domain/weapon/WeaponType';
import {
  DEFAULT_UPGRADE_LIST,
  LINTER,
  TESTS,
  aDefaultConfig,
  withScenarioCurve,
  aSegment,
  aWavesConfig,
  withPlayer,
} from '../support/builders';
import { aProbeType, advance, enemyById, startRun, ticks } from '../support/runs';
import { weaponsOf } from '../support/weapons';

const CENTER = { x: 480, y: 270 };
/** Tipos quietos (1e-20 px/s: la persecución no cambia su posición) con la vida de los tipos por defecto (para colocar objetivos donde se quiera). */
const STILL = [
  aProbeType({ id: 'goblin-torch', speed: 1e-20, health: 10, damage: 5 }),
  aProbeType({ id: 'goblin-barrel', speed: 1e-20, health: 20, damage: 8, radius: 16 }),
];

/** Solo las mejoras del jugador o de un arma equipada (el catálogo rechaza armas inexistentes). */
const fitsLoadout = (u: UpgradeTypeConfig, weapons: readonly WeaponTypeConfig[]): boolean =>
  u.target.kind === 'player' ||
  weapons.some((w) => w.id === (u.target as { weapon: string }).weapon);

function weaponRun(
  weapons: readonly WeaponTypeConfig[],
  setup: RunSetup,
  list: readonly UpgradeTypeConfig[] = DEFAULT_UPGRADE_LIST,
) {
  const base = withScenarioCurve(aDefaultConfig());
  const config: RunConfig = {
    ...base,
    enemies: { types: STILL },
    waves: aWavesConfig({ types: STILL, segments: [aSegment(['goblin-torch'], 0)] }).waves,
    weapons: weaponsOf(weapons),
    upgrades: { upgrades: list.filter((u) => fitsLoadout(u, weapons)) },
  };
  return startRun(config, { player: CENTER, ...setup });
}

const bugAt = (x: number, y = 270, health?: number) => ({
  type: 'goblin-torch',
  x,
  y,
  ...(health === undefined ? {} : { health }),
});
const healthOf = (s: RunSnapshot | undefined, id: number) =>
  s?.enemies.find((e) => e.id === id)?.health ?? 0;
/** Gema atraída que se recoge en el tick `n` con el jugador quieto en el centro. */
const gemOnTick = (n: number) => ({
  x: 480 + 21 + 6 * (n - 1) + 3,
  y: 270,
  value: 1,
  attracted: true,
});

describe('Efectos de las mejoras de arma', () => {
  it('Scenario: Más daño del Linter / Daño efectivo con mejoras (strict-rules 1: vida 1)', () => {
    const run = weaponRun([LINTER], { enemies: [bugAt(580)], upgrades: { 'strict-rules': 1 } });
    expect(healthOf(ticks(run, 20).at(-1), 0)).toBe(1);
  });

  it('Scenario: Mejoras acumuladas que matan de un impacto (strict-rules 5: damage 21)', () => {
    const enemies = [bugAt(580), { type: 'goblin-barrel', x: 380, y: 270 }];
    const run = weaponRun([LINTER], { enemies, upgrades: { 'strict-rules': 5 } });
    const snaps = ticks(run, 60);
    // Un proyectil por baja: el Linter (cadencia 30) solo ha disparado una vez antes del tick 31.
    expect(snaps[29]?.enemies).toHaveLength(1);
    expect(snaps.at(-1)?.enemies).toEqual([]);
  });

  it('Scenario: Más alcance (wide-analysis 1: objetivo a 450 px y 1 proyectil)', () => {
    const run = weaponRun([LINTER], { enemies: [bugAt(930)], upgrades: { 'wide-analysis': 1 } });
    expect(ticks(run, 1)[0]?.projectiles).toHaveLength(1);
  });

  it('Scenario: Alcance mejorado (jugador en x 100: objetivo a 460, nada a 461)', () => {
    const setup = (x: number) => ({
      player: { x: 100, y: 270 },
      enemies: [bugAt(x)],
      upgrades: { 'wide-analysis': 1 },
    });
    expect(ticks(weaponRun([LINTER], setup(560)), 1)[0]?.projectiles).toHaveLength(1);
    expect(ticks(weaponRun([LINTER], setup(561)), 1)[0]?.projectiles).toHaveLength(0);
  });

  it('Scenario: Más radio del pulso (coverage 1: a 114 pierde 4, a 115 nada)', () => {
    const run = weaponRun([TESTS], {
      enemies: [bugAt(594), bugAt(365)],
      upgrades: { coverage: 1 },
    });
    const [first] = ticks(run, 1);
    expect([healthOf(first, 0), healthOf(first, 1)]).toEqual([6, 10]);
  });

  it('Scenario: Pulso mejorado (coverage y hard-asserts 1: 4 y 10)', () => {
    const upgrades = { coverage: 1, 'hard-asserts': 1 };
    const run = weaponRun([TESTS], { enemies: [bugAt(594), bugAt(365)], upgrades });
    const [first] = ticks(run, 1);
    expect([healthOf(first, 0), healthOf(first, 1)]).toEqual([4, 10]);
  });

  it('Scenario: Más daño de Tests (hard-asserts 1: vida 4)', () => {
    const run = weaponRun([TESTS], { enemies: [bugAt(530)], upgrades: { 'hard-asserts': 1 } });
    expect(healthOf(ticks(run, 1)[0], 0)).toBe(4);
  });

  it('Scenario: Un pulso mejorado mata a un bug de un golpe (hard-asserts 3: damage 10)', () => {
    const run = weaponRun([TESTS], { enemies: [bugAt(530)], upgrades: { 'hard-asserts': 3 } });
    const [first] = ticks(run, 1);
    expect(first?.enemies).toEqual([]);
    expect(first?.gems).toHaveLength(1);
  });

  it('Scenario: Proyectil en vuelo durante una mejora de daño (vida 4 en T + 11; luego −9)', () => {
    const list = [DEFAULT_UPGRADE_LIST[0] as UpgradeTypeConfig];
    const run = weaponRun(
      [LINTER],
      { enemies: [bugAt(580, 270, 10)], gems: [gemOnTick(3)], experience: { level: 1, xp: 4 } },
      list,
    );
    const snaps = advance(run, 60);
    expect(snaps[2]?.offer.map((o) => o.id)).toEqual(['strict-rules']);
    expect(healthOf(snaps[10], 0)).toBe(10);
    expect(healthOf(snaps[11], 0)).toBe(4);
    expect(snaps.at(-1)?.enemies).toEqual([]);

    const tough = weaponRun(
      [LINTER],
      {
        enemies: [{ type: 'goblin-barrel', x: 580, y: 270, health: 19 }],
        gems: [gemOnTick(3)],
        experience: { level: 1, xp: 4 },
      },
      list,
    );
    const later = advance(tough, 60);
    const lives = [...new Set(later.map((s) => healthOf(s, 0)))];
    expect(lives).toEqual([19, 13, 4]);
  });

  it('Scenario: Pulso visible durante una mejora de radio (90 de T a T + 7; el siguiente 105)', () => {
    const list = DEFAULT_UPGRADE_LIST.filter((u) => u.id === 'coverage');
    const run = weaponRun(
      [TESTS],
      {
        enemies: [bugAt(530, 270)],
        gems: [{ x: 500, y: 270, value: 1 }],
        experience: { level: 1, xp: 4 },
      },
      list,
    );
    const snaps = advance(run, 95);
    expect(snaps[0]?.status).toBe('choosing');
    const first = snaps.slice(0, 8).map((s) => s.pulses.map((p) => [p.firedAt, p.radius]));
    expect(first).toEqual(Array(8).fill([[1, 90]]));
    expect(snaps[90]?.pulses).toEqual([expect.objectContaining({ firedAt: 91, radius: 105 })]);
  });

  it('Scenario: El contenido base no cambia (otra partida empieza sin mejoras y con damage 6)', () => {
    weaponRun([LINTER], { enemies: [bugAt(580)], upgrades: { 'strict-rules': 3 } });
    const fresh = weaponRun([LINTER], { enemies: [bugAt(580)] });
    const end = ticks(fresh, 20).at(-1);
    expect(end?.upgrades).toEqual([]);
    expect(enemyById(end as RunSnapshot, 0).health).toBe(4);
  });

  it('Scenario: Ningún arma mata a un bug de un impacto sin mejoras (4 y 6)', () => {
    const linter = ticks(weaponRun([LINTER], { enemies: [bugAt(580)] }), 20).at(-1);
    const tests = ticks(weaponRun([TESTS], { enemies: [bugAt(530)] }), 1)[0];
    expect([healthOf(linter, 0), healthOf(tests, 0)]).toEqual([4, 6]);
  });
});

describe('Efectos de las mejoras del jugador', () => {
  const right = PlayerInput.of(1, 0);
  const only = (id: string) => DEFAULT_UPGRADE_LIST.filter((u) => u.id === id);
  const xpRun = (setup: RunSetup, list: readonly UpgradeTypeConfig[], extra = STILL) => {
    // Velocidad base de los escenarios de la spec (200 px/s), no la del contenido (210 desde 0015).
    const base = withPlayer(withScenarioCurve(aDefaultConfig()), { speed: 200 });
    const types = [...STILL, ...extra.filter((t) => !STILL.includes(t))];
    const config: RunConfig = {
      ...base,
      enemies: { types },
      waves: aWavesConfig({ types, segments: [aSegment(['goblin-torch'], 0)] }).waves,
      upgrades: { upgrades: list },
    };
    return startRun(config, { player: CENTER, ...setup });
  };
  const offerNow = { gems: [{ x: 500, y: 270, value: 1 }], experience: { level: 1, xp: 4 } };

  it('Scenario: Más velocidad / Velocidad mejorada (shortcuts 1: (700, 270) tras 60 ticks)', () => {
    const end = ticks(xpRun({ upgrades: { shortcuts: 1 } }, only('shortcuts')), 60, right).at(-1);
    expect(end?.player.x).toBeCloseTo(700, 3);
    expect(end?.player.y).toBe(270);
  });

  it('Scenario: Velocidad en el nivel máximo (shortcuts 5 desde x 100: (400, 270))', () => {
    const run = xpRun(
      { player: { x: 100, y: 270 }, upgrades: { shortcuts: 5 } },
      only('shortcuts'),
    );
    expect(ticks(run, 60, right).at(-1)?.player.x).toBeCloseTo(400, 3);
  });

  it('Scenario: Más radio de recogida (context-window 1: gema a 90 px atraída a (564, 270))', () => {
    const setup = { gems: [{ x: 570, y: 270, value: 1 }], upgrades: { 'context-window': 1 } };
    const [first] = ticks(xpRun(setup, only('context-window')), 1);
    expect(first?.gems.map((g) => [g.x, g.y])).toEqual([[564, 270]]);
  });

  it('Scenario: Con la vida llena (guardrail elegido: 120 de 120)', () => {
    const run = xpRun(offerNow, only('guardrail'));
    ticks(run, 1);
    expect(run.chooseUpgrade(0).ok).toBe(true);
    const { health, maxHealth } = run.snapshot().player;
    expect([health, maxHealth]).toEqual([120, 120]);
  });

  it('Scenario: Con la vida a medias (55 de 100 + guardrail: 75 de 120)', () => {
    const hitter = aProbeType({ id: 'hitter', damage: 45, health: 1e6, speed: 1e-20 });
    const setup = { ...offerNow, enemies: [{ type: 'hitter', ...CENTER }] };
    const run = xpRun(setup, only('guardrail'), [hitter]);
    expect(ticks(run, 1)[0]?.player.health).toBe(55);
    expect(run.chooseUpgrade(0).ok).toBe(true);
    const { health, maxHealth } = run.snapshot().player;
    expect([health, maxHealth]).toEqual([75, 120]);
  });

  it('Scenario: Nivel máximo (guardrail 5 veces sin golpes: 200 de 200)', () => {
    const run = xpRun({ gems: [{ x: 500, y: 270, value: 75 }] }, only('guardrail'));
    const [first] = ticks(run, 1);
    expect(first?.progression).toMatchObject({ level: 6, pendingLevelUps: 5 });
    for (let i = 0; i < 5; i++) expect(run.chooseUpgrade(0).ok).toBe(true);
    const s = run.snapshot();
    expect([s.player.health, s.player.maxHealth, s.status]).toEqual([200, 200, 'running']);
  });

  it('Scenario: La mejora no altera la invulnerabilidad (110 de 120 hasta el 40; 100 en el 41)', () => {
    const probe = aProbeType({ damage: 10, health: 1e6 });
    const setup = {
      enemies: [{ type: 'probe', x: 480 + 35, y: 270 }],
      gems: [{ x: 480, y: 270 - 138, value: 1, attracted: true }],
      experience: { level: 1, xp: 4 },
    };
    const run = xpRun(setup, only('guardrail'), [probe]);
    const first = ticks(run, 20);
    expect([first[9]?.player.health, first[19]?.status]).toEqual([90, 'choosing']);
    expect(run.chooseUpgrade(0).ok).toBe(true);
    const after = ticks(run, 21);
    expect(after.slice(0, 20).every((s) => s.player.health === 110)).toBe(true);
    expect(after.map((s) => s.player.maxHealth)).toEqual(Array(21).fill(120));
    expect([after[20]?.tick, after[20]?.player.health]).toEqual([41, 100]);
  });

  it('Scenario: Golpe letal tras la mejora (10 de 100 → 30 de 120 → 5 → 0 y termina)', () => {
    const heavy = aProbeType({ id: 'heavy', damage: 90, health: 5, speed: 1e-20 });
    const late = aProbeType({ id: 'late', damage: 25, health: 1e6 });
    const setup = {
      ...offerNow,
      enemies: [
        { type: 'heavy', ...CENTER },
        { type: 'late', x: 480 + 26 + 40, y: 270 },
      ],
    };
    const run = xpRun(setup, only('guardrail'), [heavy, late]);
    expect(ticks(run, 1)[0]?.player.health).toBe(10);
    expect(run.chooseUpgrade(0).ok).toBe(true);
    expect(run.snapshot().player).toMatchObject({ health: 30, maxHealth: 120 });
    const snaps = ticks(run, 120);
    const firstLate = snaps.find((s) => s.player.health < 30);
    expect(firstLate?.player.health).toBe(5);
    expect(snaps.at(-1)?.player.health).toBe(0);
    expect(snaps.at(-1)?.status).toBe('over');
  });
});
