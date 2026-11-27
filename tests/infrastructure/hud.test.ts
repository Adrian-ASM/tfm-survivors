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
  hudIcons as sceneHudIcons,
  killsIcon,
} from '../../src/infrastructure/phaser/sceneWidgets';
import { XpBar } from '../../src/infrastructure/phaser/XpBar';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aDefaultConfig, withPlayer, withShop } from '../support/builders';
import { aBehaviorConfig, aProbeType, startRun } from '../support/runs';
import { buyAll, startAtDoor, untilShopping } from '../support/shop';
import { FakeBar, FakeLabel } from '../support/sprites';
import { pngFrames, repoLooks, someLooks } from '../support/looks';
import { repoAppearance } from '../support/mapArt';
import { CORPSE_COLOR, DEAD_TEXTURE, HUD_METRICS, testHudIcons } from '../support/hud';

/** Frame de 128 × 128 de la hoja del cadáver. */
const FRAME = { width: 128, height: 128 };
import type { Appearance } from '../../src/infrastructure/content/appearanceSchema';
import type { Looks } from '../../src/infrastructure/phaser/art/looks';

const HEALTH_WIDTH = 200;
const XP_WIDTH = 300;
const BAR_HEIGHT = 8;

const fresh = (): RunSnapshot => startRun(aDefaultConfig()).snapshot();

/** Iconos de los contadores: oro con hoja y madera de reserva (0022). */
const ICONS = testHudIcons(['wood']);

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

    expect(shown(h)).toEqual(['100/100', 1, '10:00', 'Nv 1', 0, '0']);
  });

  it('Scenario: HUD con la partida terminada (tick 1.259, nivel 3, 41 bajas; 60 frames más)', () => {
    const h = hud();
    const ended = snap({ tick: 1259, health: 0, level: 3, xpToNext: 15, kills: 41, over: true });

    h.view.sync(ended);
    const first = shown(h);
    const writes = h.clock.writes + h.healthLabel.writes + h.kills.writes + h.level.writes;
    for (let i = 0; i < 60; i++) h.view.sync(ended);

    expect(first).toEqual(['0/100', 0, '09:40', 'Nv 3', 0, '41']);
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

    expect([h.kills.text, h.kills.writes]).toEqual(['12', 2]);
  });

  it('Scenario: Sin bajas', () => {
    const h = hud();

    h.view.sync(snap({ kills: 0 }));

    expect(h.kills.text).toBe('0');
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
  /** 0036: frame de la creación, recorte, origen, escala, color y si se pidió una animación. */
  frame?: number;
  crop?: [number, number, number, number];
  origin?: [number, number];
  scale?: number;
  color?: number;
  played?: boolean;
}

/** Lado en pantalla de un icono: recorte × escala (imagen) o su tamaño (cuadrado de reserva). */
// Redondeado a 1e-6 px: 47 × (24 / 47) no da 24 exacto en coma flotante.
const onScreen = (m: Made): number =>
  Math.round((m.crop ? m.crop[2] * (m.scale ?? 1) : (m.size?.[0] ?? NaN)) * 1e6) / 1e6;

/** Escena falsa con `scale` (la vista) y `add.rectangle`/`add.text` que registran lo creado. */
function fakeScene(view: { width: number; height: number }) {
  const made: Made[] = [];
  const make = (
    kind: string,
    x: number,
    y: number,
    texture?: string,
    extra: Partial<Made> = {},
  ): unknown => {
    const state: Made = { kind, x, y, scrollFactor: null, fontSize: null, ...extra };
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
        if (prop === 'setScale') return (v: number) => ((target.scale = v), proxy);
        if (prop === 'setOrigin') {
          return (ox: number, oy: number) => ((target.origin = [ox, oy]), proxy);
        }
        if (prop === 'setCrop') {
          return (cx: number, cy: number, cw: number, ch: number) => (
            (target.crop = [cx, cy, cw, ch]),
            proxy
          );
        }
        if (prop === 'play' || prop === 'setFrame') {
          return () => ((target.played = true), proxy);
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
      rectangle: (x: number, y: number, w?: number, h?: number, color?: number) =>
        make('rectangle', x, y, undefined, {
          ...(w !== undefined && h !== undefined ? { size: [w, h] as [number, number] } : {}),
          ...(color !== undefined ? { color } : {}),
        }),
      text: (x: number, y: number) => make('text', x, y),
      image: (x: number, y: number, texture: string, frame?: number) =>
        make('image', x, y, texture, frame !== undefined ? { frame } : {}),
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

    createHud(scene, screenFrame(view.width, view.height), ICONS, HUD_METRICS);
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
  const layout = hudLayout(frame, HUD_METRICS);
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

    h.view.relayout(hudLayout(screenFrame(1920, 1080), HUD_METRICS));

    expect([h.fill.width, h.fill.height]).toEqual([240, 20]);
    expect([h.xpFill.width, h.xpFill.height]).toEqual([240, 20]);
  });

  it('Scenario: Mismo tamaño (relayout con el mismo frame no recoloca nada)', () => {
    const h = placedHud();
    h.view.relayout(hudLayout(screenFrame(960, 540), HUD_METRICS));
    const resizes = h.fill.resizes;

    h.view.relayout(hudLayout(screenFrame(960, 540), HUD_METRICS));

    expect(h.placement.calls).toHaveLength(1);
    expect(h.fill.resizes).toBe(resizes);
  });

  it('Scenario: Cambio de escalón al redimensionar (×1 → ×2 vuelve a pintar el texto)', () => {
    const h = placedHud();
    h.view.relayout(hudLayout(screenFrame(1280, 720), HUD_METRICS));
    h.view.relayout(hudLayout(screenFrame(1000, 600), HUD_METRICS));
    h.view.relayout(hudLayout(screenFrame(2560, 1440), HUD_METRICS));

    expect(h.placement.calls.map((c) => c.rescale)).toEqual([false, false, true]);
  });
});

describe('createHud con relayout (0017)', () => {
  it('Scenario: Muchos cambios seguidos (50 relayouts: ningún objeto nuevo, último frame)', () => {
    const { scene, made } = fakeScene({ width: 1280, height: 720 });
    const h = createHud(scene, screenFrame(1280, 720), ICONS, HUD_METRICS);
    const created = made.length;
    const frames = [screenFrame(1280, 720), screenFrame(1000, 600), screenFrame(2560, 1440)];

    for (let i = 0; i < 50; i++) {
      h.relayout(hudLayout(frames[i % 3] ?? screenFrame(1, 1), HUD_METRICS));
    }
    const last = hudLayout(frames[49 % 3] ?? screenFrame(1, 1), HUD_METRICS);

    expect(made.length).toBe(created);
    const kills = made.filter((m) => m.kind === 'text').map((m) => m.x);
    expect(kills).toContain(last.kills.label.x);
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
      '0',
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
      '41',
      '25',
      '4',
    ]);
    expect(h.gold.writes + h.wood.writes).toBe(writes);
  });

  it('Scenario: HUD en pausa (oro 15 y madera 3: 600 frames con el mismo snapshot)', () => {
    const h = hud();
    const paused = withResources(snap({ tick: 600, health: 75, level: 2, kills: 9 }), 15, 3);
    for (let i = 0; i < 600; i++) h.view.sync(paused);
    expect([h.clock.text, h.kills.text, ...counters(h)]).toEqual(['09:50', '9', '15', '3']);
  });

  it('Scenario: HUD tras volver al menú y jugar (partida nueva: oro 0 y madera 0)', () => {
    const h = hud();
    h.view.sync(withResources(snap({ tick: 3000, level: 5, kills: 200 }), 60, 9));
    h.view.sync(fresh());
    expect([h.clock.text, h.kills.text, ...counters(h)]).toEqual(['10:00', '0', '0', '0']);
  });

  it('Scenario: Icono que no carga (oro sin hoja: cuadrado de reserva; madera con su imagen)', () => {
    const { scene, made } = fakeScene({ width: 960, height: 540 });
    const icons = testHudIcons(['gold']);
    const h = createHud(scene, screenFrame(960, 540), icons, HUD_METRICS);
    const l = hudLayout(screenFrame(960, 540), HUD_METRICS);
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
      '0',
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
    const icons = testHudIcons(['stone']);
    const h = createHud(scene, screenFrame(960, 540), icons, HUD_METRICS);
    const l = hudLayout(screenFrame(960, 540), HUD_METRICS);
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
    const crop = { x: 16, y: 13, width: 33, height: 33 };
    const frameSize = { width: 64, height: 64 };
    expect(counterIcon(looks.pickups.stone, crop, frameSize)).toEqual({
      texture: 'Deco/05.png',
      frame: 0,
      color: 0x9aa0a6,
      crop,
      frameSize,
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
    const a = repoAppearance();
    const h = createHud(
      scene,
      screenFrame(1280, 720),
      sceneHudIcons(a, looks, pngFrames(a)),
      HUD_METRICS,
    );
    const frames: unknown[] = [];
    for (let f = 0; f < 60; f++) {
      h.sync(snap({ tick: f }));
      frames.push(
        made.filter((m) => m.kind === 'image').map((m) => [m.texture, m.x, m.y, onScreen(m)]),
      );
    }
    return frames;
  };

  it('Scenario: Iconos del HUD con otra escala de recogible (×2: misma posición, tamaño y hoja)', () => {
    const repo = iconsOver60Frames(repoLooks());
    const scaled = iconsOver60Frames(repoLooks([], doubled));

    expect(scaled).toEqual(repo);
    expect(new Set(repo.map((f) => JSON.stringify(f))).size).toBe(1);
    const l = hudLayout(screenFrame(1280, 720), HUD_METRICS);
    const side = l.gold.icon.size;
    expect(repo[0]).toEqual([
      [DEAD_TEXTURE, l.kills.icon.x, l.kills.icon.y, side],
      ['Resources/Resources/G_Idle.png', l.gold.icon.x, l.gold.icon.y, side],
      ['Resources/Resources/W_Idle.png', l.wood.icon.x, l.wood.icon.y, side],
      ['Deco/05.png', l.stone.icon.x, l.stone.icon.y, side],
    ]);
  });
});

// Spec hud (0036), "Iconos de los contadores del HUD" y "Bajas en el HUD": 4 contadores con icono
// recortado de lado s·k (bajas con la calavera de `Dead.png`), con dobles de Phaser.
describe('Contadores con icono y calavera (hud 0036)', () => {
  /** HUD creado con los iconos del contenido por defecto (`hudIcons` de la escena). */
  const repoHud = (view: { width: number; height: number }, missing: readonly string[] = []) => {
    const { scene, made } = fakeScene(view);
    const a = repoAppearance();
    const looks = repoLooks(missing);
    const icons = sceneHudIcons(a, looks, pngFrames(a, missing));
    const h = createHud(scene, screenFrame(view.width, view.height), icons, HUD_METRICS);
    return { h, made, icons };
  };
  const iconsOf = (made: Made[]) =>
    made.filter((m) => m.kind === 'image' || (m.kind === 'rectangle' && m.color !== undefined));
  /** Iconos de contador (imágenes y cuadrados de reserva del tamaño del icono), de arriba abajo. */
  const counterIcons = (made: Made[], side: number) =>
    iconsOf(made).filter((m) => m.kind === 'image' || Math.abs(onScreen(m) - side) < 1e-9);

  it.each([
    [1280, 720, 1],
    [2560, 1440, 2],
  ])('Scenario: Iconos mayores a ×1 y a ×2 (%i × %i, k = %i)', (w, h, k) => {
    const { made, h: hudView } = repoHud({ width: w, height: h });
    hudView.sync(fresh());
    const side = HUD_METRICS.iconSize * k;
    const icons = counterIcons(made, side);
    expect(icons.map((m) => m.texture)).toEqual([
      DEAD_TEXTURE,
      'Resources/Resources/G_Idle.png',
      'Resources/Resources/W_Idle.png',
      'Deco/05.png',
    ]);
    expect(HUD_METRICS.iconSize).toBeGreaterThan(16);
    for (const m of icons) expect(Math.abs(onScreen(m) - side)).toBeLessThanOrEqual(1);
    expect(new Set(icons.map((m) => m.x)).size).toBe(1);
    const ys = icons.map((m) => m.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    // El centro del recorte cae en el ancla: origen = centro del recorte / frame.
    for (const m of icons) {
      const [cx, cy, cw, ch] = m.crop ?? [0, 0, 0, 0];
      const frame = m.texture === 'Deco/05.png' ? 64 : 128;
      expect(m.origin).toEqual([(cx + cw / 2) / frame, (cy + ch / 2) / frame]);
    }
  });

  it('Scenario: Calavera de la hoja del cadáver (Dead.png, frame declarado, sin animación)', () => {
    const { made, icons, h } = repoHud({ width: 1280, height: 720 });
    const a = repoAppearance();
    for (let f = 0; f < 60; f++) h.sync(snap({ tick: f, kills: f }));
    const skull = made.find((m) => m.texture === DEAD_TEXTURE);
    expect(icons.kills.frame).toBe(a.hud.icons.kills.frame);
    expect(skull?.frame).toBe(a.hud.icons.kills.frame);
    const { x, y, width, height } = a.hud.icons.kills.crop;
    expect(skull?.crop).toEqual([x, y, width, height]);
    expect(skull?.played).toBeUndefined();
  });

  it('Scenario: Calavera que no carga (Dead.png sin cargar: reserva #b0b4ba y el número 0)', () => {
    const { made, h } = repoHud({ width: 960, height: 540 }, [DEAD_TEXTURE]);
    const l = hudLayout(screenFrame(960, 540), HUD_METRICS);
    expect(() => {
      h.sync(fresh());
    }).not.toThrow();
    const at = (p: { x: number; y: number }) => made.filter((m) => m.x === p.x && m.y === p.y);
    const kills = at(l.kills.icon);
    expect(kills.map((m) => [m.kind, m.color])).toEqual([['rectangle', CORPSE_COLOR]]);
    expect(CORPSE_COLOR).toBe(0xb0b4ba);
    expect(
      [...at(l.gold.icon), ...at(l.wood.icon), ...at(l.stone.icon)].map((m) => m.kind),
    ).toEqual(['image', 'image', 'image']);
    expect(made.some((m) => m.texture === DEAD_TEXTURE)).toBe(false);
  });

  it('Calavera con un frame que la hoja no tiene: reserva, sin errores', () => {
    const a = repoAppearance();
    const looks = repoLooks();
    const icon = killsIcon(looks.corpse, { ...a.hud.icons.kills, frame: 14 }, FRAME, 14);
    expect([icon.texture, icon.color]).toEqual([null, CORPSE_COLOR]);
    const fits = killsIcon(looks.corpse, a.hud.icons.kills, FRAME, 14);
    expect(fits.texture).toBe(DEAD_TEXTURE);
  });

  it('Scenario: Bajas que cambian entre snapshots (9 ⇒ 12: misma textura, frame y posición)', () => {
    const { made, h } = repoHud({ width: 1280, height: 720 });
    h.sync(snap({ kills: 9 }));
    const before = made.find((m) => m.texture === DEAD_TEXTURE);
    const pose = JSON.stringify(before);
    const created = made.length;
    h.sync(snap({ kills: 12 }));
    const after = made.find((m) => m.texture === DEAD_TEXTURE);
    expect(JSON.stringify(after)).toBe(pose);
    expect(made.length).toBe(created);
    const plain = hud();
    plain.view.sync(snap({ kills: 9 }));
    plain.view.sync(snap({ kills: 12 }));
    expect(plain.kills.text).toBe('12');
  });

  it('Scenario: Sin bajas (el número 0 y ningún texto con «Bajas»)', () => {
    const h = hud();
    h.view.sync(snap({ kills: 0 }));
    const texts = [h.healthLabel, h.clock, h.kills, h.level, h.gold, h.wood, h.stone].map(
      (t) => t.text,
    );
    expect(h.kills.text).toBe('0');
    expect(texts.some((t) => t.includes('Bajas'))).toBe(false);
  });

  it('Scenario: Muchas bajas (12.345: el texto exacto es 12345)', () => {
    const h = hud();
    h.view.sync(snap({ kills: 12_345 }));
    expect(h.kills.text).toBe('12345');
  });

  it('Scenario: Contadores reubicados al redimensionar (pausa: 1.280 → 960 → 2.560)', () => {
    const { made, h } = repoHud({ width: 1280, height: 720 });
    const paused = { ...snap({ tick: 600, kills: 7 }), resources: { gold: 15, wood: 3, stone: 4 } };
    h.sync(paused);
    for (const [w, ht] of [
      [960, 540],
      [2560, 1440],
    ] as const) {
      const l = hudLayout(screenFrame(w, ht), HUD_METRICS);
      h.relayout(l);
      h.sync(paused);
      const side = l.kills.icon.size;
      const icons = counterIcons(made, side);
      const want = [l.kills, l.gold, l.wood, l.stone].map((c) => [c.icon.x, c.icon.y]);
      expect(icons.map((m) => [m.x, m.y])).toEqual(want);
      for (const m of icons) expect(Math.abs(onScreen(m) - side)).toBeLessThanOrEqual(1);
      const texts = made.filter((m) => m.kind === 'text');
      for (const c of [l.kills, l.gold, l.wood, l.stone]) {
        expect(texts.some((t) => t.x === c.label.x && t.y === c.label.y)).toBe(true);
      }
    }
    expect(h.shown).toEqual({ gold: '15', wood: '3', stone: '4' });
  });

  it('Scenario: Seiscientos frames sin crear objetos (4 iconos del primer frame, RESIZE en 200 y 400)', () => {
    const { made, h } = repoHud({ width: 1280, height: 720 });
    const base = fresh();
    h.sync(base);
    const created = made.length;
    const images = made.filter((m) => m.kind === 'image');
    for (let f = 1; f <= 600; f++) {
      if (f === 200) h.relayout(hudLayout(screenFrame(2560, 1440), HUD_METRICS));
      if (f === 400) h.relayout(hudLayout(screenFrame(960, 540), HUD_METRICS));
      h.sync({ ...base, tick: f, kills: f, resources: { gold: f, wood: f % 7, stone: f % 3 } });
    }
    expect(made.length).toBe(created);
    expect(made.filter((m) => m.kind === 'image')).toEqual(images);
    expect(images).toHaveLength(4);
  });

  it('Scenario: Fuente pixel en los textos del HUD (las bajas son un texto más)', () => {
    const { made } = repoHud({ width: 960, height: 540 });
    expect(made.filter((m) => m.kind === 'text')).toHaveLength(7);
  });
});
