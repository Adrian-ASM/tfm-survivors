import { describe, expect, it } from 'vitest';
import type { MapAppearance } from '../../src/infrastructure/content/appearanceSchema';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import type { FrameCount } from '../../src/infrastructure/phaser/art/looks';
import {
  BRIDGE_FRAME_NAMES,
  resolveMapLooks,
  type HasFrame,
} from '../../src/infrastructure/phaser/map/mapLooks';
import {
  BRIDGE_FILE,
  CASTLE_FILE,
  FOAM_FILE,
  GROUND_FILE,
  REGISTERED,
  TREE_FILE,
  WATER_FILE,
  rawAppearance,
} from '../support/appearance';

// Spec sprite-rendering (0016), "Pintado del mapa": reserva por elemento (design §12.2 B6).
const parsed = parseAppearance(rawAppearance(), REGISTERED);
if (!parsed.ok) throw new Error(parsed.error.message);
const { map, terrain } = parsed.value;

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
    const looks = resolveMapLooks(map, terrain, loaded(), allBridgeFrames);
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
    const looks = resolveMapLooks(map, terrain, loaded([file]), allBridgeFrames);
    expect(artOf(looks)).toEqual({ ...ALL_ART, [key]: false });
  });

  it('Scenario: Reserva de cada elemento (sin la hoja de la orilla, que es la del fondo)', () => {
    const looks = resolveMapLooks(map, terrain, loaded([GROUND_FILE]), allBridgeFrames);
    expect(artOf(looks)).toEqual({ ...ALL_ART, shore: false });
  });

  it('un frame usado fuera de la hoja también cae a reserva (caso de orilla 99)', () => {
    const bad: MapAppearance = {
      ...map,
      shore: { ...map.shore, cases: { ...map.shore.cases, N: 99 } },
    };
    expect(resolveMapLooks(bad, terrain, loaded(), allBridgeFrames).shore.art).toBe(false);
  });

  it('Scenario: Recorte del puente fuera de la hoja (marco norte-sur sin añadir)', () => {
    const noNorthSouth: HasFrame = (key, name) =>
      allBridgeFrames(key, name) && name !== BRIDGE_FRAME_NAMES.northSouth;
    const looks = resolveMapLooks(map, terrain, loaded(), noNorthSouth);
    expect(artOf(looks)).toEqual({ ...ALL_ART, bridges: false });
  });
});
