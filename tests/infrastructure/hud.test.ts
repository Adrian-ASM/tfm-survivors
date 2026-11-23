import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type Phaser from 'phaser';
import { Hud, type HudPlacement } from '../../src/infrastructure/phaser/Hud';
import { screenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
import { hudLayout, type HudLayout } from '../../src/infrastructure/phaser/ui/uiLayout';
import {
  createHud,
  createResultsOverlay,
  createUpgradeOverlay,
} from '../../src/infrastructure/phaser/sceneWidgets';
import { XpBar } from '../../src/infrastructure/phaser/XpBar';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aDefaultConfig, withPlayer } from '../support/builders';
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

describe('El HUD solo lee el snapshot', () => {
  it('Scenario: El HUD no altera la simulación (pintada y sin pintar: snapshots iguales)', () => {
    const config = withPlayer(aDefaultConfig(), { maxHealth: 1e9 });
    const painted = startRun(config, {}, new Mulberry32RandomGenerator(42));
    const plain = startRun(config, {}, new Mulberry32RandomGenerator(42));
    const h = hud();
    const pairs = Array.from({ length: 4800 }, () => {
      for (const r of [painted, plain]) {
        while (r.status === 'choosing') r.chooseUpgrade(0);
        r.tick(PlayerInput.NONE);
      }
      const s = painted.snapshot();
      h.view.sync(s);
      return [s, plain.snapshot()] as const;
    });
    const last = pairs.at(-1)?.[0];

    expect(last?.kills).toBeGreaterThan(0);
    expect(pairs.some(([s]) => s.player.health < s.player.maxHealth)).toBe(true);
    expect(pairs.every(([a, b]) => JSON.stringify(a) === JSON.stringify(b))).toBe(true);
  });
});

/** Objeto del motor falso: guarda posición y scrollFactor; cualquier otro método encadena. */
interface Made {
  kind: string;
  x: number;
  y: number;
  scrollFactor: number | null;
  fontSize: number | null;
}

/** Escena falsa con `scale` (la vista) y `add.rectangle`/`add.text` que registran lo creado. */
function fakeScene(view: { width: number; height: number }) {
  const made: Made[] = [];
  const make = (kind: string, x: number, y: number): unknown => {
    const state: Made = { kind, x, y, scrollFactor: null, fontSize: null };
    made.push(state);
    const proxy: unknown = new Proxy(state, {
      get(target, prop) {
        if (prop === 'setScrollFactor') {
          return (v: number) => ((target.scrollFactor = v), proxy);
        }
        if (prop === 'setFontSize') {
          return (v: number) => ((target.fontSize = v), proxy);
        }
        if (prop === 'setPosition') {
          return (px: number, py: number) => ((target.x = px), (target.y = py), proxy);
        }
        if (prop in target) return target[prop as keyof Made];
        return () => proxy;
      },
    });
    return proxy;
  };
  const scene = {
    scale: view,
    add: {
      rectangle: (x: number, y: number) => make('rectangle', x, y),
      text: (x: number, y: number) => make('text', x, y),
    },
  };
  return { scene: scene as unknown as Phaser.Scene, made };
}

// Spec world-camera (0013), "HUD con la cámara movida" (parte unitaria): todos los widgets fijos a
// la cámara (scrollFactor 0) y en coordenadas de la vista, sea cual sea el rectángulo visible.
describe('Widgets fijos en pantalla (0013)', () => {
  it('Scenario: HUD con la cámara movida (HUD, velo, cartas y resultados con scrollFactor 0)', () => {
    const view = { width: 960, height: 540 };
    const { scene, made } = fakeScene(view);

    createHud(scene, screenFrame(view.width, view.height));
    const offer = createUpgradeOverlay(scene);
    const results = createResultsOverlay(scene);
    offer.sync(
      ['strict-rules', 'guardrail', 'shortcuts'].map((id) => ({
        id,
        name: id,
        description: id,
        level: 0,
        nextLevel: 1,
      })),
    );
    results.sync(snap({ over: true }));

    expect(made.length).toBeGreaterThan(10);
    expect(made.filter((m) => m.scrollFactor !== 0)).toEqual([]);
    const outside = made.filter((m) => m.x < 0 || m.x > view.width || m.y < 0 || m.y > view.height);
    expect(outside).toEqual([]);
  });
});

/** Colocación falsa: cuenta las llamadas y guarda el último layout. */
class FakePlacement implements HudPlacement {
  calls: { layout: HudLayout; rescale: boolean }[] = [];
  place(layout: HudLayout, rescale: boolean): void {
    this.calls.push({ layout, rescale });
  }
}

function placedHud(frame = screenFrame(960, 540)) {
  const placement = new FakePlacement();
  const fill = new FakeBar();
  const xpFill = new FakeBar();
  const layout = hudLayout(frame);
  const xpBar = new XpBar(xpFill, new FakeLabel(), layout.barWidth, layout.barHeight);
  const view = new Hud(
    {
      xpBar,
      healthFill: fill,
      healthLabel: new FakeLabel(),
      clock: new FakeLabel(),
      kills: new FakeLabel(),
      placement,
    },
    layout.barWidth,
    layout.barHeight,
  );
  return { view, placement, fill, xpFill };
}

// Spec world-camera (0017), "Redimensionado de la ventana"; hud, "Cambio de escalón al redimensionar".
describe('Hud.relayout (0017)', () => {
  it('tras relayout con otro ancho de barra el relleno se recalcula (caché invalidada)', () => {
    const h = placedHud();
    h.view.sync(snap({ health: 50, level: 2, xp: 5, xpToNext: 10 }));
    expect([h.fill.width, h.xpFill.width]).toEqual([120, 120]);

    h.view.relayout(hudLayout(screenFrame(1920, 1080)));

    expect([h.fill.width, h.fill.height]).toEqual([240, 20]);
    expect([h.xpFill.width, h.xpFill.height]).toEqual([240, 20]);
  });

  it('Scenario: Mismo tamaño (relayout con el mismo frame no recoloca nada)', () => {
    const h = placedHud();
    h.view.relayout(hudLayout(screenFrame(960, 540)));
    const resizes = h.fill.resizes;

    h.view.relayout(hudLayout(screenFrame(960, 540)));

    expect(h.placement.calls).toHaveLength(1);
    expect(h.fill.resizes).toBe(resizes);
  });

  it('Scenario: Cambio de escalón al redimensionar (×1 → ×2 vuelve a pintar el texto)', () => {
    const h = placedHud();
    h.view.relayout(hudLayout(screenFrame(1280, 720)));
    h.view.relayout(hudLayout(screenFrame(1000, 600)));
    h.view.relayout(hudLayout(screenFrame(2560, 1440)));

    expect(h.placement.calls.map((c) => c.rescale)).toEqual([false, false, true]);
  });
});

describe('createHud con relayout (0017)', () => {
  it('Scenario: Muchos cambios seguidos (50 relayouts: ningún objeto nuevo, último frame)', () => {
    const { scene, made } = fakeScene({ width: 1280, height: 720 });
    const h = createHud(scene, screenFrame(1280, 720));
    const created = made.length;
    const frames = [screenFrame(1280, 720), screenFrame(1000, 600), screenFrame(2560, 1440)];

    for (let i = 0; i < 50; i++) h.relayout(hudLayout(frames[i % 3] ?? screenFrame(1, 1)));
    const last = hudLayout(frames[49 % 3] ?? screenFrame(1, 1));

    expect(made.length).toBe(created);
    const kills = made.filter((m) => m.kind === 'text').map((m) => m.x);
    expect(kills).toContain(last.kills.x);
    expect(made.filter((m) => m.kind === 'text').every((m) => m.fontSize === last.fontSize)).toBe(
      true,
    );
  });
});
