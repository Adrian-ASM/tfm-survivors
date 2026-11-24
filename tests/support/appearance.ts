// Datos de aspecto de prueba (change 0012, design D9): JSON crudo, mínimo y válido, que cada test
// modifica antes de validarlo con `parseAppearance`.
export const TORCH_FILE = 'Factions/Goblins/Troops/Torch/Red/Torch_Red.png';
export const TNT_FILE = 'Factions/Goblins/Troops/TNT/Red/TNT_Red.png';
export const BARREL_FILE = 'Factions/Goblins/Troops/Barrel/Red/Barrel_Red.png';
export const ARCHER_FILE = 'Factions/Knights/Troops/Archer/Blue/Archer_Blue.png';
export const ARROW_FILE = 'Factions/Knights/Troops/Archer/Arrow/Arrow.png';
export const DEAD_FILE = 'Factions/Knights/Troops/Dead/Dead.png';
export const GEM_FILE = 'Resources/Resources/G_Idle.png';
/** Oro (0022): la bolsa de `G_Idle` pasa del aspecto de la gema al del oro. */
export const GOLD_FILE = GEM_FILE;
export const WOOD_FILE = 'Resources/Resources/W_Idle.png';
export const MEAT_FILE = 'Resources/Resources/M_Idle.png';
export const VEIN_FILE = 'Resources/Gold Mine/GoldMine_Active.png';
export const VEIN_DEPLETED_FILE = 'Resources/Gold Mine/GoldMine_Inactive.png';
export const GROUND_FILE = 'Terrain/Ground/Tilemap_Flat.png';
export const WATER_FILE = 'Terrain/Water/Water.png';
export const FOAM_FILE = 'Terrain/Water/Foam/Foam.png';
export const TREE_FILE = 'Resources/Trees/Tree.png';
export const BRIDGE_FILE = 'Terrain/Bridge/Bridge_All.png';
export const CASTLE_FILE = 'Factions/Knights/Buildings/Castle/Castle_Blue.png';
export const DYNAMITE_FILE = 'Factions/Goblins/Troops/TNT/Dynamite/Dynamite.png';
export const EXPLOSION_FILE = 'Effects/Explosion/Explosions.png';
export const HOUSE_FILE = 'Factions/Goblins/Buildings/Wood_House/Goblin_House.png';
export const HOUSE_RUIN_FILE = 'Factions/Goblins/Buildings/Wood_House/Goblin_House_Destroyed.png';
export const TOWER_FILE = 'Factions/Goblins/Buildings/Wood_Tower/Wood_Tower_Red.png';
export const TOWER_RUIN_FILE = 'Factions/Goblins/Buildings/Wood_Tower/Wood_Tower_Destroyed.png';

const FILES = [
  TORCH_FILE,
  TNT_FILE,
  BARREL_FILE,
  ARCHER_FILE,
  ARROW_FILE,
  DEAD_FILE,
  GEM_FILE,
  GROUND_FILE,
  WATER_FILE,
  FOAM_FILE,
  TREE_FILE,
  BRIDGE_FILE,
  CASTLE_FILE,
  DYNAMITE_FILE,
  EXPLOSION_FILE,
  HOUSE_FILE,
  HOUSE_RUIN_FILE,
  TOWER_FILE,
  TOWER_RUIN_FILE,
  WOOD_FILE,
  MEAT_FILE,
  VEIN_FILE,
  VEIN_DEPLETED_FILE,
];

/** Los 15 casos de orilla (lados de río, letras en orden N-E-S-W; design 0016 §12.2 B2). */
export const SHORE_CASE_KEYS = [
  'N',
  'E',
  'S',
  'W',
  'NE',
  'NS',
  'NW',
  'ES',
  'EW',
  'SW',
  'NES',
  'NEW',
  'NSW',
  'ESW',
  'NESW',
] as const;

/** Rutas registradas en la nota de procedencia (`files[].path`). */
export const REGISTERED: readonly string[] = FILES.map((f) => `public/assets/tiny-swords/${f}`);

type Json = Record<string, unknown>;

const anim = (frames: number[], fps: number, loop: boolean) => ({ frames, fps, loop });

function base(file: string, size: number, color: string): Json {
  return {
    sheet: { file, frameWidth: size, frameHeight: size },
    scale: 0.5,
    origin: { x: 0.5, y: 0.5 },
    facing: 'right',
    placeholderColor: color,
  };
}

function moving(file: string, size: number, color: string): Json {
  return {
    ...base(file, size, color),
    idle: anim([0, 1], 2, true),
    walk: anim([6, 7, 8, 9], 10, true),
  };
}

const still = (file: string, size: number, color: string): Json => ({
  ...base(file, size, color),
  idle: anim([0], 1, true),
});

export interface RawAppearance {
  maxCorpses: unknown;
  maxBlastSprites: unknown;
  player: Json;
  enemies: Record<string, Json>;
  projectile: Json;
  pickups: Record<string, Json>;
  veins: Record<string, Json>;
  veinColor: unknown;
  ground: Json;
  corpse: Json;
  dynamite: Json;
  explosion: Json;
  warnings: Record<string, Json>;
  terrain: Record<string, unknown>;
  map: Record<string, Json>;
  structures: Record<string, Record<string, Json>>;
  structureColors: Record<string, unknown>;
  [extra: string]: unknown;
}

const tile = (file: string, size: number, origin = { x: 0, y: 0 }): Json => ({
  sheet: { file, frameWidth: size, frameHeight: size },
  scale: 0.9375,
  origin,
});

/** Sección `map` cruda válida (aspectos del mapa de 0016, con escalas de baldosa de 60 px). */
export function rawMapAppearance(): Record<string, Json> {
  return {
    water: { ...tile(WATER_FILE, 64), frame: 0 },
    shore: {
      ...tile(GROUND_FILE, 64),
      cases: Object.fromEntries(SHORE_CASE_KEYS.map((k, i) => [k, i])),
    },
    foam: { ...tile(FOAM_FILE, 192, { x: 0.5, y: 0.5 }), idle: anim([0, 1, 2, 3], 8, true) },
    trees: {
      ...tile(TREE_FILE, 192, { x: 0.5, y: 0.9 }),
      models: [{ frame: 0 }, { frame: 1 }],
      flip: true,
    },
    bridges: {
      image: BRIDGE_FILE,
      scale: 0.9375,
      origin: { x: 0.5, y: 0.5 },
      frames: {
        northSouth: { x: 0, y: 80, width: 64, height: 160 },
        eastWest: { x: 16, y: 0, width: 160, height: 64 },
      },
    },
    castle: {
      sheet: { file: CASTLE_FILE, frameWidth: 320, frameHeight: 256 },
      scale: 0.9375,
      origin: { x: 0.5, y: 1 },
      frame: 0,
    },
  };
}

/** Aspecto de estructura crudo (0021): hoja de `w × h`, origen en el borde inferior, `idle` [0]. */
const structureLook = (file: string, w: number, h: number): Json => ({
  sheet: { file, frameWidth: w, frameHeight: h },
  scale: 0.9375,
  origin: { x: 0.5, y: 1 },
  facing: 'right',
  idle: anim([0], 1, true),
});

/** Sección `structures` cruda válida: casa y torre, intactas y en ruina (0021). */
export function rawStructureAppearance(): Record<string, Record<string, Json>> {
  return {
    'goblin-house': {
      intact: structureLook(HOUSE_FILE, 128, 192),
      ruin: structureLook(HOUSE_RUIN_FILE, 128, 192),
    },
    'goblin-tower': {
      intact: structureLook(TOWER_FILE, 256, 192),
      ruin: structureLook(TOWER_RUIN_FILE, 256, 192),
    },
  };
}

/** Datos de aspecto crudos válidos con los tres goblins. */
export function rawAppearance(): RawAppearance {
  return {
    maxCorpses: 64,
    player: moving(ARCHER_FILE, 192, '#4cc38a'),
    enemies: {
      'goblin-torch': moving(TORCH_FILE, 192, '#e5484d'),
      'goblin-tnt': { ...moving(TNT_FILE, 192, '#8e4ec6'), throw: anim([14, 15, 16], 14, false) },
      'goblin-barrel': {
        ...moving(BARREL_FILE, 128, '#f76b15'),
        fuse: anim([30, 31, 32], 10, true),
      },
    },
    projectile: still(ARROW_FILE, 64, '#ffd60a'),
    pickups: {
      xp: { shape: true, placeholderColor: '#3e9bff' },
      gold: still(GOLD_FILE, 128, '#e8c547'),
      wood: still(WOOD_FILE, 128, '#9c6b3c'),
      meat: still(MEAT_FILE, 128, '#c8504a'),
    },
    ground: still(GROUND_FILE, 64, '#2f6b3a'),
    corpse: { ...base(DEAD_FILE, 128, '#b0b4ba'), death: anim([1, 2, 3, 4, 5, 6], 15, false) },
    dynamite: still(DYNAMITE_FILE, 64, '#c0392b'),
    explosion: { ...base(EXPLOSION_FILE, 192, '#ffb224'), explode: anim([0, 1, 2], 18, false) },
    warnings: {
      fuse: { color: '#ff8a00', alpha: 0.35 },
      dynamite: { color: '#e5484d', alpha: 0.35 },
    },
    maxBlastSprites: 64,
    terrain: { trunk: '#5b3a1e', water: '#2b6cb0', bridge: '#a47148', castle: '#6b7a8f' },
    map: rawMapAppearance(),
    structures: rawStructureAppearance(),
    structureColors: { 'goblin-house': '#a33b2b', 'goblin-tower': '#7a5230', ruin: '#3d3a36' },
    veins: {
      active: { ...structureLook(VEIN_FILE, 192, 128), scale: 0.6, origin: { x: 0.5, y: 0.5 } },
      depleted: {
        ...structureLook(VEIN_DEPLETED_FILE, 192, 128),
        scale: 0.6,
        origin: { x: 0.5, y: 0.5 },
      },
    },
    veinColor: '#d4a017',
  };
}
