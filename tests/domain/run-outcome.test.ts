import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { SETUP_KILLS_MUST_BE_INTEGER } from '../../src/domain/run/RunSetup';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  DEFAULT_UPGRADES,
  LINTER,
  TESTS,
  withDuration,
  withUpgrades,
  withWeapons,
} from '../support/builders';
import { aContactConfig, aProbeType, startRun, ticks } from '../support/runs';
import { aLinter, weaponsOf } from '../support/weapons';

const CENTER = { x: 480, y: 270 };

/** Enemigo `type` que entra en contacto con el jugador del centro en el tick `n` (1 px/tick). */
const contactAt = (n: number, type = 'probe') => ({ type, x: 480 + 25 + n, y: 270 });

/** Bug quieto (velocidad ínfima, vida 10, XP 1) para colocar bajas donde se quiera. */
const STILL_BUG = aProbeType({ id: 'bug', speed: 1e-6, health: 10, xp: 1, damage: 5 });
/** Enemigo duro y rápido (10 px/tick) que solo sirve para golpear al jugador en un tick dado. */
const RUNNER = aProbeType({ id: 'probe', speed: 600, health: 1e6, damage: 10 });

/** Contenido de bajas: bug quieto y `RUNNER`, sin director, con las armas y la vida dadas. */
const killsConfig = (weapons: readonly (typeof LINTER)[], maxHealth = 1000): RunConfig =>
  withWeapons(
    aContactConfig({ types: [STILL_BUG, RUNNER], player: { maxHealth } }),
    weaponsOf(weapons),
  );

/** Partida con el jugador en el centro y el setup dado. */
const at = (config: RunConfig, setup: RunSetup): Run => startRun(config, { player: CENTER, ...setup });

/** RUNNER a la izquierda que entra en contacto (distancia < 26) justo en el tick n. */
const runnerAt = (n: number) => ({ type: 'probe', x: 480 - (20 + 10 * n), y: 270 });

/** Tick en que el Linter abate a un bug de vida 4 a 300 px (partida de control, sin golpe). */
function linterKillTick(): number {
  const control = at(killsConfig([LINTER]), {
    enemies: [{ type: 'bug', x: 780, y: 270, health: 4 }],
  });
  const snaps = ticks(control, 120);
  return snaps.findIndex((s) => s.kills === 1) + 1;
}

describe('Contador de bajas (spec run-outcome)', () => {
  it('Scenario: Varias bajas en un tick (2 bajas + 3 bugs en el pulso ⇒ 5)', () => {
    const bugs = [0, 1, 2].map((i) => ({ type: 'bug', x: 540, y: 250 + 20 * i, health: 4 }));
    const run = at(killsConfig([TESTS]), { kills: 2, enemies: bugs });

    const [first] = ticks(run, 1);

    expect(first?.kills).toBe(5);
    expect(first?.enemies).toEqual([]);
  });

  it('Scenario: Una baja cuenta una sola vez (2 impactos del Linter de damage 6 sobre vida 4)', () => {
    const linters = [aLinter({ id: 'a' }), aLinter({ id: 'b' })];
    const run = at(killsConfig(linters), { enemies: [{ type: 'bug', x: 520, y: 270, health: 4 }] });

    const snaps = ticks(run, 10);

    expect(snaps.map((s) => s.kills).at(-1)).toBe(1);
    expect(new Set(snaps.map((s) => s.kills))).toEqual(new Set([0, 1]));
  });

  it('Scenario: El contacto no cuenta como baja (3 enemigos en contacto 600 ticks)', () => {
    const enemies = [0, 1, 2].map(() => ({ type: 'probe', ...CENTER }));
    const run = at(killsConfig([]), { enemies });

    const last = ticks(run, 600).at(-1);

    expect([last?.kills, last?.status]).toEqual([0, 'running']);
    expect(last?.player.health).toBeLessThan(1000);
  });

  it('Scenario: Las bajas sobreviven a la subida de nivel (12 bajas, oferta en el tick 1)', () => {
    const config = withUpgrades(killsConfig([LINTER, TESTS]), DEFAULT_UPGRADES);
    const run = at(config, {
      kills: 12,
      gems: [{ x: 500, y: 270, value: 1 }],
      experience: { level: 1, xp: 4 },
    });

    const [offered] = ticks(run, 1);
    run.chooseUpgrade(0);
    const [next] = ticks(run, 1);

    expect([offered?.status, offered?.kills, next?.status, next?.kills]).toEqual([
      'choosing',
      12,
      'running',
      12,
    ]);
  });

  it('Scenario: Baja en el tick de la muerte (7 bajas ⇒ 8, y siguen en 8 tras 600 ticks)', () => {
    const n = linterKillTick();
    const run = at(killsConfig([LINTER], 10), {
      kills: 7,
      enemies: [{ type: 'bug', x: 780, y: 270, health: 4 }, runnerAt(n)],
    });

    const death = ticks(run, n).at(-1);
    const later = ticks(run, 600, PlayerInput.of(1, 1)).at(-1);

    expect(death).toMatchObject({ tick: n, kills: 8, status: 'over', outcome: 'lost' });
    expect(later?.kills).toBe(8);
  });

  it('rechaza unas bajas iniciales que no son un entero ≥ 0', () => {
    const r = Run.start(killsConfig([]), new Mulberry32RandomGenerator(1), { kills: -1 });

    expect(!r.ok && r.error).toEqual({
      code: 'invalid-config',
      field: 'setup.kills',
      message: SETUP_KILLS_MUST_BE_INTEGER,
    });
  });
});

describe('Fin de partida al llegar a vida 0 (spec run-state)', () => {
  it('Scenario: Una baja en el tick de la muerte deja su gema (bug a 300 px abatido por el Linter)', () => {
    const n = linterKillTick();
    const run = at(killsConfig([LINTER], 10), {
      enemies: [{ type: 'bug', x: 780, y: 270, health: 4 }, runnerAt(n)],
    });

    const death = ticks(run, n).at(-1);

    expect(death).toMatchObject({ tick: n, status: 'over', kills: 1 });
    expect(death?.gems.map((g) => Math.round(g.x))).toEqual([780]);
  });
});

describe('Vida mínima 0 (spec player-health): llegar a 0 es una derrota', () => {
  it('Scenario: Daño exactamente igual a la vida restante', () => {
    const run = startRun(aContactConfig({ player: { maxHealth: 10 } }), {
      enemies: [{ type: 'probe', ...CENTER }],
    });

    ticks(run, 1);

    expect([run.snapshot().player.health, run.status, run.outcome]).toEqual([0, 'over', 'lost']);
  });

  it('Scenario: Daño mayor que la vida restante (0, no −15)', () => {
    const types = [aProbeType({ damage: 25 })];
    const run = startRun(aContactConfig({ types, player: { maxHealth: 10 } }), {
      enemies: [{ type: 'probe', ...CENTER }],
    });

    ticks(run, 1);

    expect([run.snapshot().player.health, run.outcome]).toEqual([0, 'lost']);
  });

  it('Scenario: Vida que no llega a 0', () => {
    const run = startRun(aContactConfig({ player: { maxHealth: 11 } }), {
      enemies: [{ type: 'probe', ...CENTER }],
    });

    ticks(run, 1);

    expect([run.snapshot().player.health, run.status, run.outcome]).toEqual([1, 'running', null]);
  });
});

describe('Estado de la partida con resultado (spec run-state)', () => {
  it('Scenario: Partida recién creada: en curso y sin resultado', () => {
    const run = startRun(aContactConfig());

    expect([run.status, run.outcome]).toEqual(['running', null]);
  });

  it('Scenario: Terminada por derrota (golpe letal en el tick 100)', () => {
    const run = startRun(aContactConfig({ player: { maxHealth: 10 } }), {
      enemies: [contactAt(100)],
    });

    const snaps = ticks(run, 100);

    expect([snaps[98]?.status, snaps[99]?.status, run.outcome]).toEqual([
      'running',
      'over',
      'lost',
    ]);
  });
});

/** Partida corta: 2 s = 120 ticks, sin director ni armas ni mejoras. */
const short = (maxHealth = 100): RunConfig =>
  withDuration(aContactConfig({ player: { maxHealth } }), 2);

describe('Victoria al alcanzar la duración objetivo (spec run-outcome)', () => {
  it('Scenario: Victoria con duración corta (119 ticks en curso; el 120 gana)', () => {
    const run = startRun(short());

    const snaps = ticks(run, 120);

    expect(snaps[118]).toMatchObject({ tick: 119, status: 'running', outcome: null });
    expect(snaps[119]).toMatchObject({ tick: 120, status: 'over', outcome: 'won' });
  });

  it('Scenario: Ticks pedidos tras la victoria (600 ticks con input (1, 1))', () => {
    const run = startRun(short());
    ticks(run, 120);

    const last = ticks(run, 600, PlayerInput.of(1, 1)).at(-1);

    expect(last).toMatchObject({ tick: 120, status: 'over', outcome: 'won' });
  });
});

describe('Estado de la partida: victoria (spec run-state)', () => {
  it('Scenario: Terminada por victoria (duración 120, vivo en el 119)', () => {
    const run = startRun(short());
    const before = ticks(run, 119).at(-1);

    run.tick(PlayerInput.NONE);

    expect([before?.status, run.status, run.outcome]).toEqual(['running', 'over', 'won']);
  });
});

describe('Vida mínima 0 (spec player-health): victoria con vida 1', () => {
  it('Scenario: Vida 1 en el tick de la victoria (vida 11, golpe de 10 en el tick 120)', () => {
    const run = startRun(short(11), { enemies: [contactAt(120)] });

    const last = ticks(run, 120).at(-1);

    expect(last).toMatchObject({ tick: 120, status: 'over', outcome: 'won', player: { health: 1 } });
  });
});
