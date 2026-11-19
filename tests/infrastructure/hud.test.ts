import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Hud } from '../../src/infrastructure/phaser/Hud';
import { XpBar } from '../../src/infrastructure/phaser/XpBar';
import { aDefaultConfig } from '../support/builders';
import { startRun } from '../support/runs';
import { FakeBar, FakeLabel } from '../support/sprites';

const HEALTH_WIDTH = 200;
const XP_WIDTH = 300;
const BAR_HEIGHT = 8;

const fresh = (): RunSnapshot => startRun(aDefaultConfig()).snapshot();

/** Snapshot por defecto con cambios (vida, bajas, tick, progresión, estado). */
function snap(
  patch: {
    tick?: number;
    health?: number;
    maxHealth?: number;
    kills?: number;
    level?: number;
    xp?: number;
    xpToNext?: number;
    over?: boolean;
    choosing?: boolean;
  } = {},
): RunSnapshot {
  const base = fresh();
  const phase = patch.over
    ? ({ status: 'over', outcome: 'lost' } as const)
    : patch.choosing
      ? ({ status: 'choosing', outcome: null } as const)
      : ({ status: 'running', outcome: null } as const);
  return {
    ...base,
    ...phase,
    tick: patch.tick ?? base.tick,
    kills: patch.kills ?? base.kills,
    player: {
      ...base.player,
      health: patch.health ?? base.player.health,
      maxHealth: patch.maxHealth ?? base.player.maxHealth,
    },
    progression: {
      ...base.progression,
      level: patch.level ?? base.progression.level,
      xp: patch.xp ?? base.progression.xp,
      xpToNext: patch.xpToNext ?? base.progression.xpToNext,
    },
  };
}

function hud() {
  const parts = {
    healthFill: new FakeBar(),
    healthLabel: new FakeLabel(),
    clock: new FakeLabel(),
    kills: new FakeLabel(),
    xpFill: new FakeBar(),
    level: new FakeLabel(),
  };
  const xpBar = new XpBar(parts.xpFill, parts.level, XP_WIDTH, BAR_HEIGHT);
  const view = new Hud(
    {
      xpBar,
      healthFill: parts.healthFill,
      healthLabel: parts.healthLabel,
      clock: parts.clock,
      kills: parts.kills,
    },
    HEALTH_WIDTH,
    BAR_HEIGHT,
  );
  return { ...parts, view };
}

const shown = (h: ReturnType<typeof hud>) => [
  h.healthLabel.text,
  h.healthFill.width / HEALTH_WIDTH,
  h.clock.text,
  h.level.text,
  h.xpFill.width / XP_WIDTH,
  h.kills.text,
];

describe('HUD (spec hud)', () => {
  it('Scenario: HUD al empezar (100/100 lleno, 10:00, nivel 1 con la barra vacía, 0 bajas)', () => {
    const h = hud();

    h.view.sync(fresh());

    expect(shown(h)).toEqual(['100/100', 1, '10:00', 'Nv 1', 0, 'Bajas: 0']);
  });

  it('Scenario: HUD con la partida terminada (tick 1.259, nivel 3, 41 bajas; 60 frames más)', () => {
    const h = hud();
    const ended = snap({ tick: 1259, health: 0, level: 3, xpToNext: 15, kills: 41, over: true });

    h.view.sync(ended);
    const first = shown(h);
    const writes = h.clock.writes + h.healthLabel.writes + h.kills.writes + h.level.writes;
    for (let i = 0; i < 60; i++) h.view.sync(ended);

    expect(first).toEqual(['0/100', 0, '09:40', 'Nv 3', 0, 'Bajas: 41']);
    expect(shown(h)).toEqual(first);
    expect(h.clock.writes + h.healthLabel.writes + h.kills.writes + h.level.writes).toBe(writes);
  });

  it('Scenario: Golpe entre dos snapshots (100 ⇒ 90 de 100)', () => {
    const h = hud();
    h.view.sync(snap({ health: 100 }));

    h.view.sync(snap({ health: 90 }));

    expect(h.healthFill.width / HEALTH_WIDTH).toBeCloseTo(0.9, 3);
    expect(h.healthLabel.text).toBe('90/100');
  });

  it('Scenario: Bajas que cambian entre snapshots (9 ⇒ 12)', () => {
    const h = hud();
    h.view.sync(snap({ kills: 9 }));

    h.view.sync(snap({ kills: 12 }));

    expect([h.kills.text, h.kills.writes]).toEqual(['Bajas: 12', 2]);
  });

  it('Scenario: Sin bajas', () => {
    const h = hud();

    h.view.sync(snap({ kills: 0 }));

    expect(h.kills.text).toBe('Bajas: 0');
  });

  it('Scenario: Barra de XP dentro del HUD (nivel 2, XP 3 de 10 ⇒ 0,3)', () => {
    const h = hud();

    h.view.sync(snap({ level: 2, xp: 3, xpToNext: 10 }));

    expect(h.level.text).toBe('Nv 2');
    expect(h.xpFill.width / XP_WIDTH).toBeCloseTo(0.3, 3);
  });

  it('Scenario: El tiempo no corre mientras se elige mejora (oferta en el tick 600: 09:50)', () => {
    const h = hud();
    const choosing = snap({ tick: 600, choosing: true });

    const clocks = Array.from({ length: 600 }, () => {
      h.view.sync(choosing);
      return h.clock.text;
    });

    expect(clocks.every((c) => c === '09:50')).toBe(true);
    expect(h.clock.writes).toBe(1);
  });

  it('solo cambia el texto del reloj una vez por segundo', () => {
    const h = hud();

    for (let t = 0; t <= 120; t++) h.view.sync(snap({ tick: t }));

    expect([h.clock.text, h.clock.writes]).toEqual(['09:58', 3]);
  });
});
