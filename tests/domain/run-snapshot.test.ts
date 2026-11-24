import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import {
  DEFAULT_UPGRADE_LIST,
  aDefaultConfig,
  withScenarioCurve,
  aSegment,
  aWavesConfig,
  withDuration,
} from '../support/builders';
import { startRun, ticks } from '../support/runs';

const quiet = (patch: Partial<RunConfig> = {}): RunConfig => ({
  ...withScenarioCurve(aDefaultConfig()),
  waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves,
  ...patch,
});
const CENTER = { x: 480, y: 270 };

describe('Snapshot con resultado, duración y bajas (0006)', () => {
  it('Scenario: Partida recién creada (sin resultado, 0 bajas y 36.000 ticks de duración)', () => {
    const snap = startRun(withScenarioCurve(aDefaultConfig())).snapshot();

    expect(snap).toMatchObject({
      tick: 0,
      status: 'running',
      outcome: null,
      kills: 0,
      durationTicks: 36_000,
      enemies: [],
      projectiles: [],
      pulses: [],
      gems: [],
      pickups: [],
      veins: [],
      resources: { gold: 0, wood: 0 },
      upgrades: [],
      offer: [],
      player: { health: 100, maxHealth: 100, invulnerable: false },
      progression: { level: 1, xp: 0, xpToNext: 5 },
      weapons: [
        { id: 'linter', ready: true },
        { id: 'tests', ready: true },
      ],
    });
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it('Scenario: Duración objetivo constante (90 s ⇒ 5.400 ticks en 0, 1, 2.000 y con oferta)', () => {
    const setup: RunSetup = {
      player: CENTER,
      gems: [{ x: 500, y: 270, value: 1 }],
      experience: { level: 1, xp: 4 },
    };
    const run = startRun(withDuration(quiet(), 90), setup);
    const at0 = run.snapshot().durationTicks;
    const [first] = ticks(run, 1);
    while (run.status === 'choosing') run.chooseUpgrade(0);
    const later = ticks(run, 1999).at(-1);

    expect(first?.status).toBe('choosing');
    expect([at0, first?.durationTicks, later?.tick, later?.durationTicks]).toEqual([
      5400, 5400, 2000, 5400,
    ]);
  });
});

describe('Snapshot no mutable desde fuera (resultado, bajas y duración)', () => {
  it('Scenario: Snapshot no mutable desde fuera (partida en curso y partida terminada)', () => {
    const lethal = {
      ...withScenarioCurve(aDefaultConfig()),
      player: { ...withScenarioCurve(aDefaultConfig()).player, maxHealth: 1 },
    };
    const live = startRun(quiet());
    const ended = startRun(lethal, {
      player: CENTER,
      enemies: [{ type: 'goblin-torch', ...CENTER }],
    });
    ticks(ended, 1);
    for (const run of [live, ended]) {
      const snap = run.snapshot();
      const before = structuredClone(snap);
      const mutations = [
        () => ((snap as { outcome: string | null }).outcome = 'won'),
        () => ((snap as { kills: number }).kills = 99),
        () => ((snap as { durationTicks: number }).durationTicks = 1),
        () => ((snap as { status: string }).status = 'over'),
      ];
      for (const m of mutations) expect(m).toThrow(TypeError);
      expect(run.snapshot()).toEqual(before);
    }
    expect([ended.status, ended.outcome]).toEqual(['over', 'lost']);
  });
});

describe('Snapshot ampliado', () => {
  it('Scenario: Oferta en el snapshot (guardrail en nivel 2: opción 2 → 3 y adquirida con 2)', () => {
    const guardrail = DEFAULT_UPGRADE_LIST.filter((u) => u.id === 'guardrail');
    const setup: RunSetup = {
      player: CENTER,
      gems: [{ x: 500, y: 270, value: 1 }],
      experience: { level: 1, xp: 4 },
      upgrades: { guardrail: 2 },
    };
    const [first] = ticks(startRun(quiet({ upgrades: { upgrades: guardrail } }), setup), 1);
    expect(first?.offer).toEqual([
      {
        id: 'guardrail',
        name: 'Cota de malla',
        description: 'Más vida máxima (y la misma cantidad de vida actual).',
        level: 2,
        nextLevel: 3,
      },
    ]);
    expect(first?.upgrades).toEqual([{ id: 'guardrail', level: 2 }]);
  });

  it('Scenario: XP acumulada hasta el nivel 3 (15 XP en ticks distintos, eligiendo cada vez)', () => {
    const gems = [
      { x: 500, y: 270, value: 5 },
      { x: 480, y: 270 - 21 - 6 * 4 - 3, value: 4, attracted: true },
      { x: 480, y: 270 + 21 + 6 * 9 + 3, value: 6, attracted: true },
    ];
    const run = startRun(quiet(), { player: CENTER, gems });
    for (let t = 0; t < 12; t++) {
      while (run.status === 'choosing') run.chooseUpgrade(0);
      run.tick(PlayerInput.NONE);
    }
    while (run.status === 'choosing') run.chooseUpgrade(0);
    expect(run.snapshot().progression).toEqual({
      level: 3,
      xp: 0,
      xpToNext: 15,
      pendingLevelUps: 0,
    });
    expect(run.snapshot().upgrades.reduce((n, u) => n + u.level, 0)).toBe(2);
  });

  it('Scenario: Snapshot no mutable desde fuera (gemas, XP, nivel y oferta)', () => {
    const setup: RunSetup = {
      player: CENTER,
      gems: [
        { x: 500, y: 270, value: 1 },
        { x: 100, y: 100, value: 1 },
      ],
      experience: { level: 1, xp: 4 },
    };
    const run = startRun(quiet(), setup);
    ticks(run, 1);
    const snap = run.snapshot();
    expect(snap.offer).toHaveLength(3);
    const mutations = [
      () => ((snap.gems[0] as { x: number }).x = 0),
      () => ((snap.gems as unknown[]).length = 0),
      () => ((snap.progression as { xp: number }).xp = 99),
      () => ((snap.progression as { level: number }).level = 99),
      () => ((snap.offer as unknown[]).length = 0),
      () => ((snap.offer[0] as { id: string }).id = 'x'),
      () => (snap.upgrades as unknown[]).push(1),
      () => ((snap as { status: string }).status = 'running'),
    ];
    for (const m of mutations) expect(m).toThrow(TypeError);
    const offered = snap.offer.map((o) => o.id);
    expect(run.chooseUpgrade(0).ok).toBe(true);
    expect(run.snapshot().upgrades).toEqual([{ id: offered[0], level: 1 }]);
    expect(run.snapshot().gems.map((g) => g.x)).toEqual([100]);
  });
});
