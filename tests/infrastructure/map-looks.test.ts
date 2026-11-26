import { describe, expect, it } from 'vitest';
import type { MapAppearance } from '../../src/infrastructure/content/appearanceSchema';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import type { FrameCount } from '../../src/infrastructure/phaser/art/looks';
import {
  BRIDGE_FRAME_NAMES,
  resolveMapLooks,
  resolveStructureLooks,
  type HasFrame,
} from '../../src/infrastructure/phaser/map/mapLooks';
import {
  BRIDGE_FILE,
  CASTLE_FILE,
  FOAM_FILE,
  GROUND_FILE,
  HOUSE_FILE,
  TOWER_RUIN_FILE,
  REGISTERED,
  TREE_FILE,
  WATER_FILE,
  rawAppearance,
} from '../support/appearance';
import { GENERATED_PATHS } from '../support/generated';

// Spec sprite-rendering (0016), "Pintado del mapa": reserva por elemento (design §12.2 B6).
const parsed = parseAppearance(rawAppearance(), REGISTERED, GENERATED_PATHS);
if (!parsed.ok) throw new Error(parsed.error.message);
const { map, terrain } = parsed.value;
const STRUCTURES = resolveStructureLooks(parsed.value, () => 1);

/** Hojas cargadas con su nº de frames; `missing` no carga. */
function loaded(missing: readonly string[] = []): FrameCount {
  const counts: Record<string, number> = {
    [WATER_FILE]: 1,
    [GROUND_FILE]: 40,
    [FOAM_FILE]: 8,
    [TREE_FILE]: 12,
    [BRIDGE_FILE]: 0,
    [CASTLE_FILE]: 1,
  };
  return (key) => (missing.includes(key) ? null : (counts[key] ?? null));
}
const allBridgeFrames: HasFrame = (key, name) =>
  key === BRIDGE_FILE && (Object.values(BRIDGE_FRAME_NAMES) as string[]).includes(name);

const artOf = (looks: ReturnType<typeof resolveMapLooks>) => ({
  water: looks.water.art,
  shore: looks.shore.art,
  foam: looks.foam.art,
  trees: looks.trees.art,
  bridges: looks.bridges.art,
  castle: looks.castle.art,
});
const ALL_ART = { water: true, shore: true, foam: true, trees: true, bridges: true, castle: true };

describe('resolveMapLooks', () => {
  it('con todas las hojas cargadas, todo con arte y los colores de reserva a mano', () => {
    const looks = resolveMapLooks(map, terrain, loaded(), allBridgeFrames, STRUCTURES);
    expect(artOf(looks)).toEqual(ALL_ART);
    expect(looks.colors).toEqual(terrain);
  });

  it.each([
    [WATER_FILE, 'water'],
    [TREE_FILE, 'trees'],
    [BRIDGE_FILE, 'bridges'],
    [FOAM_FILE, 'foam'],
    [CASTLE_FILE, 'castle'],
  ] as const)('Scenario: Reserva de cada elemento (sin %s: solo %s cae a reserva)', (file, key) => {
    const looks = resolveMapLooks(map, terrain, loaded([file]), allBridgeFrames, STRUCTURES);
    expect(artOf(looks)).toEqual({ ...ALL_ART, [key]: false });
  });

  it('Scenario: Reserva de cada elemento (sin la hoja de la orilla, que es la del fondo)', () => {
    const looks = resolveMapLooks(map, terrain, loaded([GROUND_FILE]), allBridgeFrames, STRUCTURES);
    expect(artOf(looks)).toEqual({ ...ALL_ART, shore: false });
  });

  it('un frame usado fuera de la hoja también cae a reserva (caso de orilla 99)', () => {
    const bad: MapAppearance = {
      ...map,
      shore: { ...map.shore, cases: { ...map.shore.cases, N: 99 } },
    };
    expect(resolveMapLooks(bad, terrain, loaded(), allBridgeFrames, STRUCTURES).shore.art).toBe(
      false,
    );
  });

  it('Scenario: Recorte del puente fuera de la hoja (marco norte-sur sin añadir)', () => {
    const noNorthSouth: HasFrame = (key, name) =>
      allBridgeFrames(key, name) && name !== BRIDGE_FRAME_NAMES.northSouth;
    const looks = resolveMapLooks(map, terrain, loaded(), noNorthSouth, STRUCTURES);
    expect(artOf(looks)).toEqual({ ...ALL_ART, bridges: false });
  });
});

// 0021: arte o reserva por tipo de estructura y por aspecto (intacto y ruina), independientes.
describe('Aspectos de las estructuras resueltos', () => {
  const artOfStructures = (missing: readonly string[], frames = 1) =>
    Object.fromEntries(
      Object.entries(
        resolveStructureLooks(parsed.value, (key) => (missing.includes(key) ? null : frames)).types,
      ).map(([id, l]) => [id, [l.intact.art, l.ruin.art]]),
    );

  it('con todas las hojas, arte en los cuatro aspectos y los colores de reserva', () => {
    expect(artOfStructures([])).toEqual({
      'goblin-house': [true, true],
      'goblin-tower': [true, true],
    });
    const { colors, ruinColor } = resolveStructureLooks(parsed.value, () => 1);
    expect(colors).toEqual({ 'goblin-house': 0xa33b2b, 'goblin-tower': 0x7a5230 });
    expect(ruinColor).toBe(0x3d3a36);
  });

  it('sin Goblin_House solo la casa intacta va a reserva; sin Wood_Tower_Destroyed, la ruina de la torre', () => {
    expect(artOfStructures([HOUSE_FILE])).toEqual({
      'goblin-house': [false, true],
      'goblin-tower': [true, true],
    });
    expect(artOfStructures([TOWER_RUIN_FILE])).toEqual({
      'goblin-house': [true, true],
      'goblin-tower': [true, false],
    });
  });

  it('una hoja sin frames (no contiene su frame idle) va a reserva', () => {
    expect(artOfStructures([], 0)).toEqual({
      'goblin-house': [false, false],
      'goblin-tower': [false, false],
    });
  });
});

// Spec sprite-rendering (0029): reserva del árbol y de la torre con su `idle` animada, y arte de la
// decoración por aspecto (sin reserva de color).
describe('resolveMapLooks · animaciones y decoración (0029)', () => {
  it('Scenario: Reserva de árbol y torre (una hoja del árbol sin el frame 3: árbol a reserva)', () => {
    // 0030: con la `idle` 0–3 del repositorio, una hoja de 5 frames ya cabe; sin el frame 3 (0–2), no.
    const repoTrees = {
      ...map,
      trees: { ...map.trees, idle: { frames: [0, 1, 2, 3], fps: 4, loop: true as const } },
    };
    const counts: FrameCount = (key) => (key === TREE_FILE ? 3 : loaded()(key));
    expect(resolveMapLooks(repoTrees, terrain, counts, allBridgeFrames, STRUCTURES).trees.art).toBe(
      false,
    );
    const all: FrameCount = (key) => (key === TREE_FILE ? 4 : loaded()(key));
    expect(resolveMapLooks(repoTrees, terrain, all, allBridgeFrames, STRUCTURES).trees.art).toBe(
      true,
    );
  });

  it('Scenario: Reserva de árbol y torre (sin Tree.png: árbol a reserva)', () => {
    const looks = resolveMapLooks(map, terrain, loaded([TREE_FILE]), allBridgeFrames, STRUCTURES);
    expect(looks.trees.art).toBe(false);
  });

  it('Scenario: Reserva de las estructuras (torre intacta con la idle de 4 frames: sin el frame 3, reserva)', () => {
    const a = parsed.value;
    const tower = a.structures['goblin-tower'];
    if (!tower) throw new Error('sin torre');
    const withTowerIdle = {
      ...a,
      structures: {
        ...a.structures,
        'goblin-tower': {
          intact: { ...tower.intact, idle: { frames: [0, 1, 2, 3], fps: 5, loop: true } },
          ruin: tower.ruin,
        },
      },
    };
    const three = resolveStructureLooks(withTowerIdle, () => 3).types['goblin-tower'];
    const four = resolveStructureLooks(withTowerIdle, () => 4).types['goblin-tower'];
    expect([three?.intact.art, three?.ruin.art]).toEqual([false, true]);
    expect([four?.intact.art, four?.ruin.art]).toEqual([true, true]);
  });

  it('decoración: arte por aspecto (hoja cargada y su frame dentro); los datos, siempre', () => {
    const frames: FrameCount = (key) =>
      key === 'Deco/18.png'
        ? null
        : key === 'Deco/08.png'
          ? 0
          : key.startsWith('Deco/')
            ? 1
            : loaded()(key);
    const looks = resolveMapLooks(map, terrain, frames, allBridgeFrames, STRUCTURES);
    expect(looks.decor.data).toBe(map.decor);
    const art = Object.fromEntries(
      map.decor.items.map((i, k) => [i.sheet.file, looks.decor.art[k]]),
    );
    expect(art['Deco/18.png']).toBe(false);
    expect(art['Deco/08.png']).toBe(false);
    expect(art['Deco/01.png']).toBe(true);
  });
});
