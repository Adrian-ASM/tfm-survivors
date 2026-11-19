import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import {
  Run,
  SETUP_HEALTH_OUT_OF_RANGE,
  SPEED_MUST_BE_POSITIVE,
  type RunSetup,
} from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { UNKNOWN_ENEMY_TYPE } from '../../src/domain/wave/WaveTable';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aRunConfig, aSegment, aWavesConfig } from '../support/builders';

function startedRun(config: RunConfig = aRunConfig(), setup?: RunSetup): Run {
  const r = Run.start(config, new Mulberry32RandomGenerator(42), setup);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('Run', () => {
  it('Partida recién creada sin enemigos: jugador en el centro y lista vacía', () => {
    expect(startedRun().snapshot()).toEqual({
      tick: 0,
      status: 'running',
      outcome: null,
      durationTicks: 36_000,
      kills: 0,
      player: { x: 480, y: 270, radius: 16, health: 100, maxHealth: 100, invulnerable: false },
      enemies: [],
      projectiles: [],
      pulses: [],
      weapons: [],
      gems: [],
      progression: { level: 1, xp: 0, xpToNext: 5, pendingLevelUps: 0 },
      offer: [],
      upgrades: [],
    });
  });

  it('Vida máxima mínima válida: la partida empieza con vida 1', () => {
    const { player, status } = startedRun(aRunConfig({ maxHealth: 1 })).snapshot();
    expect([player.health, player.maxHealth, player.invulnerable, status]).toEqual([
      1,
      1,
      false,
      'running',
    ]);
  });

  it('Contador de ticks', () => {
    const run = startedRun();
    for (let i = 0; i < 90; i++) run.tick(PlayerInput.NONE);
    expect(run.snapshot().tick).toBe(90);
  });

  it('el jugador se mueve igual que en 0001 (sin enemigos que lo afecten)', () => {
    const right = PlayerInput.of(1, 0);
    const run = startedRun();
    for (let i = 0; i < 11; i++) run.tick(right);
    expect(run.snapshot().player.x).toBeCloseTo(480 + (11 * 200) / 60, 9);
  });

  it('rechaza un radio que no cabe en la arena', () => {
    const r = Run.start(aRunConfig({ radius: 300 }), new Mulberry32RandomGenerator(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toContain('radius');
  });

  it.each([-5, 0, Number.NaN, Number.POSITIVE_INFINITY])(
    'rechaza una velocidad no positiva o no finita (%s), igual que zod',
    (speed) => {
      const r = Run.start(aRunConfig({ speed }), new Mulberry32RandomGenerator(1));
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.field).toBe('player.speed');
        expect(r.error.message).toBe(SPEED_MUST_BE_POSITIVE);
      }
    },
  );

  it('mantiene las reglas del contenido de enemigos como defensa', () => {
    const config = aWavesConfig({ segments: [aSegment(['bug', 'segfault'], 1)] });
    const r = Run.start(config, new Mulberry32RandomGenerator(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('segfault');
  });
});

describe('Run · snapshot con enemigos', () => {
  const bugsOnly = (budgetPerSecond: number): RunConfig =>
    aWavesConfig({ segments: [aSegment(['bug'], budgetPerSecond)] });

  it('Enemigos en el snapshot', () => {
    const run = startedRun(bugsOnly(1));
    for (let i = 0; i < 615; i++) run.tick(PlayerInput.NONE);
    const { enemies } = run.snapshot();
    expect(enemies).toHaveLength(10);
    expect(enemies.every((e) => e.type === 'bug' && e.radius === 10 && e.health === 10)).toBe(true);
    expect(new Set(enemies.map((e) => e.id)).size).toBe(10);
    expect(enemies.map((e) => e.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('Identificador estable', () => {
    const run = startedRun(bugsOnly(1));
    for (let i = 0; i < 130; i++) run.tick(PlayerInput.NONE);
    const before = run.snapshot().enemies;
    run.tick(PlayerInput.NONE);
    const after = run.snapshot().enemies;
    for (const e of before) {
      expect(after.find((a) => a.id === e.id)).toMatchObject({ type: e.type, radius: e.radius });
    }
  });

  it('Snapshot no mutable desde fuera (jugador, enemigo y lista)', () => {
    const right = PlayerInput.of(1, 0);
    const run = startedRun(bugsOnly(630));
    for (let i = 0; i < 10; i++) run.tick(right);
    const snap = run.snapshot();
    const enemy = snap.enemies[0];
    expect(enemy).toBeDefined();
    expect(() => {
      (snap.player as { x: number }).x = 999;
    }).toThrow(TypeError);
    expect(() => {
      (snap as { tick: number }).tick = 0;
    }).toThrow(TypeError);
    expect(() => {
      (enemy as { x: number }).x = 999;
    }).toThrow(TypeError);
    expect(() => {
      (snap.enemies as unknown[]).length = 0;
    }).toThrow(TypeError);
    expect(() => {
      (snap.player as { health: number }).health = 0;
    }).toThrow(TypeError);
    expect(() => {
      (snap.player as { invulnerable: boolean }).invulnerable = true;
    }).toThrow(TypeError);
    expect(() => {
      (snap as { status: string }).status = 'over';
    }).toThrow(TypeError);
    expect(() => {
      (enemy as { health: number }).health = 0;
    }).toThrow(TypeError);
    run.tick(right);
    const next = run.snapshot();
    expect(next.tick).toBe(11);
    expect(next.player.x).toBeCloseTo(480 + (11 * 200) / 60, 9);
    expect(next.enemies.length).toBeGreaterThanOrEqual(snap.enemies.length);
    expect(next.enemies[0]?.x).not.toBe(999);
  });

  it('cada snapshot es una copia nueva', () => {
    const run = startedRun(bugsOnly(630));
    run.tick(PlayerInput.NONE);
    expect(run.snapshot().enemies).not.toBe(run.snapshot().enemies);
  });
});

describe('Run · estado inicial opcional (RunSetup)', () => {
  it('coloca al jugador y lo recorta a la arena', () => {
    expect(startedRun(aRunConfig(), { player: { x: 16, y: 16 } }).snapshot().player).toMatchObject({
      x: 16,
      y: 16,
      radius: 16,
    });
    expect(startedRun(aRunConfig(), { player: { x: -5, y: 999 } }).snapshot().player).toMatchObject(
      {
        x: 16,
        y: 524,
        radius: 16,
      },
    );
  });

  it('coloca enemigos iniciales con el radio de su tipo, recortados a la arena', () => {
    const run = startedRun(aRunConfig(), {
      enemies: [
        { type: 'bug', x: 100, y: 270 },
        { type: 'memory-leak', x: 2000, y: 0 },
      ],
    });
    expect(run.snapshot().enemies).toEqual([
      { id: 0, type: 'bug', x: 100, y: 270, radius: 10, health: 10, damaged: false },
      { id: 1, type: 'memory-leak', x: 938, y: 22, radius: 22, health: 45, damaged: false },
    ]);
  });

  it('rechaza un enemigo inicial de un tipo que no existe', () => {
    const setup = { enemies: [{ type: 'segfault', x: 1, y: 1 }] };
    const r = Run.start(aRunConfig(), new Mulberry32RandomGenerator(1), setup);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.field).toBe('setup.enemies.0.type');
      expect(r.error.message).toBe(`${UNKNOWN_ENEMY_TYPE}: segfault`);
    }
  });

  it('rechaza posiciones iniciales no finitas', () => {
    const r = Run.start(aRunConfig(), new Mulberry32RandomGenerator(1), {
      player: { x: Number.NaN, y: 0 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe('setup.player');
  });

  it('Scenario: Armas equipadas al inicio (vida inicial de un enemigo fijada al preparar)', () => {
    const run = startedRun(aRunConfig(), {
      enemies: [
        { type: 'bug', x: 100, y: 100, health: 4 },
        { type: 'bug', x: 200, y: 100 },
      ],
    });
    expect(run.snapshot().enemies.map((e) => e.health)).toEqual([4, 10]);
  });

  it.each([0, -1, 11, Number.NaN, Number.POSITIVE_INFINITY])(
    'rechaza una vida inicial fuera de (0, health del tipo] (%s)',
    (health) => {
      const setup = {
        enemies: [
          { type: 'bug', x: 100, y: 100 },
          { type: 'bug', x: 1, y: 1, health },
        ],
      };
      const r = Run.start(aRunConfig(), new Mulberry32RandomGenerator(1), setup);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.field).toBe('setup.enemies.1.health');
        expect(r.error.message).toBe(SETUP_HEALTH_OUT_OF_RANGE);
      }
    },
  );
});
