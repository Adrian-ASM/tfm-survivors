import { describe, expect, it } from 'vitest';
import { Run } from '../../src/domain/run/Run';
import {
  SETUP_EXPERIENCE_OUT_OF_RANGE,
  SETUP_GEM_VALUE_MUST_BE_INTEGER,
  SETUP_TOO_MANY_GEMS,
} from '../../src/domain/run/RunSetup';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { SCENARIO_PROGRESSION, aDefaultConfig, aRunConfig } from '../support/builders';
import { startRun } from '../support/runs';

describe('Nivel y XP iniciales', () => {
  it('Scenario: Partida recién creada (nivel 1, XP 0, xpToNext 9, listas vacías, sin oferta)', () => {
    const snap = startRun(aDefaultConfig()).snapshot();
    expect(snap.status).toBe('running');
    expect(snap.progression).toEqual({ level: 1, xp: 0, xpToNext: 9, pendingLevelUps: 0 });
    expect([snap.gems, snap.offer, snap.upgrades]).toEqual([[], [], []]);
    expect([snap.enemies, snap.projectiles, snap.pulses]).toEqual([[], [], []]);
    expect([snap.player.health, snap.player.maxHealth]).toEqual([100, 100]);
  });

  it('RunSetup coloca gemas (en orden, con su valor) y la experiencia inicial', () => {
    const run = startRun(aRunConfig(), {
      gems: [
        { x: 100, y: 100, value: 3 },
        { x: 200, y: 50, value: 1, attracted: true },
      ],
      experience: { level: 3, xp: 14 },
    });
    const snap = run.snapshot();
    expect(snap.gems).toMatchObject([
      { id: 0, x: 100, y: 100, radius: 5 },
      { id: 1, x: 200, y: 50, radius: 5 },
    ]);
    expect(snap.progression).toEqual({ level: 3, xp: 14, xpToNext: 15, pendingLevelUps: 0 });
  });
});

describe('RunSetup · validación de gemas y experiencia', () => {
  const fail = (setup: Parameters<typeof Run.start>[2], maxGems = 300) => {
    const config = { ...aRunConfig(), progression: { ...SCENARIO_PROGRESSION, maxGems } };
    const r = Run.start(config, new Mulberry32RandomGenerator(1), setup);
    if (r.ok) throw new Error('se esperaba un error');
    return r.error;
  };

  it.each([0, 1.5, -2])('rechaza una gema de valor %s', (value) => {
    expect(fail({ gems: [{ x: 1, y: 1, value }] })).toMatchObject({
      field: 'setup.gems.0.value',
      message: SETUP_GEM_VALUE_MUST_BE_INTEGER,
    });
  });

  it('rechaza más gemas que maxGems y posiciones no finitas', () => {
    const two = [
      { x: 1, y: 1, value: 1 },
      { x: 2, y: 2, value: 1 },
    ];
    expect(fail({ gems: two }, 1)).toMatchObject({
      field: 'setup.gems',
      message: SETUP_TOO_MANY_GEMS,
    });
    expect(fail({ gems: [{ x: Number.NaN, y: 1, value: 1 }] }).field).toBe('setup.gems.0');
  });

  it.each([
    { level: 0, xp: 0 },
    { level: 1.5, xp: 0 },
    { level: 1, xp: 5 },
    { level: 2, xp: -1 },
    { level: 2, xp: 0.5 },
  ])('rechaza la experiencia inicial %o', (experience) => {
    expect(fail({ experience })).toMatchObject({
      field: 'setup.experience',
      message: SETUP_EXPERIENCE_OUT_OF_RANGE,
    });
  });
});
