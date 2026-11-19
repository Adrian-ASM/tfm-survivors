import { describe, expect, it } from 'vitest';
import { RestartRun } from '../../src/application/RestartRun';
import { StartRun, type StartedRun } from '../../src/application/StartRun';
import type { TickRun } from '../../src/application/TickRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { TICK_MS, aDefaultConfig } from '../support/builders';

const CENTER = { x: 480, y: 270 };

/** Fábrica de generadores espía: cuenta las llamadas y siembra cada partida nueva con `seed`. */
function nextRandomSpy(seed = 123) {
  const spy = {
    calls: 0,
    next: (): RandomGenerator => {
      spy.calls += 1;
      return new Mulberry32RandomGenerator(seed);
    },
  };
  return spy;
}

function started(config: RunConfig, setup?: RunSetup, seed = 42): StartedRun {
  const r = new StartRun().execute(config, new Mulberry32RandomGenerator(seed), setup);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** Ejecuta frames de 1 tick con la política de elección fija hasta `n` ticks o hasta terminar. */
function frames(s: StartedRun, n: number): void {
  for (let i = 0; i < n && s.tickRun.status !== 'over'; i++) {
    while (s.tickRun.status === 'choosing') s.chooseUpgrade.execute(0);
    s.tickRun.execute(TICK_MS, PlayerInput.NONE);
  }
}

/** Contenido por defecto con un bug letal: la partida avanzada muere en su primer tick. */
const lethal = (): RunConfig => {
  const base = aDefaultConfig();
  const types = base.enemies.types.map((t) => (t.id === 'bug' ? { ...t, damage: 1e6 } : t));
  return { ...base, enemies: { types } };
};

/** Partida terminada con derrota en el tick 1 con nivel 15, guardrail 2, 900 bajas, enemigos y gemas. */
function advancedAndLost(): TickRun {
  const s = started(lethal(), {
    player: CENTER,
    enemies: [
      { type: 'bug', ...CENTER },
      { type: 'memory-leak', x: 100, y: 100 },
    ],
    gems: [{ x: 40, y: 40, value: 1 }],
    experience: { level: 15, xp: 0 },
    upgrades: { guardrail: 2 },
    kills: 900,
  });
  s.tickRun.execute(TICK_MS, PlayerInput.NONE);
  return s.tickRun;
}

describe('RestartRun · solo desde una partida terminada (spec run-results)', () => {
  it('Scenario: R durante la partida (en curso: error not-over, sin tocar la partida ni el azar)', () => {
    const spy = nextRandomSpy();
    const current = started(aDefaultConfig());
    frames(current, 500);
    const before = current.tickRun.snapshot();

    const r = new RestartRun(aDefaultConfig(), spy.next).execute(current.tickRun);

    expect(r).toEqual({ ok: false, error: { code: 'not-over' } });
    expect(spy.calls).toBe(0);
    expect(current.tickRun.snapshot()).toStrictEqual(before);
  });

  it('Scenario: R mientras se elige mejora (eligiendo: error not-over y la misma oferta)', () => {
    const spy = nextRandomSpy();
    const current = started(aDefaultConfig(), {
      player: CENTER,
      gems: [{ x: 500, y: 270, value: 1 }],
      experience: { level: 1, xp: 4 },
    });
    current.tickRun.execute(TICK_MS, PlayerInput.NONE);
    const before = current.tickRun.snapshot();

    const r = new RestartRun(aDefaultConfig(), spy.next).execute(current.tickRun);

    expect(before.status).toBe('choosing');
    expect(r.ok).toBe(false);
    expect(spy.calls).toBe(0);
    expect(current.tickRun.snapshot()).toStrictEqual(before);
    expect(current.chooseUpgrade.execute(0).ok).toBe(true);
  });
});

/** Partida terminada con victoria: 1 s de duración, sin director. */
function won(): TickRun {
  const config = { ...aDefaultConfig(), run: { durationSeconds: 1 } };
  const s = started(config);
  frames(s, 60);
  return s.tickRun;
}

describe('RestartRun · partida nueva desde una terminada (spec run-results)', () => {
  it('Scenario: Estado inicial tras reiniciar una partida avanzada (tick 0, todo de cero)', () => {
    const spy = nextRandomSpy();
    const current = advancedAndLost();
    const ended = current.snapshot();

    const r = new RestartRun(aDefaultConfig(), spy.next).execute(current);
    const fresh = r.ok ? r.value.tickRun.snapshot() : null;

    expect(ended).toMatchObject({ status: 'over', outcome: 'lost', kills: 900 });
    expect(ended.player.maxHealth).toBe(140);
    expect(ended.progression.level).toBe(15);
    expect(ended.enemies.length * ended.projectiles.length * ended.gems.length).toBeGreaterThan(0);
    expect(spy.calls).toBe(1);
    expect(fresh).toMatchObject({
      tick: 0,
      status: 'running',
      outcome: null,
      kills: 0,
      player: { health: 100, maxHealth: 100, invulnerable: false },
      progression: { level: 1, xp: 0, xpToNext: 5 },
      upgrades: [],
      offer: [],
      enemies: [],
      projectiles: [],
      pulses: [],
      gems: [],
      weapons: [
        { id: 'linter', ready: true },
        { id: 'tests', ready: true },
      ],
    });
  });

  it('reinicia también tras una victoria, con un generador nuevo por reinicio', () => {
    const spy = nextRandomSpy();
    const restart = new RestartRun(aDefaultConfig(), spy.next);
    const current = won();

    const r = restart.execute(current);

    expect(current.snapshot().outcome).toBe('won');
    expect(r.ok && r.value.tickRun.snapshot()).toMatchObject({ tick: 0, status: 'running' });
    expect(spy.calls).toBe(1);
  });

  it('Scenario: La partida nueva juega con normalidad (600 ticks: enemigos y disparos)', () => {
    const r = new RestartRun(aDefaultConfig(), nextRandomSpy().next).execute(advancedAndLost());
    if (!r.ok) throw new Error(r.error.code);
    const snaps = [];
    for (let i = 0; i < 600; i++) {
      while (r.value.tickRun.status === 'choosing') r.value.chooseUpgrade.execute(0);
      snaps.push(r.value.tickRun.execute(TICK_MS, PlayerInput.NONE));
    }

    expect(snaps.at(-1)?.tick).toBe(600);
    expect(snaps.some((s) => s.enemies.length > 0)).toBe(true);
    expect(snaps.some((s) => s.projectiles.length > 0 || s.pulses.length > 0)).toBe(true);
  });
});
