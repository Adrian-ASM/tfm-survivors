import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type Phaser from 'phaser';
import { Hud, type HudPlacement } from '../../src/infrastructure/phaser/Hud';
import { screenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
import { hudLayout, type HudLayout } from '../../src/infrastructure/phaser/ui/uiLayout';
import {
  counterIcon,
  createHud,
  createResultsOverlay,
  createUpgradeOverlay,
} from '../../src/infrastructure/phaser/sceneWidgets';
import { XpBar } from '../../src/infrastructure/phaser/XpBar';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aDefaultConfig, withPlayer, withShop } from '../support/builders';
import { aBehaviorConfig, aProbeType, startRun } from '../support/runs';
import { buyAll, startAtDoor, untilShopping } from '../support/shop';
import { FakeBar, FakeLabel } from '../support/sprites';
import { repoLooks, someLooks } from '../support/looks';
import type { Appearance } from '../../src/infrastructure/content/appearanceSchema';
import type { Looks } from '../../src/infrastructure/phaser/art/looks';

const HEALTH_WIDTH = 200;
const XP_WIDTH = 300;
const BAR_HEIGHT = 8;

const fresh = (): RunSnapshot => startRun(aDefaultConfig()).snapshot();

/** Iconos de los contadores: oro con hoja y madera de reserva (0022). */
const ICONS = {
  gold: { texture: 'Resources/Resources/G_Idle.png', frame: 0, color: 0xe8c547 },
  wood: { texture: null, frame: 0, color: 0x9c6b3c },
  stone: { texture: 'Deco/05.png', frame: 0, color: 0x9aa0a6 },
};

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
    gold: new FakeLabel(),
    wood: new FakeLabel(),
    stone: new FakeLabel(),
  };
  const xpBar = new XpBar(parts.xpFill, parts.level, XP_WIDTH, BAR_HEIGHT);
  const view = new Hud(
    {
      xpBar,
      healthFill: parts.healthFill,
      healthLabel: parts.healthLabel,
      clock: parts.clock,
      kills: parts.kills,
      gold: parts.gold,
      wood: parts.wood,
      stone: parts.stone,
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
    // 0022: con ≥ 1 recogida de madera (un recogible en la salida).
    const setup = { gems: [{ kind: 'wood' as const, x: 1920, y: 1080, value: 2 }] };
    const painted = startRun(config, setup, new Mulberry32RandomGenerator(42));
    const plain = startRun(config, setup, new Mulberry32RandomGenerator(42));
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
    expect(last?.resources.wood).toBeGreaterThan(0);
    expect(pairs.some(([s]) => s.player.health < s.player.maxHealth)).toBe(true);
    expect(pairs.every(([a, b]) => JSON.stringify(a) === JSON.stringify(b))).toBe(true);
  });
});

/** Línea de resultados mínima (las líneas reales son DOM desde 0017). */
const aLine = () => ({ setText: () => undefined, setVisible: () => undefined });

/** Objeto del motor falso: guarda posición y scrollFactor; cualquier otro método encadena. */
interface Made {
  kind: string;
  x: number;
  y: number;
  scrollFactor: number | null;
  fontSize: number | null;
  /** Imagen (0030): su hoja y su tamaño en pantalla (`setDisplaySize`). */
  texture?: string;
  size?: [number, number];
}

/** Escena falsa con `scale` (la vista) y `add.rectangle`/`add.text` que registran lo creado. */
function fakeScene(view: { width: number; height: number }) {
  const made: Made[] = [];
  const make = (kind: string, x: number, y: number, texture?: string): unknown => {
    const state: Made = { kind, x, y, scrollFactor: null, fontSize: null };
    if (texture !== undefined) state.texture = texture;
    made.push(state);
    const proxy: unknown = new Proxy(state, {
      get(target, prop) {
        if (prop === 'setScrollFactor') {
          return (v: number) => ((target.scrollFactor = v), proxy);
        }
        if (prop === 'setFontSize') {
          return (v: number) => ((target.fontSize = v), proxy);
        }
        if (prop === 'setDisplaySize') {
          return (w: number, h: number) => ((target.size = [w, h]), proxy);
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
      image: (x: number, y: number, texture: string) => make('image', x, y, texture),
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

    createHud(scene, screenFrame(view.width, view.height), ICONS);
    const offer = createUpgradeOverlay(scene, screenFrame(view.width, view.height));
    const results = createResultsOverlay(scene, screenFrame(view.width, view.height), {
      title: aLine(),
      time: aLine(),
      level: aLine(),
      kills: aLine(),
      hint: aLine(),
    }).overlay;
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
      gold: new FakeLabel(),
      wood: new FakeLabel(),
      stone: new FakeLabel(),
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
    const h = createHud(scene, screenFrame(1280, 720), ICONS);
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

// Spec hud (0022): "Oro y madera en el HUD" y los escenarios de "Contenido y visibilidad del HUD"
// con oro y madera.
describe('HUD · oro y madera (0022)', () => {
  const withResources = (s: RunSnapshot, gold: number, wood: number): RunSnapshot => ({
    ...s,
    resources: { gold, wood, stone: 0 },
  });
  const counters = (h: ReturnType<typeof hud>) => [h.gold.text, h.wood.text];

  it('Scenario: Contadores al empezar (oro 0 y madera 0)', () => {
    const h = hud();
    h.view.sync(fresh());
    expect(counters(h)).toEqual(['0', '0']);
    expect(h.view.shown).toEqual({ gold: '0', wood: '0', stone: '0' });
  });

  it('Scenario: HUD al empezar (con oro 0 y madera 0)', () => {
    const h = hud();
    h.view.sync(fresh());
    expect([...shown(h), ...counters(h)]).toEqual([
      '100/100',
      1,
      '10:00',
      'Nv 1',
      0,
      'Bajas: 0',
      '0',
      '0',
    ]);
  });

  it('Scenario: Contadores que cambian entre snapshots (10/2 ⇒ 35/5)', () => {
    const h = hud();
    h.view.sync(withResources(fresh(), 10, 2));
    h.view.sync(withResources(fresh(), 35, 5));
    expect(counters(h)).toEqual(['35', '5']);
  });

  it('Scenario: Números grandes (123456 y 12345 completos)', () => {
    const h = hud();
    h.view.sync(withResources(fresh(), 123_456, 12_345));
    expect(counters(h)).toEqual(['123456', '12345']);
  });

  it('Scenario: HUD con la partida terminada (oro 25 y madera 4; 60 frames más sin reescribir)', () => {
    const h = hud();
    const ended = withResources(
      snap({ tick: 1259, health: 0, level: 3, xpToNext: 15, kills: 41, over: true }),
      25,
      4,
    );
    h.view.sync(ended);
    const writes = h.gold.writes + h.wood.writes;
    for (let i = 0; i < 60; i++) h.view.sync(ended);
    expect([...shown(h), ...counters(h)]).toEqual([
      '0/100',
      0,
      '09:40',
      'Nv 3',
      0,
      'Bajas: 41',
      '25',
      '4',
    ]);
    expect(h.gold.writes + h.wood.writes).toBe(writes);
  });

  it('Scenario: HUD en pausa (oro 15 y madera 3: 600 frames con el mismo snapshot)', () => {
    const h = hud();
    const paused = withResources(snap({ tick: 600, health: 75, level: 2, kills: 9 }), 15, 3);
    for (let i = 0; i < 600; i++) h.view.sync(paused);
    expect([h.clock.text, h.kills.text, ...counters(h)]).toEqual(['09:50', 'Bajas: 9', '15', '3']);
  });

  it('Scenario: HUD tras volver al menú y jugar (partida nueva: oro 0 y madera 0)', () => {
    const h = hud();
    h.view.sync(withResources(snap({ tick: 3000, level: 5, kills: 200 }), 60, 9));
    h.view.sync(fresh());
    expect([h.clock.text, h.kills.text, ...counters(h)]).toEqual(['10:00', 'Bajas: 0', '0', '0']);
  });

  it('Scenario: Icono que no carga (oro sin hoja: cuadrado de reserva; madera con su imagen)', () => {
    const { scene, made } = fakeScene({ width: 960, height: 540 });
    const icons = {
      gold: { texture: null, frame: 0, color: 0xe8c547 },
      wood: { texture: 'Resources/Resources/W_Idle.png', frame: 0, color: 0x9c6b3c },
      stone: { texture: 'Deco/05.png', frame: 0, color: 0x9aa0a6 },
    };
    const h = createHud(scene, screenFrame(960, 540), icons);
    const l = hudLayout(screenFrame(960, 540));
    const at = (p: { x: number; y: number }) => made.filter((m) => m.x === p.x && m.y === p.y);
    expect(at(l.gold.icon).map((m) => m.kind)).toEqual(['rectangle']);
    expect(at(l.wood.icon).map((m) => m.kind)).toEqual(['image']);
    expect(() => {
      h.sync(fresh());
    }).not.toThrow();
    expect(h.shown).toEqual({ gold: '0', wood: '0', stone: '0' });
  });
});

// Spec hud (0025): "Piedra en el HUD" y los escenarios de "Contenido y visibilidad del HUD" con
// piedra.
describe('HUD · piedra (0025)', () => {
  const withStone = (s: RunSnapshot, stone: number, gold = 0, wood = 0): RunSnapshot => ({
    ...s,
    resources: { gold, wood, stone },
  });
  const counters = (h: ReturnType<typeof hud>) => [h.gold.text, h.wood.text, h.stone.text];

  it('Scenario: Piedra al empezar (piedra 0 junto a oro 0 y madera 0)', () => {
    const h = hud();
    h.view.sync(fresh());
    expect(counters(h)).toEqual(['0', '0', '0']);
    expect(h.view.shown).toEqual({ gold: '0', wood: '0', stone: '0' });
  });

  it('Scenario: HUD al empezar (vida, tiempo, nivel, bajas, oro, madera y piedra)', () => {
    const h = hud();
    h.view.sync(fresh());
    expect([...shown(h), ...counters(h)]).toEqual([
      '100/100',
      1,
      '10:00',
      'Nv 1',
      0,
      'Bajas: 0',
      '0',
      '0',
      '0',
    ]);
  });

  it('Scenario: Piedra que cambia entre snapshots (2 ⇒ 9; oro y madera sin cambios)', () => {
    const h = hud();
    h.view.sync(withStone(fresh(), 2, 7, 3));
    const writes = [h.gold.writes, h.wood.writes];
    h.view.sync(withStone(fresh(), 9, 7, 3));
    expect(counters(h)).toEqual(['7', '3', '9']);
    expect([h.gold.writes, h.wood.writes]).toEqual(writes);
  });

  it('Scenario: Número grande (12345 completo)', () => {
    const h = hud();
    h.view.sync(withStone(fresh(), 12_345));
    expect(h.stone.text).toBe('12345');
  });

  it('Scenario: Piedra congelada en pausa y en la tienda (piedra 6 en 600 frames y tras comprar)', () => {
    const h = hud();
    const paused = withStone(snap({ tick: 600 }), 6, 30);
    for (let i = 0; i < 600; i++) h.view.sync(paused);
    expect(h.stone.text).toBe('6');
    const run = startAtDoor(
      withShop(aBehaviorConfig([aProbeType()]), {}, { amount: 25, price: 10 }),
      { player: { x: 1039, y: 1000, health: 40 }, resources: { gold: 30, wood: 0, stone: 6 } },
    );
    untilShopping(run, 1);
    for (let i = 0; i < 600; i++) h.view.sync(run.snapshot());
    buyAll(run, ['heal']);
    h.view.sync(run.snapshot());
    expect([h.gold.text, h.stone.text]).toEqual(['20', '6']);
  });

  it('Scenario: Icono de la piedra que no carga (cuadrado de reserva; oro y madera con imagen)', () => {
    const { scene, made } = fakeScene({ width: 960, height: 540 });
    const icons = {
      gold: { texture: 'Resources/Resources/G_Idle.png', frame: 0, color: 0xe8c547 },
      wood: { texture: 'Resources/Resources/W_Idle.png', frame: 0, color: 0x9c6b3c },
      stone: { texture: null, frame: 0, color: 0x9aa0a6 },
    };
    const h = createHud(scene, screenFrame(960, 540), icons);
    const l = hudLayout(screenFrame(960, 540));
    const at = (p: { x: number; y: number }) => made.filter((m) => m.x === p.x && m.y === p.y);
    expect(at(l.stone.icon).map((m) => m.kind)).toEqual(['rectangle']);
    expect([...at(l.gold.icon), ...at(l.wood.icon)].map((m) => m.kind)).toEqual(['image', 'image']);
    expect(() => {
      h.sync(fresh());
    }).not.toThrow();
    expect(h.shown.stone).toBe('0');
  });

  it('el icono de la piedra es siempre la roca medium (Deco/05) del aspecto', () => {
    const looks = someLooks();
    expect(counterIcon(looks.pickups.stone)).toEqual({
      texture: 'Deco/05.png',
      frame: 0,
      color: 0x9aa0a6,
    });
  });
});

// Spec hud (0024), "HUD en la tienda": solo cambian el oro y la vida (por las compras).
describe('HUD en la tienda (0024)', () => {
  it('Scenario: HUD en la tienda (09:50, 40/100 y oro 30; tras la curación, 65/100 y oro 20)', () => {
    const h = hud();
    // Tienda abierta en el tick 600: el jugador entra en el radio de la puerta en ese tick.
    const run = startAtDoor(
      withShop(aBehaviorConfig([aProbeType()]), {}, { amount: 25, price: 10 }),
      {
        player: { x: 1039 + 600 * (210 / 60), y: 1000, health: 40 },
        resources: { gold: 30, wood: 0 },
      },
    );
    untilShopping(run, 700, PlayerInput.of(-1, 0));
    const inShop = run.snapshot();
    expect(inShop.tick).toBe(600);
    for (let i = 0; i < 600; i++) h.view.sync(run.snapshot());
    const during = [h.clock.text, h.healthLabel.text, h.gold.text];

    buyAll(run, ['heal']);
    h.view.sync(run.snapshot());

    expect(during).toEqual(['09:50', '40/100', '30']);
    expect([h.clock.text, h.healthLabel.text, h.gold.text]).toEqual(['09:50', '65/100', '20']);
  });
});

// Spec sprite-rendering (0030), "Iconos de recurso sin aparición ni flote": el tamaño de los iconos
// lo fija `hudLayout`, no la escala ni el diámetro de los aspectos de los recogibles.
describe('Iconos del HUD sin aparición ni flote (0030)', () => {
  /** Escalas de oro, madera, carne y rocas, y diámetro de la gema, multiplicados por 2. */
  const doubled = (a: Appearance): Appearance => {
    const { xp, gold, wood, meat, stone } = a.pickups;
    const rocks = Object.fromEntries(
      Object.entries(stone.rocks).map(([k, r]) => [k, { ...r, scale: r.scale * 2 }]),
    ) as typeof stone.rocks;
    return {
      ...a,
      pickups: {
        xp: 'diameter' in xp ? { ...xp, diameter: xp.diameter * 2 } : xp,
        gold: { ...gold, scale: gold.scale * 2 },
        wood: { ...wood, scale: wood.scale * 2 },
        meat: { ...meat, scale: meat.scale * 2 },
        stone: { ...stone, rocks },
      },
    };
  };

  /** Imágenes de los iconos (hoja, posición y tamaño) en 60 frames con la partida en curso. */
  const iconsOver60Frames = (looks: Looks) => {
    const { scene, made } = fakeScene({ width: 1280, height: 720 });
    const h = createHud(scene, screenFrame(1280, 720), {
      gold: counterIcon(looks.pickups.gold),
      wood: counterIcon(looks.pickups.wood),
      stone: counterIcon(looks.pickups.stone),
    });
    const frames: unknown[] = [];
    for (let f = 0; f < 60; f++) {
      h.sync(snap({ tick: f }));
      frames.push(made.filter((m) => m.kind === 'image').map((m) => [m.texture, m.x, m.y, m.size]));
    }
    return frames;
  };

  it('Scenario: Iconos del HUD con otra escala de recogible (×2: misma posición, tamaño y hoja)', () => {
    const repo = iconsOver60Frames(repoLooks());
    const scaled = iconsOver60Frames(repoLooks([], doubled));

    expect(scaled).toEqual(repo);
    expect(new Set(repo.map((f) => JSON.stringify(f))).size).toBe(1);
    const l = hudLayout(screenFrame(1280, 720));
    expect(repo[0]).toEqual([
      [
        'Resources/Resources/G_Idle.png',
        l.gold.icon.x,
        l.gold.icon.y,
        [l.gold.icon.size, l.gold.icon.size],
      ],
      [
        'Resources/Resources/W_Idle.png',
        l.wood.icon.x,
        l.wood.icon.y,
        [l.wood.icon.size, l.wood.icon.size],
      ],
      ['Deco/05.png', l.stone.icon.x, l.stone.icon.y, [l.stone.icon.size, l.stone.icon.size]],
    ]);
  });
});
