import { describe, expect, it } from 'vitest';
import { toMapSnapshot, type MapSnapshot } from '../../src/domain/map/MapSnapshot';
import type { RunSnapshot, StructureSnapshot } from '../../src/domain/run/RunSnapshot';
import { followView } from '../../src/infrastructure/phaser/CameraRig';
import type { RingSprite } from '../../src/infrastructure/phaser/PulseLayer';
import { RenderLayers } from '../../src/infrastructure/phaser/RenderLayers';
import { StructureArt, type StructureMask } from '../../src/infrastructure/phaser/StructureArt';
import type { MapArtCanvas } from '../../src/infrastructure/phaser/TerrainView';
import { MapCuller } from '../../src/infrastructure/phaser/map/mapCulling';
import type {
  Box,
  MapArtPlan,
  PlannedStructure,
} from '../../src/infrastructure/phaser/map/planMapArt';
import { emptyCounts } from '../../src/infrastructure/phaser/renderCounts';
import { aDefaultConfig } from '../support/builders';
import { HOUSE_AT_20_10, aCampsConfig, startDeclared, startOn } from '../support/camps';
import { FAKE_HAZARD_CAPACITY, FakeGraphics, fakeKit } from '../support/FakeSprite';
import { someLooks } from '../support/looks';
import { planFor, visibleByRule } from '../support/mapArt';
import { mapRules, mapWith } from '../support/mapLayouts';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';
import { randomInputs } from '../support/inputs';

// Spec sprite-rendering (0021): "Ruina tras la destrucción", "`drawn` igual al recorte", "Sin
// estructuras en el mapa vacío ni tras R" y "Guardia ante la casa" (parte sin motor), con la máscara
// de habilitado de `MapCuller` y `StructureArt`.
const TYPES = ['goblin-house', 'goblin-tower'];
const WORLD = aDefaultConfig().arena;

class Ring implements RingSprite {
  setPosition(): this {
    return this;
  }
  setRadius(): this {
    return this;
  }
  setAlpha(): this {
    return this;
  }
  setVisible(): this {
    return this;
  }
}

interface Painted {
  layer: 'low' | 'high';
  role: string;
  visible: boolean;
}

/** Lienzo doble: un objeto por llamada desde el último `clear`, con su capa y visibilidad. */
function canvasDouble() {
  const objects: Painted[] = [];
  const add = (layer: 'low' | 'high', role: string) => objects.push({ layer, role, visible: true });
  const canvas: MapArtCanvas = {
    clear: () => {
      objects.length = 0;
    },
    tiles: () => add('low', 'tiles'),
    sprite: (layer, s) => add(layer, s.role),
    rect: () => add('low', 'rect'),
    circle: () => add('low', 'circle'),
    foam: () => undefined,
    show: (i, v) => {
      const o = objects[i];
      if (o) o.visible = v;
    },
  };
  return { canvas, objects };
}

function layersFor(plan: MapArtPlan) {
  const layers = new RenderLayers(
    {
      kit: fakeKit(),
      ring: () => new Ring(),
      warnings: () => new FakeGraphics(),
      looks: someLooks(),
      structureTypes: TYPES,
      capacity: {
        enemies: 8,
        projectiles: 8,
        pulses: 2,
        pickups: 8,
        corpses: 8,
        visualTicks: new Map(),
        hazards: FAKE_HAZARD_CAPACITY,
      },
    },
    { visible: 1, placeholder: 0 },
  );
  const { canvas, objects } = canvasDouble();
  layers.paintMap(canvas, plan);
  const viewOf = (p: { x: number; y: number }): Box =>
    followView(p, { width: 1280, height: 720 }, WORLD);
  /** Un frame: capas con el snapshot y recorte con la vista del jugador. */
  const frame = (s: RunSnapshot): void => {
    layers.render(s);
    layers.cullMap(viewOf(s.player));
  };
  return { layers, canvas, objects, frame, viewOf };
}

const withStructures = (
  base: RunSnapshot,
  tick: number,
  change: (s: StructureSnapshot) => Partial<StructureSnapshot> = () => ({}),
  player = { x: 1260, y: 900 },
): RunSnapshot => ({
  ...base,
  tick,
  player: { ...base.player, ...player },
  structures: base.structures.map((s) => ({ ...s, ...change(s) })),
});

const destroyed = (s: StructureSnapshot) => ({ destroyed: true, health: 0, id: s.id });

describe('StructureArt · ruina con máscara', () => {
  it('Scenario: Ruina tras la destrucción (desde el frame del tick n, nunca la hoja intacta)', () => {
    const run = startDeclared(aCampsConfig(), [HOUSE_AT_20_10]);
    const plan = planFor(run.map);
    const [house] = plan.structures;
    const { frame, objects, layers } = layersFor(plan);
    const base = run.snapshot();
    const n = 50;
    frame(withStructures(base, n - 1));
    const visibleOf = (ids: readonly number[]) => ids.map((i) => objects[i]?.visible);
    expect(visibleOf(house?.intact ?? [])).toEqual([true, true]);
    expect(visibleOf(house?.ruin ?? [])).toEqual([false, false]);
    expect(layers.counts.structures['goblin-house']).toEqual({ intact: 1, ruin: 0, fallback: 0 });
    for (let t = n; t <= n + 60; t++) {
      frame(withStructures(base, t, destroyed));
      expect(visibleOf(house?.ruin ?? [])).toEqual([true, true]);
      expect(visibleOf(house?.intact ?? [])).toEqual([false, false]);
    }
    expect(layers.counts.structures['goblin-house']).toEqual({ intact: 0, ruin: 1, fallback: 0 });
  });

  it('una ruina no vuelve a intacta aunque un snapshot posterior no la dé por destruida', () => {
    const planned: PlannedStructure[] = [
      {
        id: 0,
        type: 'goblin-house',
        intact: [3],
        ruin: [4],
        fallback: { intact: true, ruin: false },
      },
    ];
    const calls: [number, boolean][] = [];
    const mask: StructureMask = { setEnabled: (i, on) => calls.push([i, on]) };
    const art = new StructureArt(TYPES);
    art.reset(planned, mask);
    expect(art.counts['goblin-house']).toEqual({ intact: 1, ruin: 0, fallback: 1 });
    const snap = (d: boolean) => [{ destroyed: d } as StructureSnapshot];
    art.sync(snap(true));
    art.sync(snap(true));
    art.sync(snap(false));
    expect(calls).toEqual([
      [4, false],
      [3, true],
      [3, false],
      [4, true],
    ]);
    expect(art.counts['goblin-house']).toEqual({ intact: 0, ruin: 1, fallback: 0 });
    expect(art.counts['goblin-tower']).toEqual({ intact: 0, ruin: 0, fallback: 0 });
  });

  it('MapCuller: una entrada deshabilitada no se dibuja aunque caiga en la vista', () => {
    const plan = planFor(startDeclared(aCampsConfig(), [HOUSE_AT_20_10]).map);
    const culler = new MapCuller();
    const shown: [number, boolean][] = [];
    culler.reset(plan);
    const view = followView({ x: 1260, y: 900 }, { width: 1280, height: 720 }, WORLD);
    const index = plan.structures[0]?.intact[0] ?? -1;
    culler.setEnabled(index, false);
    culler.apply(view, { show: (i, v) => shown.push([i, v]) });
    expect(shown).toContainEqual([index, false]);
    const expected = visibleByRule(plan, view).filter((v, i) => v && i !== index).length;
    expect(culler.drawn).toBe(expected);
    culler.setEnabled(index, true);
    culler.apply(view, { show: (i, v) => shown.push([i, v]) });
    expect(shown.at(-1)).toEqual([index, true]);
    expect(culler.drawn).toBe(expected + 1);
  });
});

describe('StructureArt · recorte y cambio de partida', () => {
  /** Visibles según la regla de recorte, sin los aspectos deshabilitados (ruinas intactas). */
  const expectedVisible = (plan: MapArtPlan, view: Box, ruined: readonly number[] = []) => {
    const off = new Set([
      ...plan.structures.flatMap((s) => (ruined.includes(s.id) ? s.intact : s.ruin)),
      // 0022: las vetas activas, con su aspecto agotado deshabilitado.
      ...plan.veins.flatMap((v) => v.ruin),
      // 0026: los solares en obra, con la casa y la torre deshabilitadas.
      ...plan.sites.flatMap((s) => [...s.house, ...s.tower]),
    ]);
    return visibleByRule(plan, view).map((v, i) => v && !off.has(i));
  };

  it.each([
    [1920, 1080],
    [16, 16],
    [1140, 930],
  ])('Scenario: `drawn` igual al recorte (semilla 42, jugador en (%s, %s))', (x, y) => {
    const run = startSeededRun(aDefaultConfig(), 42);
    const plan = planFor(run.map, 42);
    const { frame, objects, layers, viewOf } = layersFor(plan);
    const base = run.snapshot();
    frame(withStructures(base, 5, () => ({}), { x, y }));
    const expected = expectedVisible(plan, viewOf({ x, y }));
    expect(objects.map((o) => o.visible)).toEqual(expected);
    expect(layers.counts.mapArt.drawn).toBe(expected.filter(Boolean).length);
    // Con la primera casa destruida, su ruina ocupa el lugar de su aspecto intacto.
    frame(withStructures(base, 6, (s) => (s.id === 0 ? destroyed(s) : {}), { x, y }));
    const ruined = expectedVisible(plan, viewOf({ x, y }), [0]);
    expect(objects.map((o) => o.visible)).toEqual(ruined);
    expect(layers.counts.mapArt.drawn).toBe(ruined.filter(Boolean).length);
  });

  it('Scenario: Sin estructuras en el mapa vacío ni tras R (vacío y semilla 43)', () => {
    const first = startSeededRun(aDefaultConfig(), 42);
    const plan = planFor(first.map, 42);
    const { frame, objects, layers, canvas, viewOf } = layersFor(plan);
    frame(withStructures(first.snapshot(), 10, (s) => (s.id === 1 ? destroyed(s) : {})));
    expect(layers.counts.structures['goblin-house']).toMatchObject({ intact: 3, ruin: 1 });
    // R con el mapa vacío: ninguna estructura pintada.
    const empty: MapSnapshot = toMapSnapshot(mapWith(mapRules(), {}));
    const open = startSeededRun(aDefaultConfig(), 42, 'empty');
    layers.clear();
    layers.paintMap(canvas, planFor(empty));
    frame({ ...open.snapshot(), tick: 0 });
    expect(objects.filter((o) => o.role.startsWith('structure'))).toEqual([]);
    expect(layers.counts.structures).toEqual(emptyCounts([], TYPES).structures);
    // R con la semilla 43: exactamente las de la partida nueva, todas intactas.
    const next = startSeededRun(aDefaultConfig(), 43);
    const plan43 = planFor(next.map, 43);
    layers.clear();
    layers.paintMap(canvas, plan43);
    const s = next.snapshot();
    frame(s);
    expect(objects.map((o) => o.visible)).toEqual(expectedVisible(plan43, viewOf(s.player)));
    const houses = next.map.structures.filter((x) => x.type === 'goblin-house').length;
    expect(layers.counts.structures['goblin-house']).toEqual({
      intact: houses,
      ruin: 0,
      fallback: 0,
    });
  });

  it('Scenario: Sonda en el menú (estructuras a 0 por tipo)', () => {
    expect(emptyCounts(['goblin-torch'], TYPES).structures).toEqual({
      'goblin-house': { intact: 0, ruin: 0, fallback: 0 },
      'goblin-tower': { intact: 0, ruin: 0, fallback: 0 },
    });
  });

  it('Scenario: Recuento coherente con el snapshot (estructuras por tipo, con reserva)', () => {
    const run = startSeededRun(aDefaultConfig(), 42);
    const missing = ['Factions/Goblins/Buildings/Wood_Tower/Wood_Tower_Destroyed.png'];
    const plan = planFor(run.map, 42, missing);
    const { frame, layers } = layersFor(plan);
    const snapshot = withStructures(run.snapshot(), 3, (s) =>
      s.type === 'goblin-tower' && s.id % 2 === 0 ? destroyed(s) : {},
    );
    frame(snapshot);
    for (const type of TYPES) {
      const list = snapshot.structures.filter((s) => s.type === type);
      const ruins = list.filter((s) => s.destroyed).length;
      expect(layers.counts.structures[type]).toEqual({
        intact: list.length - ruins,
        ruin: ruins,
        fallback: type === 'goblin-tower' ? ruins : 0,
      });
    }
  });
});

describe('StructureArt · capas', () => {
  it('Scenario: Guardia ante la casa (parte baja en la capa baja, alta en la alta; también la ruina)', () => {
    const plan = planFor(startDeclared(aCampsConfig(), [HOUSE_AT_20_10]).map);
    const { objects } = layersFor(plan);
    const [house] = plan.structures;
    const all = [...plan.low, ...plan.high];
    for (const ids of [house?.intact ?? [], house?.ruin ?? []]) {
      const [low, high] = ids;
      expect(objects[low ?? -1]).toMatchObject({ layer: 'low', role: 'structure' });
      expect(objects[high ?? -1]).toMatchObject({ layer: 'high', role: 'structure-top' });
      const lowBox = all[low ?? -1]?.bounds;
      const highBox = all[high ?? -1]?.bounds;
      // El guardia en la puerta (1.290, 810) queda por debajo del borde 720 (delante de la parte
      // baja) y el jugador en (1.260, 700), detrás: tapado por la parte alta.
      expect(Math.abs((lowBox?.y ?? 0) - 720)).toBeLessThanOrEqual(1);
      expect(Math.abs((highBox?.y ?? 0) + (highBox?.height ?? 0) - 720)).toBeLessThanOrEqual(1);
    }
  });
});

// Spec sprite-rendering (0021), "Pintar no cambia la simulación": con las hojas de las estructuras y
// sin ellas (reserva), la partida es la misma tick a tick, y la misma que sin pintar.
describe('El pintado de las estructuras no cambia la simulación', () => {
  const STRUCTURE_SHEETS = [
    'Factions/Goblins/Buildings/Wood_House/Goblin_House.png',
    'Factions/Goblins/Buildings/Wood_House/Goblin_House_Destroyed.png',
    'Factions/Goblins/Buildings/Wood_Tower/Wood_Tower_Red.png',
    'Factions/Goblins/Buildings/Wood_Tower/Wood_Tower_Destroyed.png',
  ];

  function play(missing: readonly string[] | null): RunSnapshot[] {
    const run = startSeededRun(aDefaultConfig(), 42);
    const painter = missing ? layersFor(planFor(run.map, 42, missing)) : null;
    return randomInputs(1200, 2026).map((input) => {
      chooseFirstWhileOpen(run);
      run.tick(input);
      const s = run.snapshot();
      painter?.frame(s);
      return s;
    });
  }

  it('Scenario: Pintar no cambia la simulación (semilla 42, 1.200 ticks)', () => {
    const withSheets = play([]);
    expect(play(STRUCTURE_SHEETS)).toStrictEqual(withSheets);
    expect(play(null)).toStrictEqual(withSheets);
  });
});

// Spec sprite-rendering (0022): "Pintado de las vetas" (parte sin motor), sonda `sprites.veins` y
// "R con el mapa real" (vetas y montones de la partida nueva).
describe('Vetas pintadas con máscara (StructureArt parametrizado)', () => {
  const V = { x: 1000, y: 1000 };
  const veinRun = () => startOn(aCampsConfig(), { kind: 'open', resources: { veins: [V] } });
  const depleted = (s: RunSnapshot): RunSnapshot => ({
    ...s,
    veins: s.veins.map((v) => ({ ...v, depleted: true })),
  });

  it('Scenario: Veta agotada (desde el frame del tick n, nunca la hoja activa)', () => {
    const run = veinRun();
    const plan = planFor(run.map);
    const [vein] = plan.veins;
    const { frame, objects, layers } = layersFor(plan);
    const base = { ...run.snapshot(), player: { ...run.snapshot().player, ...V } };
    const visibleOf = (ids: readonly number[]) => ids.map((i) => objects[i]?.visible);
    frame({ ...base, tick: 49 });
    expect(visibleOf(vein?.intact ?? [])).toEqual([true]);
    expect(visibleOf(vein?.ruin ?? [])).toEqual([false]);
    expect({ ...layers.counts.veins }).toEqual({ active: 1, depleted: 0, fallback: 0 });
    for (let t = 50; t <= 110; t++) {
      frame({ ...depleted(base), tick: t });
      expect(visibleOf(vein?.ruin ?? [])).toEqual([true]);
      expect(visibleOf(vein?.intact ?? [])).toEqual([false]);
    }
    expect({ ...layers.counts.veins }).toEqual({ active: 0, depleted: 1, fallback: 0 });
  });

  it('Scenario: Vetas recortadas por cámara (semilla 42, 1.280 × 720, jugador en (16, 16))', () => {
    const run = startSeededRun(aDefaultConfig(), 42);
    const plan = planFor(run.map, 42);
    const { frame, objects, layers, viewOf } = layersFor(plan);
    const s = { ...run.snapshot(), player: { ...run.snapshot().player, x: 16, y: 16 } };
    frame(s);
    const rule = visibleByRule(plan, viewOf(s.player));
    for (const v of plan.veins) {
      expect(objects[v.intact[0] ?? -1]?.visible).toBe(rule[v.intact[0] ?? -1]);
      expect(objects[v.ruin[0] ?? -1]?.visible).toBe(false);
    }
    const off = new Set([
      ...plan.structures.flatMap((x) => x.ruin),
      ...plan.veins.flatMap((v) => v.ruin),
      ...plan.sites.flatMap((x) => [...x.house, ...x.tower]),
    ]);
    expect(layers.counts.mapArt.drawn).toBe(rule.filter((v, i) => v && !off.has(i)).length);
  });

  it('Scenario: R con el mapa real (42 con vetas agotadas y oro en el suelo → 43: las suyas, activas)', () => {
    const first = startSeededRun(aDefaultConfig(), 42);
    const { frame, objects, layers, canvas } = layersFor(planFor(first.map, 42));
    const ended = depleted(first.snapshot());
    frame({
      ...ended,
      tick: 900,
      pickups: [{ id: 99, kind: 'gold', value: 5, x: 500, y: 500, radius: 5 }],
    });
    expect({ ...layers.counts.veins }).toMatchObject({ depleted: first.map.veins.length });
    const next = startSeededRun(aDefaultConfig(), 43);
    const plan43 = planFor(next.map, 43);
    layers.clear();
    layers.paintMap(canvas, plan43);
    const s = next.snapshot();
    frame(s);
    expect({ ...layers.counts.veins }).toEqual({
      active: next.map.veins.length,
      depleted: 0,
      fallback: 0,
    });
    expect(layers.counts.pickups.gold.visible).toBe(0);
    expect(layers.counts.pickups.wood.visible).toBe(next.map.woodPiles.length);
    for (const v of plan43.veins) expect(objects[v.ruin[0] ?? -1]?.visible).toBe(false);
  });

  it('Scenario: Sonda en el menú (vetas a 0)', () => {
    expect(emptyCounts([], TYPES).veins).toEqual({ active: 0, depleted: 0, fallback: 0 });
  });
});
