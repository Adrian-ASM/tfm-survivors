import appearanceJson from '../../content/appearance.json';
import arenaJson from '../../content/arena.json';
import provenanceJson from '../../content/asset-provenance.json';
import type { MapSnapshot } from '../../src/domain/map/MapSnapshot';
import type { Appearance } from '../../src/infrastructure/content/appearanceSchema';
import { registeredPaths, parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import type { FrameCount } from '../../src/infrastructure/phaser/art/looks';
import {
  BRIDGE_FRAME_NAMES,
  resolveMapLooks,
  resolveStructureLooks,
  resolveSiteLooks,
  resolveVeinLooks,
  type HasFrame,
  type MapLooks,
} from '../../src/infrastructure/phaser/map/mapLooks';
import { clipRect, cullMargin, touches } from '../../src/infrastructure/phaser/map/mapCulling';
import {
  planMapArt,
  type Box,
  type MapArtPlan,
  type SpriteDraw,
} from '../../src/infrastructure/phaser/map/planMapArt';
import { DECOR_STREAM, deriveSeed } from '../../src/infrastructure/random/deriveSeed';

/** Datos de aspecto del repositorio, ya validados. */
export function repoAppearance(): Appearance {
  const r = parseAppearance(structuredClone(appearanceJson), registeredPaths(provenanceJson));
  if (!r.ok) throw new Error(`${r.error.field}: ${r.error.message}`);
  return r.value;
}

/** Nº de frames de las hojas del repositorio (leídos de sus PNG: 64 → 1 frame…). */
const FRAME_COUNTS: Readonly<Record<string, number>> = {
  'Terrain/Water/Water.png': 1,
  'Terrain/Ground/Tilemap_Flat.png': 40,
  'Terrain/Water/Foam/Foam.png': 8,
  'Resources/Trees/Tree.png': 12,
  'Terrain/Bridge/Bridge_All.png': 0,
  'Factions/Knights/Buildings/Castle/Castle_Blue.png': 1,
  'Factions/Goblins/Buildings/Wood_House/Goblin_House.png': 1,
  'Factions/Goblins/Buildings/Wood_House/Goblin_House_Destroyed.png': 1,
  'Factions/Goblins/Buildings/Wood_Tower/Wood_Tower_Red.png': 4,
  'Factions/Goblins/Buildings/Wood_Tower/Wood_Tower_Destroyed.png': 1,
  'Resources/Gold Mine/GoldMine_Active.png': 1,
  'Resources/Gold Mine/GoldMine_Inactive.png': 1,
  'Factions/Knights/Buildings/House/House_Construction.png': 1,
  'Factions/Knights/Buildings/House/House_Blue.png': 1,
  'Factions/Knights/Buildings/Tower/Tower_Blue.png': 1,
  // 0029: las 11 hojas de la decoración, de 1 frame cada una.
  ...Object.fromEntries(
    ['01', '02', '03', '07', '08', '09', '10', '11', '16', '17', '18'].map((n) => [
      `Deco/${n}.png`,
      1,
    ]),
  ),
};

/** Texturas cargadas salvo las de `missing` (doble de `textureFrames`). */
export const loadedExcept =
  (missing: readonly string[] = []): FrameCount =>
  (key) =>
    missing.includes(key) ? null : (FRAME_COUNTS[key] ?? null);

/** Marcos del puente añadidos (doble de `hasFrame`), salvo los de `missing`. */
export const bridgeFrames =
  (missing: readonly string[] = []): HasFrame =>
  (key, name) =>
    key === 'Terrain/Bridge/Bridge_All.png' &&
    (Object.values(BRIDGE_FRAME_NAMES) as string[]).includes(name) &&
    !missing.includes(name);

/** Cambios de los datos de aspecto del mapa para un escenario (0029: tope de decoración). */
export interface MapArtEdits {
  /** Tope de decoración (`map.decor.maxObjects`); por defecto, el del repositorio (120). */
  readonly maxDecor?: number;
  /** Otro cambio de los datos de aspecto ya validados (p. ej. la `idle` del árbol de 1 frame). */
  readonly appearance?: (a: Appearance) => Appearance;
}

/** Aspectos del mapa del repositorio resueltos con las hojas que faltan dadas. */
export function repoMapLooks(missing: readonly string[] = [], edits: MapArtEdits = {}): MapLooks {
  const base = (edits.appearance ?? ((x: Appearance) => x))(repoAppearance());
  const { maxDecor = base.map.decor.maxObjects } = edits;
  const a = { ...base, map: { ...base.map, decor: { ...base.map.decor, maxObjects: maxDecor } } };
  return resolveMapLooks(
    a.map,
    a.terrain,
    loadedExcept(missing),
    bridgeFrames(),
    resolveStructureLooks(a, loadedExcept(missing)),
    resolveVeinLooks(a, loadedExcept(missing)),
    resolveSiteLooks(a, loadedExcept(missing)),
  );
}

/** Mundo del contenido por defecto (content/arena.json, una sola fuente). */
export const WORLD = { width: arenaJson.width, height: arenaJson.height } as const;

/** Plan del mapa con los aspectos del repositorio y la semilla de decoración de `seed`. */
export function planFor(
  map: MapSnapshot,
  seed = 42,
  missing: readonly string[] = [],
  edits: MapArtEdits = {},
): MapArtPlan {
  return planMapArt(map, repoMapLooks(missing, edits), {
    decorSeed: deriveSeed(seed, DECOR_STREAM),
    world: WORLD,
  });
}

/**
 * Visibilidad que da la regla de recorte (0018) a cada entrada del plan, en orden `[...low, ...high]`,
 * con el rectángulo visible `view` y el margen del juego.
 */
export const visibleByRule = (plan: MapArtPlan, view: Box): boolean[] => {
  const rect = clipRect(view, cullMargin(plan.cellSize));
  return [...plan.low, ...plan.high].map((d) => touches(d.bounds, rect));
};

/** Número de entradas que dibuja la regla de recorte con la vista dada. */
export const drawnByRule = (plan: MapArtPlan, view: Box): number =>
  visibleByRule(plan, view).filter(Boolean).length;

/** Sprites de un papel en las dos capas del plan. */
export const spritesOf = (plan: MapArtPlan, role: SpriteDraw['role']): SpriteDraw[] =>
  [...plan.low, ...plan.high].filter(
    (d): d is SpriteDraw => d.kind === 'sprite' && d.role === role,
  );

/**
 * Fila de mundo donde cae la fila `frameY` del frame de un sprite (con su origen y su escala):
 * `y − (origin.y · alto − frameY) · escala`.
 */
export const worldY = (s: SpriteDraw, frameHeight: number, frameY: number): number =>
  s.y - (s.origin.y * frameHeight - frameY) * s.scale;
