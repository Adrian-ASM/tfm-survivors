import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  DEFAULT_UPGRADE_LIST,
  LINTER,
  TESTS,
  aDefaultConfig,
  withScenarioCurve,
  aSegment,
  aWavesConfig,
  anUpgrade,
  upgradesOf,
} from '../support/builders';
import { CountingRandom } from '../support/random';
import { aProbeType, advance, startRun, ticks } from '../support/runs';
import { weaponsOf } from '../support/weapons';

const UP_RIGHT = PlayerInput.of(1, 1);

/**
 * Contenido por defecto sin spawns y con un `probe` de vida enorme. En el tick 1 el Linter dispara
 * (proyectil vivo), Tests lanza su pulso (visible), el probe en contacto golpea al jugador
 * (invulnerable) y se recoge la gema que abre la oferta.
 */
function busyConfig(): RunConfig {
  const base = withScenarioCurve(aDefaultConfig());
  const probe = aProbeType({ health: 1e6, speed: 1e-6 });
  return {
    ...base,
    enemies: { ...base.enemies, types: [...base.enemies.types, probe] },
    waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves,
  };
}

const busySetup: RunSetup = {
  player: { x: 480, y: 270 },
  enemies: [
    { type: 'probe', x: 495, y: 270 },
    { type: 'probe', x: 800, y: 270 },
  ],
  gems: [
    { x: 500, y: 270, value: 1 },
    { x: 530, y: 270, value: 1, attracted: true },
  ],
  experience: { level: 1, xp: 4 },
};

describe('Simulación congelada mientras se elige mejora', () => {
  it('Scenario: 600 ticks con una oferta abierta (snapshot igual, sin errores)', () => {
    const run = startRun(busyConfig(), busySetup);
    const [n] = ticks(run, 1);
    expect(n?.status).toBe('choosing');
    expect(n?.projectiles.length).toBeGreaterThanOrEqual(1);
    expect(n?.pulses).toHaveLength(1);
    expect(n?.gems.length).toBeGreaterThanOrEqual(1);
    expect(n?.player.invulnerable).toBe(true);
    const after = ticks(run, 600, UP_RIGHT);
    expect(after.at(-1)).toEqual(n);
  });

  it('Scenario: Input ignorado mientras se elige (60 ticks con input (1, 0))', () => {
    const run = startRun(busyConfig(), busySetup);
    ticks(run, 1);
    const after = ticks(run, 60, PlayerInput.of(1, 0)).at(-1);
    expect([after?.player.x, after?.player.y]).toEqual([480, 270]);
  });
});

const quietDefault = (patch: Partial<RunConfig> = {}): RunConfig => ({
  ...withScenarioCurve(aDefaultConfig()),
  waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves,
  ...patch,
});
const atPlayer = { x: 480, y: 270 };
const offerOnTick1: RunSetup = {
  player: atPlayer,
  gems: [{ x: 500, y: 270, value: 1 }],
  experience: { level: 1, xp: 4 },
};
const levelsById = (s: { upgrades: readonly { id: string; level: number }[] }) =>
  Object.fromEntries(s.upgrades.map((u) => [u.id, u.level]));

describe('Pausa y reanudación', () => {
  it('Scenario: La pausa no consume azar (600 ticks pedidos en la oferta o ninguno)', () => {
    const a = startRun(busyConfig(), busySetup);
    const b = startRun(busyConfig(), busySetup);
    ticks(a, 1);
    ticks(b, 1);
    ticks(a, 600, UP_RIGHT);
    expect(a.chooseUpgrade(0).ok).toBe(true);
    expect(b.chooseUpgrade(0).ok).toBe(true);
    expect(advance(a, 600)).toEqual(advance(b, 600));
  });

  it('Scenario: La invulnerabilidad no corre durante la pausa (sin daño de 21 a 40, sí en 41)', () => {
    const base = quietDefault({ upgrades: upgradesOf([anUpgrade('context-window')]) });
    const probe = aProbeType({ damage: 10, health: 1e6 });
    const config = { ...base, enemies: { ...base.enemies, types: [...base.enemies.types, probe] } };
    // El probe (1 px/tick) entra en contacto en el tick 10; la gema atraída se recoge en el 20.
    const setup: RunSetup = {
      player: atPlayer,
      enemies: [{ type: 'probe', x: 480 + 35, y: 270 }],
      gems: [{ x: 480, y: 270 - 138, value: 1, attracted: true }],
      experience: { level: 1, xp: 4 },
    };
    const run = startRun(config, setup);
    const first = ticks(run, 20);
    expect(first.findIndex((x) => x.player.health === 90)).toBe(9);
    expect(first.at(-1)?.status).toBe('choosing');
    ticks(run, 600, UP_RIGHT);
    expect(run.chooseUpgrade(0).ok).toBe(true);
    const after = ticks(run, 21);
    expect(after.slice(0, 20).map((x) => x.player.health)).toEqual(Array(20).fill(90));
    expect([after[20]?.tick, after[20]?.player.health]).toEqual([41, 80]);
  });

  it('Scenario: Continuación tras elegir (sin ticks en la oferta: el siguiente es n + 1)', () => {
    const run = startRun(quietDefault(), offerOnTick1);
    ticks(run, 1);
    expect(run.chooseUpgrade(0).ok).toBe(true);
    const [next] = ticks(run, 1);
    expect([next?.tick, next?.status]).toEqual([2, 'running']);
  });
});

describe('Elección de mejora (Run.chooseUpgrade)', () => {
  it('Scenario: Elección válida (sube la elegida, cierra la oferta y vuelve a en curso)', () => {
    const run = startRun(quietDefault(), offerOnTick1);
    const [n] = ticks(run, 1);
    const ids = n?.offer.map((o) => o.id) ?? [];
    expect(run.chooseUpgrade(1)).toEqual({ ok: true, value: undefined });
    const s = run.snapshot();
    expect(levelsById(s)).toEqual({ [ids[1] ?? '']: 1 });
    expect([s.status, s.offer, s.tick]).toEqual(['running', [], 1]);
  });

  it.each([3, -1, 1.5])('Scenario: Índice fuera de rango (%s: error, sin cambios ni azar)', (i) => {
    const random = new CountingRandom(new Mulberry32RandomGenerator(5));
    const run = startRun(quietDefault(), offerOnTick1, random);
    const [n] = ticks(run, 1);
    const calls = random.calls;
    expect(run.chooseUpgrade(i)).toEqual({
      ok: false,
      error: { code: 'choice-out-of-range', index: i, size: 3 },
    });
    expect(run.snapshot()).toEqual(n);
    expect(random.calls).toBe(calls);
    expect(run.chooseUpgrade(2).ok).toBe(true);
  });

  it('Scenario: Índice fuera de rango (2 con 2 opciones)', () => {
    const list = [anUpgrade('guardrail'), anUpgrade('shortcuts')];
    const run = startRun(quietDefault({ upgrades: upgradesOf(list) }), offerOnTick1);
    const [n] = ticks(run, 1);
    expect(n?.offer).toHaveLength(2);
    expect(run.chooseUpgrade(2)).toMatchObject({
      ok: false,
      error: { code: 'choice-out-of-range' },
    });
    expect(run.snapshot()).toEqual(n);
  });

  it('Scenario: Sin oferta abierta (en curso y terminada: no-offer y snapshot igual)', () => {
    const running = startRun(quietDefault(), { player: atPlayer });
    const before = running.snapshot();
    expect(running.chooseUpgrade(0)).toEqual({ ok: false, error: { code: 'no-offer' } });
    expect(running.snapshot()).toEqual(before);
    const base = quietDefault();
    const killer = aProbeType({ damage: 10, health: 1e6 });
    const dying = startRun(
      {
        ...base,
        player: { ...base.player, maxHealth: 10 },
        enemies: { ...base.enemies, types: [...base.enemies.types, killer] },
      },
      { player: atPlayer, enemies: [{ type: 'probe', ...atPlayer }] },
    );
    ticks(dying, 1);
    const over = dying.snapshot();
    expect(over.status).toBe('over');
    expect(dying.chooseUpgrade(0)).toEqual({ ok: false, error: { code: 'no-offer' } });
    expect(dying.snapshot()).toEqual(over);
  });

  it('Scenario: La segunda oferta tras la primera elección (sin ticks; después n + 1)', () => {
    const setup = {
      ...offerOnTick1,
      gems: [{ x: 500, y: 270, value: 16 }],
      experience: { level: 1, xp: 0 },
    };
    const run = startRun(quietDefault(), setup);
    ticks(run, 1);
    expect(run.chooseUpgrade(0).ok).toBe(true);
    const second = run.snapshot();
    expect([second.tick, second.status, second.offer.length]).toEqual([1, 'choosing', 3]);
    expect(second.progression.pendingLevelUps).toBe(1);
    expect(run.chooseUpgrade(0).ok).toBe(true);
    expect(run.snapshot().status).toBe('running');
    expect(ticks(run, 1)[0]?.tick).toBe(2);
  });

  // "La disponibilidad se recalcula entre ofertas encoladas" (0024, con la curación): run-levelup-heal.
  it('Scenario: Ninguna disponible (todas al máximo: nivel 8 sin oferta y el tick n + 1 normal)', () => {
    const run = startRun(quietDefault(), {
      player: atPlayer,
      gems: [{ x: 500, y: 270, value: 1 }],
      experience: { level: 7, xp: 34 },
      upgrades: Object.fromEntries(DEFAULT_UPGRADE_LIST.map((u) => [u.id, u.maxLevel])),
    });
    const [n, next] = ticks(run, 2);
    expect(n?.progression).toMatchObject({ level: 8, xp: 0, pendingLevelUps: 0 });
    expect([n?.status, n?.offer, next?.tick]).toEqual(['running', [], 2]);
  });

  it('Scenario: Mejora en su nivel máximo (shortcuts a 5: figura con nivel 5 y no sale)', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const run = startRun(
        quietDefault(),
        { ...offerOnTick1, upgrades: { shortcuts: 5 } },
        new Mulberry32RandomGenerator(seed),
      );
      const [n] = ticks(run, 1);
      expect(n?.offer.map((o) => o.id)).not.toContain('shortcuts');
      expect(n?.upgrades).toEqual([{ id: 'shortcuts', level: 5 }]);
    }
  });
});

describe('Cadencia y elecciones', () => {
  const still = aProbeType({ health: 1e6, speed: 1e-6 });
  function weaponRun(
    weapons: readonly (typeof LINTER)[],
    list: readonly ReturnType<typeof anUpgrade>[],
    setup: RunSetup,
  ) {
    const base = quietDefault({ upgrades: upgradesOf(list) });
    const config: RunConfig = {
      ...base,
      enemies: { ...base.enemies, types: [...base.enemies.types, still] },
      weapons: weaponsOf(weapons),
    };
    return startRun(config, { player: atPlayer, ...setup });
  }
  /** Ticks en los que aparece un proyectil nuevo. */
  const launches = (snaps: readonly { tick: number; projectiles: readonly { id: number }[] }[]) => {
    let seen = -1;
    const out: number[] = [];
    for (const s of snaps) {
      const top = Math.max(-1, ...s.projectiles.map((p) => p.id));
      if (top > seen) out.push(s.tick);
      seen = Math.max(seen, top);
    }
    return out;
  };
  const target = [{ type: 'probe', x: 530, y: 270 }];
  /** Gema atraída que se recoge en el tick `n` (6 px por tick, recogida a < 21). */
  const gemOnTick = (n: number) => [
    { x: 480 + 21 + 6 * (n - 1) + 3, y: 270, value: 1, attracted: true },
  ];

  it('Scenario: La pausa no adelanta la recarga (oferta en el tick 5 con 600 ticks pedidos)', () => {
    const run = weaponRun([LINTER], [anUpgrade('guardrail')], {
      enemies: target,
      gems: gemOnTick(5),
      experience: { level: 1, xp: 4 },
    });
    const before = ticks(run, 5);
    expect(before.at(-1)?.status).toBe('choosing');
    ticks(run, 600, UP_RIGHT);
    expect(run.chooseUpgrade(0).ok).toBe(true);
    const after = ticks(run, 26);
    expect(after.at(-1)?.tick).toBe(31);
    expect(launches([...before, ...after])).toEqual([1, 31]);
  });

  it('Scenario: Cadencia de Tests mejorada (watch-mode 1 antes del tick 1: 1, 79 y 157)', () => {
    const run = weaponRun([TESTS], [anUpgrade('watch-mode')], {
      enemies: target,
      upgrades: { 'watch-mode': 1 },
    });
    const fired = ticks(run, 157)
      .filter((s) => s.pulses.some((p) => p.firedAt === s.tick))
      .map((s) => s.tick);
    expect(fired).toEqual([1, 79, 157]);
  });
});
