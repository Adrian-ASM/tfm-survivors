import { describe, expect, it } from 'vitest';
import type { EnemySnapshot, RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { RingSprite } from '../../src/infrastructure/phaser/PulseLayer';
import { RenderLayers } from '../../src/infrastructure/phaser/RenderLayers';
import { aDefaultConfig } from '../support/builders';
import { fakeKit, type FakeSprite } from '../support/FakeSprite';
import { someLooks } from '../support/looks';
import { startRun } from '../support/runs';
import { toMapSnapshot } from '../../src/domain/map/MapSnapshot';
import {
  CameraRig,
  followView,
  type FollowCamera,
} from '../../src/infrastructure/phaser/CameraRig';
import { touches } from '../../src/infrastructure/phaser/map/mapCulling';
import type { MapArtPlan } from '../../src/infrastructure/phaser/map/planMapArt';
import { paintMapArt, type MapArtCanvas } from '../../src/infrastructure/phaser/TerrainView';
import { screenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
import { emptyCounts } from '../../src/infrastructure/phaser/renderCounts';
import { drawnByRule, planFor, visibleByRule } from '../support/mapArt';
import { mapRules, mapWith } from '../support/mapLayouts';
import { mapForSeed } from '../support/mapStats';

// Spec sprite-rendering: muertes, mundo detenido y sonda (change 0012, design D6/D7 y "Flujo").
// Fixture: cadáver con `death` de 6 frames a 15 fps (400 ms); jugador con walk [6, 7, 8, 9].
const FRAME_MS = 16.667;

class FakeRing implements RingSprite {
  visible = true;
  setPosition(): this {
    return this;
  }
  setRadius(): this {
    return this;
  }
  setAlpha(): this {
    return this;
  }
  setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }
}

const BASE = startRun(aDefaultConfig()).snapshot();

const foe = (id: number, x: number, y: number): EnemySnapshot => ({
  id,
  type: 'goblin-torch',
  x,
  y,
  radius: 10,
  health: 10,
  damaged: false,
  state: 'chase',
  stateKind: 'chase',
});

function snap(tick: number, over: Partial<RunSnapshot> = {}): RunSnapshot {
  return { ...BASE, tick, ...over } as RunSnapshot;
}

function setup(maxCorpses = 64) {
  const kit = fakeKit();
  const rings: FakeRing[] = [];
  const looks = someLooks();
  const layers = new RenderLayers(
    {
      kit,
      ring: () => {
        const r = new FakeRing();
        rings.push(r);
        return r;
      },
      looks,
      capacity: {
        enemies: 200,
        projectiles: 32,
        pulses: 4,
        gems: 300,
        corpses: maxCorpses,
        visualTicks: new Map([['tests', 8]]),
      },
    },
    { visible: 1, placeholder: 0 },
  );
  const corpses = () => kit.created.filter((s) => s.texture === looks.corpse.texture && s.visible);
  const enemies = () =>
    kit.created.filter(
      (s) => s.texture === looks.enemies.get('goblin-torch')?.texture && s.visible,
    );
  const player = (): FakeSprite | undefined =>
    kit.created.find((s) => s.texture === looks.player.texture);
  const frame = (s: RunSnapshot, paused = false): void => {
    layers.advance(FRAME_MS, paused);
    layers.render(s);
  };
  return { layers, frame, corpses, enemies, player, rings };
}

describe('RenderLayers · muertes por delta del snapshot', () => {
  it('Scenario: Pulso que mata a varios en el mismo tick (5 cadáveres en sus posiciones)', () => {
    const { frame, corpses, layers } = setup();
    const five = [1, 2, 3, 4, 5].map((i) => foe(i, 100 * i, 50 * i));
    frame(snap(10, { enemies: five }));
    frame(snap(11, { enemies: [], kills: 5 }));
    const shown = corpses().map((c) => [c.x, c.y]);
    expect(shown).toHaveLength(5);
    for (const e of five) expect(shown).toContainEqual([e.x, e.y]);
    expect(layers.counts.corpses.visible).toBe(5);
  });

  it('Scenario: Muerte y desaparición (frames 1 a 23 visible, ninguno desde el 26)', () => {
    const { frame, corpses } = setup();
    frame(snap(1, { enemies: [foe(1, 300, 200)] }));
    const seen: boolean[] = [];
    for (let f = 1; f <= 31; f++) {
      frame(snap(1 + f, { enemies: [] }));
      seen[f] = corpses().length === 1;
    }
    expect(seen.slice(1, 24).every(Boolean)).toBe(true);
    expect(seen.slice(26).some(Boolean)).toBe(false);
  });

  it('Scenario: Fin de la partida (8 → 6 en el tick terminado: 2 cadáveres, 6 enemigos, 60 frames)', () => {
    const { frame, corpses, enemies } = setup();
    const eight = Array.from({ length: 8 }, (_, i) => foe(i, 60 * i, 100));
    frame(snap(99, { enemies: eight }));
    const ended = snap(100, {
      enemies: eight.slice(2),
      status: 'over',
      outcome: 'lost',
    });
    frame(ended);
    expect([corpses().length, enemies().length]).toEqual([2, 6]);
    for (let f = 0; f < 60; f++) {
      frame(ended);
      expect([corpses().length, enemies().length]).toEqual([2, 6]);
    }
  });

  it('Scenario: Muerte a velocidad acelerada (sale en un frame de 8 ticks: 1 cadáver)', () => {
    const { frame, corpses } = setup();
    frame(snap(8, { enemies: [foe(3, 300, 200)] }));
    frame(snap(16, { enemies: [] }));
    expect(corpses().map((c) => [c.x, c.y])).toEqual([[300, 200]]);
  });

  it('Scenario: Cadáver con el mundo detenido (visible en pausa; tras reanudar, se va en 11..14)', () => {
    const { frame, corpses } = setup();
    frame(snap(1, { enemies: [foe(1, 300, 200)] }));
    frame(snap(2, { enemies: [] }));
    for (let f = 0; f < 12; f++) frame(snap(3 + f, { enemies: [] }));
    const paused = snap(15, { enemies: [] });
    for (let f = 0; f < 300; f++) {
      frame(paused, true);
      expect(corpses()).toHaveLength(1);
    }
    const after: boolean[] = [];
    for (let f = 1; f <= 30; f++) {
      frame(snap(15 + f, { enemies: [] }));
      after[f] = corpses().length === 1;
    }
    expect(after.slice(1, 11).every(Boolean)).toBe(true);
    expect(after.slice(15).some(Boolean)).toBe(false);
  });

  it('un enemigo que nunca se pintó no deja cadáver', () => {
    const { frame, corpses } = setup();
    frame(snap(1, { enemies: [] }));
    frame(snap(2, { enemies: [], kills: 1 }));
    expect(corpses()).toHaveLength(0);
  });
});

describe('RenderLayers · mundo detenido', () => {
  it('Scenario: Mundo detenido (pausa, elección y fin: mismo frame de hoja en 300 frames)', () => {
    for (const mode of ['paused', 'choosing', 'over'] as const) {
      const { frame, enemies, player } = setup();
      const three = (t: number) => [
        foe(1, 100 + 3 * t, 100),
        foe(2, 200 + 3 * t, 100),
        foe(3, 300 + 3 * t, 100),
      ];
      const moving = (t: number) => ({
        enemies: three(t),
        player: { ...BASE.player, x: 300 + 3 * t },
      });
      for (let t = 0; t < 500; t++) frame(snap(t, moving(t)));
      const stopped =
        mode === 'paused'
          ? snap(500, moving(500))
          : snap(500, {
              ...moving(500),
              status: mode,
              ...(mode === 'over' ? { outcome: 'lost' } : {}),
            } as Partial<RunSnapshot>);
      frame(stopped, mode === 'paused');
      const first = [...enemies().map((s) => s.frame), player()?.frame];
      for (let f = 0; f < 300; f++) {
        frame(stopped, mode === 'paused');
        expect([...enemies().map((s) => s.frame), player()?.frame], mode).toEqual(first);
      }
    }
  });
});

// Spec sprite-rendering (0016), "Pintado del mapa": espuma en bucle en tiempo de render (design §5.4).
describe('RenderLayers · espuma animada', () => {
  function withFoam() {
    const s = setup();
    const calls: number[] = [];
    const canvas: MapArtCanvas = {
      clear: () => undefined,
      tiles: () => undefined,
      sprite: () => undefined,
      rect: () => undefined,
      foam: (f) => calls.push(f),
      show: () => undefined,
    };
    const plan = planFor(toMapSnapshot(mapForSeed(aDefaultConfig(), 123)), 123);
    s.layers.paintMap(canvas, plan);
    return { ...s, calls, plan };
  }

  it('Scenario: Pintado del mapa (espuma en bucle: 8 frames por segundo, solo al cambiar)', () => {
    const { frame, calls, plan } = withFoam();
    expect(plan.foam?.fps).toBe(8);
    for (let i = 0; i < 59; i++) frame(snap(i)); // 983 ms: frames 0..7
    expect(calls).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (let i = 0; i < 8; i++) frame(snap(60 + i));
    expect(calls.at(-1)).toBe(0);
  });

  it('congelada en pausa y sin avance del reloj (modo manual sin step)', () => {
    const { frame, layers, calls } = withFoam();
    frame(snap(0));
    for (let i = 0; i < 120; i++) frame(snap(1), true);
    for (let i = 0; i < 120; i++) {
      layers.advance(0, false);
      layers.render(snap(1));
    }
    expect(calls).toEqual([0]);
  });

  it('sin espuma con arte no llama nunca a foam', () => {
    const s = setup();
    const calls: number[] = [];
    const canvas: MapArtCanvas = {
      clear: () => undefined,
      tiles: () => undefined,
      sprite: () => undefined,
      rect: () => undefined,
      foam: (f) => calls.push(f),
      show: () => undefined,
    };
    s.layers.paintMap(
      canvas,
      planFor(toMapSnapshot(mapForSeed(aDefaultConfig(), 123)), 123, [
        'Terrain/Water/Foam/Foam.png',
      ]),
    );
    for (let i = 0; i < 60; i++) s.frame(snap(i));
    expect(calls).toEqual([]);
  });
});

// Spec sprite-rendering (0018), "El recorte no cambia lo que se ve" y "Recorte al cambiar de
// partida, de ventana y de modo": frame a frame con render → rig.track → cullMap(rig.nextView()).
interface PaintedObject {
  id: string;
  foam: boolean;
  visible: boolean;
  frame: number;
}

/**
 * Lienzo doble del mapa con la semántica del adaptador: un pool de objetos reutilizados entre
 * partidas (`clear` los oculta todos) e índices de `show` en orden de llamada desde el último
 * `clear`.
 */
function mapCanvas() {
  const pool: PaintedObject[] = [];
  const objects: PaintedObject[] = [];
  let shows = 0;
  const add = (id: string, foam = false) => {
    const o = pool[objects.length] ?? { id, foam, visible: false, frame: -1 };
    if (!pool.includes(o)) pool.push(o);
    Object.assign(o, { id, foam, visible: true });
    objects.push(o);
  };
  const canvas: MapArtCanvas = {
    clear: () => {
      for (const o of pool) o.visible = false;
      objects.length = 0;
    },
    tiles: (t) => {
      add(`low:tiles:${String(t.x)},${String(t.y)}`);
    },
    sprite: (layer, s) => {
      add(`${layer}:${s.role}:${String(s.x)},${String(s.y)}`, s.role === 'foam');
    },
    rect: (r) => {
      add(`low:rect:${String(r.x)},${String(r.y)}`);
    },
    foam: (f) => {
      for (const o of objects) if (o.foam) o.frame = f;
    },
    show: (i, v) => {
      shows++;
      const o = objects[i];
      if (o) o.visible = v;
    },
  };
  return { canvas, objects, pool, shows: () => shows };
}

/** Cámara doble con lo que usa `CameraRig` (sin preRender: la vista del recorte se calcula). */
function fakeCamera(): FollowCamera {
  const cam = {
    width: 1,
    height: 1,
    worldView: { x: 0, y: 0, width: 1, height: 1 },
    setBounds: () => cam,
    startFollow: () => cam,
    setSize: (w: number, h: number) => {
      cam.width = w;
      cam.height = h;
      return cam;
    },
  };
  return cam;
}

const WORLD_42 = aDefaultConfig().arena;
const PLAN_42 = () => planFor(toMapSnapshot(mapForSeed(aDefaultConfig(), 42)));
const idsOf = (plan: MapArtPlan): string[] => {
  const { canvas, objects } = mapCanvas();
  paintMapArt(canvas, plan);
  return objects.map((o) => o.id);
};

function culled(plan = PLAN_42(), window = screenFrame(1280, 720)) {
  const s = setup();
  const map = mapCanvas();
  const rig = new CameraRig(fakeCamera(), WORLD_42);
  rig.resize(window);
  s.layers.paintMap(map.canvas, plan);
  /** Un frame del motor: reloj, capas, cámara y recorte. */
  const paint = (snapshot: RunSnapshot, paused = false): void => {
    s.frame(snapshot, paused);
    rig.track(snapshot.player);
    s.layers.cullMap(rig.nextView());
  };
  const visibleIds = () => map.objects.filter((o) => o.visible).map((o) => o.id);
  return { ...s, ...map, rig, plan, paint, visibleIds };
}

const at = (tick: number, x: number, y: number, over: Partial<RunSnapshot> = {}) =>
  snap(tick, { player: { ...BASE.player, x, y }, ...over });
const PLAYER_SPEED = 215;
const START = { x: 1950, y: 1170 };

/** Jugador a 215 px/s hacia la derecha y después hacia abajo, dentro del mundo. */
function pathAt(tick: number, total: number): { x: number; y: number } {
  const step = PLAYER_SPEED / 60;
  const half = total / 2;
  const x = START.x + step * Math.min(tick, half);
  const y = START.y + step * Math.max(0, tick - half);
  return { x: clamp(x, 0, WORLD_42.width), y: clamp(y, 0, WORLD_42.height) };
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

describe('RenderLayers · recorte del mapa (0018)', () => {
  it.each([1, 15])(
    'Scenario: Movimiento continuo sin huecos / Salto de varios ticks (%i ticks por frame)',
    (ticksPerFrame) => {
      const { paint, objects, plan } = culled();
      const boxes = [...plan.low, ...plan.high].map((d) => d.bounds);
      const ids = idsOf(plan);
      const total = 600 * ticksPerFrame;
      const holes: string[] = [];
      for (let f = 0; f < 600; f++) {
        const tick = f * ticksPerFrame;
        const p = pathAt(tick, total);
        paint(at(tick, p.x, p.y));
        const view = followView(p, { width: 1280, height: 720 }, WORLD_42);
        boxes.forEach((b, i) => {
          if (touches(b, view) && !objects[i]?.visible) holes.push(`${String(f)}:${String(i)}`);
        });
      }
      expect(holes).toEqual([]);
      // Orden y capa: los objetos del lienzo siguen el orden del plan.
      expect(objects.map((o) => o.id)).toEqual(ids);
    },
  );

  it('Scenario: Espuma al reaparecer (oculta en f + 1, visible en f + 40 con el frame de las demás)', () => {
    const { paint, objects, plan } = culled();
    const foams = objects.flatMap((o, i) => (o.foam ? [i] : []));
    const shownAt = (p: { x: number; y: number }) =>
      visibleByRule(plan, followView(p, { width: 1280, height: 720 }, WORLD_42));
    // Arrange: P y Q = P − 600 px en x (la cámara se aleja a la izquierda del río) con una espuma
    // que sale (S) y otra que se queda.
    const grid = Array.from({ length: 64 * 36 }, (_, k) => ({
      x: 60 * (k % 64),
      y: 60 * Math.floor(k / 64),
    }));
    const away = (p: { x: number; y: number }) => ({ x: p.x - 600, y: p.y });
    const pairs = grid.map((p) => {
      const a = shownAt(p);
      const b = shownAt(away(p));
      const s = foams.find((i) => a[i] && !b[i]);
      const stayed = foams.find((i) => a[i] && b[i]);
      return { p, s, stayed };
    });
    const pick = pairs.find((c) => c.s !== undefined && c.stayed !== undefined);
    if (!pick) throw new Error('sin posición con espumas que salen y que se quedan');
    const { p, s = -1, stayed = -1 } = pick;
    const q = away(p);

    paint(at(0, p.x, p.y));
    expect(objects[s]?.visible).toBe(true);
    paint(at(1, q.x, q.y));
    expect(objects[s]?.visible).toBe(false);
    for (let f = 2; f < 40; f++) paint(at(f, q.x, q.y));
    paint(at(40, p.x, p.y));

    expect(objects[s]?.visible).toBe(true);
    expect(objects[s]?.frame).toBe(objects[stayed]?.frame);
    expect(objects[s]?.frame).not.toBe(-1);
  });

  it('Scenario: Pausa, oferta y partida terminada (mismo conjunto 300 frames y 0 show tras el primero)', () => {
    const states: [string, Partial<RunSnapshot>, boolean][] = [
      ['pausa', {}, true],
      ['oferta', { status: 'choosing' }, false],
      ['terminada', { status: 'over', outcome: 'lost' }, false],
    ];
    for (const [name, over, paused] of states) {
      const { paint, visibleIds, shows } = culled();
      const still = at(500, 2400, 900, over);
      paint(still, paused);
      const first = visibleIds();
      const calls = shows();
      for (let f = 0; f < 300; f++) paint(still, paused);
      expect(visibleIds(), name).toEqual(first);
      expect(shows(), name).toBe(calls);
    }
  });

  it('Scenario: Redimensionado (2.560 × 1.440 y 960 × 540: visibles = regla en el primer frame)', () => {
    const { paint, objects, plan, rig } = culled();
    const centre = at(10, 1920, 1080);
    paint(centre);
    const before = objects.filter((o) => o.visible).length;

    rig.resize(screenFrame(2560, 1440));
    paint(centre);
    const big = objects.map((o) => o.visible);
    expect(big).toEqual(
      visibleByRule(plan, followView(centre.player, screenFrame(2560, 1440), WORLD_42)),
    );
    expect(big.filter(Boolean).length).toBeGreaterThanOrEqual(before);
    rig.resize(screenFrame(960, 540));
    paint(centre);

    const small = objects.map((o) => o.visible);
    expect(small).toEqual(
      visibleByRule(plan, followView(centre.player, screenFrame(960, 540), WORLD_42)),
    );
    expect(small.filter(Boolean).length).toBeLessThanOrEqual(big.filter(Boolean).length);
  });
});

// Spec sprite-rendering (0018), "Sonda de render para E2E": `drawn` y totales del plan entero.
const planOfSeed = (seed: number, missing: readonly string[] = []) =>
  planFor(toMapSnapshot(mapForSeed(aDefaultConfig(), seed)), seed, missing);
const viewOf = (p: { x: number; y: number }, w = 1280, h = 720) =>
  followView(p, screenFrame(w, h), WORLD_42);
const MAP_SHEETS_FILES = [
  'Terrain/Water/Water.png',
  'Terrain/Water/Foam/Foam.png',
  'Resources/Trees/Tree.png',
  'Terrain/Bridge/Bridge_All.png',
  'Factions/Knights/Buildings/Castle/Castle_Blue.png',
];

describe('RenderLayers · sonda drawn (0018)', () => {
  it.each([
    [42, 667],
    [123, 750],
  ])(
    'Scenario: Totales del mapa sin cambios (semilla %i: %i objetos con toda vista)',
    (seed, n) => {
      const totals: unknown[] = [];
      const drawnAtStart: number[] = [];
      for (const [w, h] of [
        [960, 540],
        [1280, 720],
        [3840, 2160],
      ] as const) {
        for (const p of [{ x: 1920, y: 1080 }, { x: 16, y: 16 }, START]) {
          const { paint, layers } = culled(planOfSeed(seed), screenFrame(w, h));
          paint(at(0, p.x, p.y));
          const { drawn, ...rest } = layers.counts.mapArt;
          totals.push({ cells: { ...layers.counts.cells }, ...rest });
          if (w === 1280 && p === START) drawnAtStart.push(drawn);
        }
      }
      const [first] = totals;
      expect(totals.every((t) => JSON.stringify(t) === JSON.stringify(first))).toBe(true);
      expect((first as { objects: number }).objects).toBe(n);
      const [start = 0] = drawnAtStart;
      expect(start).toBeGreaterThan(0);
      expect(start).toBeLessThan(n);
    },
  );

  it.each([
    [1920, 1080],
    [16, 16],
  ])('Scenario: `drawn` igual al recorte (semilla 42, jugador en (%s, %s))', (x, y) => {
    const { paint, layers, objects, plan } = culled();

    paint(at(5, x, y));

    expect(layers.counts.mapArt.drawn).toBe(drawnByRule(plan, viewOf({ x, y })));
    expect(objects.filter((o) => o.visible)).toHaveLength(layers.counts.mapArt.drawn);
  });

  it('Scenario: R tras acabar en una esquina (semilla 43: regla del plan nuevo, nada del anterior)', () => {
    const { paint, layers, canvas, objects, pool } = culled();
    paint(at(900, 3824, 2144, { status: 'over', outcome: 'lost' }));
    const next = planOfSeed(43);

    layers.clear();
    layers.paintMap(canvas, next);
    paint(at(0, START.x, START.y));

    const view = viewOf(START);
    expect(objects.map((o) => o.visible)).toEqual(visibleByRule(next, view));
    expect(layers.counts.mapArt.drawn).toBe(drawnByRule(next, view));
    expect(pool.slice(objects.length).some((o) => o.visible)).toBe(false);
  });

  it('Scenario: Volver al menú y jugar (capas nuevas: primer frame = regla; menú con drawn 0)', () => {
    const old = culled();
    old.paint(at(500, 400, 300), true);
    expect(emptyCounts(['goblin-torch']).mapArt.drawn).toBe(0);

    const fresh = culled();
    fresh.paint(at(0, START.x, START.y));

    expect(fresh.layers.counts.mapArt.drawn).toBe(drawnByRule(fresh.plan, viewOf(START)));
    expect(fresh.objects.map((o) => o.visible)).toEqual(visibleByRule(fresh.plan, viewOf(START)));
  });

  it('Scenario: Mapa vacío (drawn 0)', () => {
    const empty = planFor(toMapSnapshot(mapWith(mapRules(), {})));
    const { paint, layers } = culled(empty);

    paint(at(0, 1920, 1080));

    expect([layers.counts.mapArt.drawn, layers.counts.mapArt.objects]).toEqual([0, 0]);
  });

  const reserveCases: [string, readonly string[]][] = [
    ...MAP_SHEETS_FILES.map((f): [string, string[]] => [f, [f]]),
    ['las cinco hojas', MAP_SHEETS_FILES],
  ];
  it.each(reserveCases)('Scenario: Recorte con aspecto de reserva (sin %s)', (_, sheets) => {
    const plan = planOfSeed(42, sheets);
    const { paint, layers, objects } = culled(plan);
    const far = { x: START.x - 1300, y: START.y };
    const frames: boolean[] = [];
    for (const p of [START, far]) {
      paint(at(0, p.x, p.y));
      frames.push(
        JSON.stringify(objects.map((o) => o.visible)) ===
          JSON.stringify(visibleByRule(plan, viewOf(p))),
        layers.counts.mapArt.drawn === drawnByRule(plan, viewOf(p)),
      );
    }
    expect(frames).toEqual([true, true, true, true]);
    const { water, shore, foam, tree, canopy, bridge, castle } = layers.counts.mapArt;
    expect({ water, shore, foam, tree, canopy, bridge, castle }).toEqual(plan.counts);
    expect(plan.low.some((d) => d.kind === 'rect')).toBe(
      !sheets.every((f) => f === 'Terrain/Water/Foam/Foam.png'),
    );
  });
});

describe('RenderLayers · recuentos para la sonda', () => {
  it('Scenario: Pulso sin sprite (1 anillo, ningún sprite de hoja)', () => {
    const { frame, layers, rings } = setup();
    frame(snap(5, { pulses: [{ weapon: 'tests', firedAt: 5, x: 480, y: 270, radius: 90 }] }));
    expect(rings.filter((r) => r.visible)).toHaveLength(1);
    expect(layers.counts.pulses).toEqual({ visible: 1, placeholder: 0 });
  });

  it('Scenario: Recuento coherente con el snapshot (recuentos = elementos del snapshot)', () => {
    const { frame, layers } = setup();
    const s = snap(3, {
      enemies: [foe(1, 10, 10), foe(2, 20, 20)],
      projectiles: [{ id: 1, x: 1, y: 1, radius: 4 }],
      gems: [
        { id: 1, x: 5, y: 5, radius: 5 },
        { id: 2, x: 6, y: 6, radius: 5 },
        { id: 3, x: 7, y: 7, radius: 5 },
      ],
    });
    frame(s);
    const c = layers.counts;
    expect([c.enemies.visible, c.projectiles.visible, c.gems.visible, c.player.visible]).toEqual([
      2, 1, 3, 1,
    ]);
    expect(c.ground).toEqual({ visible: 1, placeholder: 0 });
    expect(c.enemyPlaceholders).toEqual({ 'goblin-torch': 0, 'goblin-tnt': 0, 'goblin-barrel': 0 });
  });
});
