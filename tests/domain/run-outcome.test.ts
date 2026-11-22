import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { SETUP_KILLS_MUST_BE_INTEGER } from '../../src/domain/run/RunSetup';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  DEFAULT_UPGRADES,
  DEFAULT_WEAPONS,
  LINTER,
  TESTS,
  aSegment,
  withDuration,
  withUpgrades,
  withWeapons,
} from '../support/builders';
import { aContactConfig, aProbeType, startRun, ticks } from '../support/runs';
import { aLinter, weaponsOf } from '../support/weapons';
import { StubRandom } from '../support/random';

const CENTER = { x: 480, y: 270 };

/** Enemigo `type` que entra en contacto con el jugador del centro en el tick `n` (1 px/tick). */
const contactAt = (n: number, type = 'probe') => ({ type, x: 480 + 25 + n, y: 270 });

/** Bug quieto (velocidad ínfima, vida 10, XP 1) para colocar bajas donde se quiera. */
const STILL_BUG = aProbeType({ id: 'goblin-torch', speed: 1e-6, health: 10, xp: 1, damage: 5 });
/** Enemigo duro y rápido (10 px/tick) que solo sirve para golpear al jugador en un tick dado. */
const RUNNER = aProbeType({ id: 'probe', speed: 600, health: 1e6, damage: 10 });

/** Contenido de bajas: bug quieto y `RUNNER`, sin director, con las armas y la vida dadas. */
const killsConfig = (weapons: readonly (typeof LINTER)[], maxHealth = 1000): RunConfig =>
  withWeapons(
    aContactConfig({ types: [STILL_BUG, RUNNER], player: { maxHealth } }),
    weaponsOf(weapons),
  );

/** Partida con el jugador en el centro y el setup dado. */
const at = (config: RunConfig, setup: RunSetup): Run =>
  startRun(config, { player: CENTER, ...setup });

/** RUNNER a la izquierda que entra en contacto (distancia < 26) justo en el tick n. */
const runnerAt = (n: number) => ({ type: 'probe', x: 480 - (20 + 10 * n), y: 270 });

/** Tick en que el Linter abate a un bug de vida 4 a 300 px (partida de control, sin golpe). */
function linterKillTick(): number {
  const control = at(killsConfig([LINTER]), {
    enemies: [{ type: 'goblin-torch', x: 780, y: 270, health: 4 }],
  });
  const snaps = ticks(control, 120);
  return snaps.findIndex((s) => s.kills === 1) + 1;
}

describe('Contador de bajas (spec run-outcome)', () => {
  it('Scenario: Varias bajas en un tick (2 bajas + 3 bugs en el pulso ⇒ 5)', () => {
    const bugs = [0, 1, 2].map((i) => ({
      type: 'goblin-torch',
      x: 540,
      y: 250 + 20 * i,
      health: 4,
    }));
    const run = at(killsConfig([TESTS]), { kills: 2, enemies: bugs });

    const [first] = ticks(run, 1);

    expect(first?.kills).toBe(5);
    expect(first?.enemies).toEqual([]);
  });

  it('Scenario: Una baja cuenta una sola vez (2 impactos del Linter de damage 6 sobre vida 4)', () => {
    const linters = [aLinter({ id: 'a' }), aLinter({ id: 'b' })];
    const run = at(killsConfig(linters), {
      enemies: [{ type: 'goblin-torch', x: 520, y: 270, health: 4 }],
    });

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
      enemies: [{ type: 'goblin-torch', x: 780, y: 270, health: 4 }, runnerAt(n)],
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
      enemies: [{ type: 'goblin-torch', x: 780, y: 270, health: 4 }, runnerAt(n)],
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

    expect(last).toMatchObject({
      tick: 120,
      status: 'over',
      outcome: 'won',
      player: { health: 1 },
    });
  });
});

/** Jugador en una esquina para tener sitio a su derecha. */
const CORNER = { x: 100, y: 100 };
/** Gema atraída que llega a solaparse con el jugador de CORNER en el tick 120 (6 px/tick). */
const GEM_AT_120 = { x: 100 + 21 + 6 * 119 + 3, y: 100, value: 1, attracted: true };
/** Enemigo de damage 10 a 1 px/tick que toca al jugador de CORNER en el tick 120. */
const HIT_AT_120 = { type: 'probe', x: 100 + 25 + 120, y: 100 };

/** Contenido de prioridades: probe indestructible (1 px/tick, damage 10), armas y mejoras por defecto. */
function priorityConfig(seconds: number, opts: { maxHealth?: number; budget?: number } = {}) {
  const base = aContactConfig({
    types: [aProbeType({ health: 1e6 })],
    player: { maxHealth: opts.maxHealth ?? 100 },
    segments: [aSegment(['probe'], opts.budget ?? 0)],
  });
  return withDuration(withUpgrades(withWeapons(base, DEFAULT_WEAPONS), DEFAULT_UPGRADES), seconds);
}

const idsOf = (s: RunSnapshot | undefined): number[] => (s?.enemies ?? []).map((e) => e.id);

describe('Prioridades en el tick de la victoria (spec run-outcome)', () => {
  it('Scenario: Muerte y victoria en el mismo tick (golpe letal en el tick final ⇒ derrota)', () => {
    const run = startRun(short(10), { enemies: [contactAt(120)] });

    const last = ticks(run, 120).at(-1);

    expect(last).toMatchObject({ tick: 120, outcome: 'lost', player: { health: 0 } });
  });

  it('Scenario: Victoria y subida de nivel en el mismo tick (sin oferta; nivel 1, XP 4, gema)', () => {
    const setup: RunSetup = { player: CORNER, gems: [GEM_AT_120], experience: { level: 1, xp: 4 } };
    const control = ticks(startRun(priorityConfig(600), setup), 120).at(-1);
    const run = startRun(priorityConfig(2), setup);

    const last = ticks(run, 120).at(-1);

    expect(control?.status).toBe('choosing');
    expect(last).toMatchObject({ tick: 120, status: 'over', outcome: 'won', offer: [] });
    expect(last?.progression).toMatchObject({ level: 1, xp: 4 });
    expect(last?.gems).toHaveLength(1);
  });

  it('Scenario: Sin spawns en el tick de la victoria (el director sacaría uno en el 120)', () => {
    const control = ticks(
      startRun(priorityConfig(600, { budget: 1 }), {}, new StubRandom(0.5)),
      120,
    );
    const snaps = ticks(startRun(priorityConfig(2, { budget: 1 }), {}, new StubRandom(0.5)), 120);

    expect(idsOf(control[119]).length).toBeGreaterThan(idsOf(control[118]).length);
    expect(snaps[119]?.outcome).toBe('won');
    expect(idsOf(snaps[119]).every((id) => idsOf(snaps[118]).includes(id))).toBe(true);
  });

  it('Scenario: Una baja en el tick de la victoria cuenta y deja su gema (5 ⇒ 6 bajas)', () => {
    const types = [aProbeType({ id: 'goblin-torch', speed: 30, health: 10, xp: 1, damage: 5 })];
    const config = (seconds: number) =>
      withDuration(withWeapons(aContactConfig({ types }), weaponsOf([LINTER])), seconds);
    const bugAt = (x: number): RunSetup => ({
      player: CENTER,
      kills: 5,
      enemies: [{ type: 'goblin-torch', x, y: 270, health: 4 }],
    });
    const probe = ticks(startRun(config(600), bugAt(885)), 120);
    const k0 = probe.findIndex((s) => s.kills === 6) + 1;
    const x = 885 + 0.5 * (120 - k0);

    const last = ticks(startRun(config(2), bugAt(x)), 120).at(-1);

    expect(last).toMatchObject({ tick: 120, outcome: 'won', kills: 6, enemies: [] });
    expect(last?.gems).toHaveLength(1);
  });
});

describe('Muerte en el tick de la duración objetivo (spec run-state)', () => {
  it('Scenario: Muerte en el tick de la duración objetivo (terminada, derrota, vida 0)', () => {
    const run = startRun(short(10), { enemies: [contactAt(120)] });

    ticks(run, 120);

    expect([run.status, run.outcome, run.snapshot().player.health]).toEqual(['over', 'lost', 0]);
  });
});

describe('Orden de los pasos en el tick de la victoria (spec simulation-loop)', () => {
  it('Scenario: El tick de la victoria acaba tras el contacto (golpe, gema y director)', () => {
    const setup: RunSetup = { player: CORNER, gems: [GEM_AT_120], enemies: [HIT_AT_120] };
    const random = () => new StubRandom(0); // ángulo 0: aparece a la derecha de la esquina
    const control = ticks(startRun(priorityConfig(600, { budget: 1 }), setup, random()), 120);
    const snaps = ticks(startRun(priorityConfig(2, { budget: 1 }), setup, random()), 120);
    const [before, last] = [snaps[118], snaps[119]];

    expect(idsOf(control[119]).length).toBeGreaterThan(idsOf(control[118]).length);
    expect(control[119]?.gems).toHaveLength(0);
    expect(last).toMatchObject({ status: 'over', outcome: 'won', player: { health: 90 } });
    expect(before?.player.health).toBe(100);
    expect(last?.gems).toHaveLength(1);
    expect(last?.progression.xp).toBe(before?.progression.xp);
    expect(idsOf(last)).toEqual(idsOf(before));
  });

  it('Scenario: Las armas actúan en el tick de la victoria (Tests abate un bug de vida 4)', () => {
    const types = [aProbeType({ id: 'goblin-torch', speed: 60, health: 10, xp: 1, damage: 5 })];
    const config = withDuration(withWeapons(aContactConfig({ types }), weaponsOf([TESTS])), 2);
    const run = startRun(config, {
      player: CENTER,
      enemies: [{ type: 'goblin-torch', x: 480 + 219.5, y: 270, health: 4 }],
    });

    const snaps = ticks(run, 120);
    const [before, last] = [snaps[118], snaps[119]];

    expect([before?.enemies.length, before?.kills, before?.pulses.length]).toEqual([1, 0, 0]);
    expect(last).toMatchObject({ outcome: 'won', kills: 1, enemies: [] });
    expect(last?.gems).toHaveLength(1);
  });
});

/** Gema atraída que el jugador de CORNER recoge exactamente en el tick n (6 px/tick). */
const gemAt = (n: number) => ({ x: 100 + 21 + 6 * (n - 1) + 3, y: 100, value: 1, attracted: true });
/** Nivel 1 con XP 4: la gema de `gemAt(n)` abre una oferta en el tick n. */
const offerAt = (n: number): RunSetup => ({
  player: CORNER,
  gems: [gemAt(n)],
  experience: { level: 1, xp: 4 },
});

describe('Tiempo de partida por ticks ejecutados (spec run-outcome)', () => {
  it('Scenario: La elección de mejora no consume tiempo de partida (60 ticks, oferta en el 30)', () => {
    const run = startRun(priorityConfig(1), offerAt(30));
    const offered = ticks(run, 30).at(-1);
    const during = ticks(run, 600).at(-1);
    run.chooseUpgrade(0);

    const before = ticks(run, 29).at(-1);
    run.tick(PlayerInput.NONE);

    expect([offered?.status, during?.tick]).toEqual(['choosing', 30]);
    expect(before).toMatchObject({ tick: 59, status: 'running', outcome: null });
    expect(run.snapshot()).toMatchObject({ tick: 60, status: 'over', outcome: 'won' });
  });
});

describe('Invariante entre estado y resultado (spec run-outcome)', () => {
  it('Scenario: Sin resultado mientras se elige mejora (oferta en el tick 10)', () => {
    const last = ticks(startRun(priorityConfig(600), offerAt(10)), 10).at(-1);

    expect(last).toMatchObject({ tick: 10, status: 'choosing', outcome: null });
  });
});

describe('Estado de la partida con ofertas y duración (spec run-state)', () => {
  it('Scenario: Oferta abierta justo antes del tick de la victoria (oferta en el 119)', () => {
    const run = startRun(priorityConfig(2), offerAt(119));
    ticks(run, 119);

    const during = ticks(run, 600);
    run.chooseUpgrade(0);
    run.tick(PlayerInput.NONE);

    expect(during.every((s) => s.tick === 119 && s.status === 'choosing' && !s.outcome)).toBe(true);
    expect(run.snapshot()).toMatchObject({ tick: 120, status: 'over', outcome: 'won' });
  });

  it('Scenario: Eligiendo mejora y vuelta a en curso (sin resultado en ambos)', () => {
    const run = startRun(priorityConfig(600), offerAt(5));
    const offered = ticks(run, 5).at(-1);

    run.chooseUpgrade(0);

    expect([offered?.status, offered?.outcome]).toEqual(['choosing', null]);
    expect([run.snapshot().status, run.snapshot().outcome]).toEqual(['running', null]);
  });
});

/**
 * Golpe letal en el tick n sin simular nada más: un único enemigo `slow` (damage 10) en la esquina
 * opuesta a CORNER, con la velocidad justa para que la distancia baje de 26 (16 + 10) en el tick n
 * y no antes. Jugador con vida 10 y duración por defecto (36.000 ticks).
 */
function lethalAt(n: number): Run {
  const from = { x: 860, y: 500 };
  const distance = Math.hypot(from.x - CORNER.x, from.y - CORNER.y);
  const perTick = (distance - 26) / (n - 0.5);
  const slow = aProbeType({ id: 'slow', speed: perTick * 60, health: 1e6 });
  const config = aContactConfig({ types: [slow], player: { maxHealth: 10 } });
  return startRun(config, { player: CORNER, enemies: [{ type: 'slow', ...from }] });
}

describe('Derrota antes de la duración objetivo (spec run-outcome)', () => {
  it('Scenario: Derrota temprana (golpe letal en el tick 1.200)', () => {
    const run = lethalAt(1200);

    const snaps = ticks(run, 1200);

    expect(snaps[1198]?.status).toBe('running');
    expect(snaps[1199]).toMatchObject({
      tick: 1200,
      status: 'over',
      outcome: 'lost',
      player: { health: 0 },
    });
  });

  it('Scenario: La derrota no se convierte en victoria (36.000 ticks más)', () => {
    const run = lethalAt(1200);
    ticks(run, 1200);

    for (let i = 0; i < 36_000; i++) run.tick(PlayerInput.of(1, 1));

    expect(run.snapshot()).toMatchObject({ tick: 1200, outcome: 'lost' });
  });

  it('Scenario: Derrota en el tick anterior a la victoria (golpe letal en el 35.999)', () => {
    const run = lethalAt(35_999);

    for (let i = 0; i < 36_000; i++) run.tick(PlayerInput.NONE);

    expect(run.snapshot()).toMatchObject({ tick: 35_999, status: 'over', outcome: 'lost' });
  });

  it('Scenario: Muerte y victoria en el mismo tick (36.000 ticks; golpe letal en el 36.000)', () => {
    const run = lethalAt(36_000);

    for (let i = 0; i < 36_000; i++) run.tick(PlayerInput.NONE);

    expect(run.snapshot()).toMatchObject({
      tick: 36_000,
      status: 'over',
      outcome: 'lost',
      player: { health: 0 },
    });
  });
});
