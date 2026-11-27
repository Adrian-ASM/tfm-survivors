// Datos de aspecto de prueba (change 0012, design D9): JSON crudo, mínimo y válido, que cada test
// modifica antes de validarlo con `parseAppearance`.
import appearanceJson from '../../content/appearance.json';

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
/** Hojas de aparición (0030): 7 frames de 128 px, con sombra. */
export const GOLD_SPAWN_FILE = 'Resources/Resources/G_Spawn.png';
export const WOOD_SPAWN_FILE = 'Resources/Resources/W_Spawn.png';
export const MEAT_SPAWN_FILE = 'Resources/Resources/M_Spawn.png';
export const SHEEP_IDLE_FILE = 'Resources/Sheep/HappySheep_Idle.png';
export const SHEEP_BOUNCE_FILE = 'Resources/Sheep/HappySheep_Bouncing.png';
/** Rocas de la piedra (0025): `small`, `medium` y `large`. */
export const ROCK_SMALL_FILE = 'Deco/04.png';
export const ROCK_MEDIUM_FILE = 'Deco/05.png';
export const ROCK_LARGE_FILE = 'Deco/06.png';
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
/** Solares (0026): obra común, casa y torre de caballeros. */
export const SITE_CONSTRUCTION_FILE = 'Factions/Knights/Buildings/House/House_Construction.png';
export const SITE_HOUSE_FILE = 'Factions/Knights/Buildings/House/House_Blue.png';
export const SITE_TOWER_FILE = 'Factions/Knights/Buildings/Tower/Tower_Blue.png';
/** Decoración (0029): las 11 hojas de Deco, en el orden de los datos del repositorio. */
export const DECOR_FILES = ['01', '02', '03', '07', '08', '09', '10', '11', '16', '17', '18'].map(
  (n) => `Deco/${n}.png`,
);
/** Las altas: cartel, poste (64 × 128) y espantapájaros (192 × 192). */
export const DECOR_TALL_FILES = ['Deco/16.png', 'Deco/17.png', 'Deco/18.png'];
export const DECOR_SCARECROW_FILE = 'Deco/18.png';

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
  SHEEP_IDLE_FILE,
  SHEEP_BOUNCE_FILE,
  VEIN_FILE,
  VEIN_DEPLETED_FILE,
  ROCK_SMALL_FILE,
  ROCK_MEDIUM_FILE,
  ROCK_LARGE_FILE,
  SITE_CONSTRUCTION_FILE,
  SITE_HOUSE_FILE,
  SITE_TOWER_FILE,
  ...DECOR_FILES,
  GOLD_SPAWN_FILE,
  WOOD_SPAWN_FILE,
  MEAT_SPAWN_FILE,
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

/** Hojas de las 8 piezas de UI (0032), en el orden de los roles. */
export const UI_FILES = [
  'UI/Banners/Carved_9Slides.png',
  'UI/Buttons/Button_Blue_9Slides.png',
  'UI/Buttons/Button_Hover_9Slides.png',
  'UI/Buttons/Button_Blue_9Slides_Pressed.png',
  'UI/Buttons/Button_Disable_9Slides.png',
  'UI/Buttons/Button_Red_9Slides.png',
  'UI/Buttons/Button_Red_9Slides_Pressed.png',
  'UI/Ribbons/Ribbon_Yellow_3Slides.png',
];
/** Fuente de la interfaz registrada en `fonts[]` (0032). */
export const FONT_PATH = 'public/assets/fonts/DepartureMono-Regular.woff2';

/** Rutas registradas en la nota de procedencia (`files[].path` y, desde 0032, `fonts[].path`). */
export const REGISTERED: readonly string[] = [
  ...[...FILES, ...UI_FILES].map((f) => `public/assets/tiny-swords/${f}`),
  FONT_PATH,
];

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

/** Roca de la piedra (0025): aspecto quieto de 64 × 64 sin color propio. */
const rock = (file: string): Json => ({
  sheet: { file, frameWidth: 64, frameHeight: 64 },
  scale: 0.5,
  origin: { x: 0.5, y: 0.5 },
  facing: 'right',
  idle: anim([0], 1, true),
});

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
  sheep: Json;
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
  sites: Record<string, Json>;
  siteColors: Record<string, unknown>;
  combat: { colors: Record<string, unknown>; numbers: Json; bar: Json } & Json;
  pickupMotion: { float: Record<string, unknown>; spawnStaggerMs: unknown } & Json;
  ui: RawUi;
  icons: { fallback: Record<string, unknown>; byId: Record<string, unknown> } & Json;
  hud: { icons: Record<string, Json & { crop: Json }> } & Json;
  [extra: string]: unknown;
}

/** Piezas por rol (cada una con `image`, `slice`, `fill` e `ink`) y fuente (0032). */
export interface RawUi {
  pieces: Record<string, Json & { slice: Json; ink: Json }>;
  font: Json;
  [extra: string]: unknown;
}

/** Flote de los escenarios de 0030 ("Desplazamiento según el reloj"): A 4, T 1.600 y s 200. */
export const FLOAT_TEST = { amplitude: 4, periodMs: 1600, phaseStepMs: 200 } as const;

/** `spawn` crudo de 7 frames `[0..6]` a 10 fps sin bucle sobre una hoja de 128 px (0030). */
export const rawSpawn = (file: string): Json => ({
  sheet: { file, frameWidth: 128, frameHeight: 128 },
  ...anim([0, 1, 2, 3, 4, 5, 6], 10, false),
});

/**
 * Datos de 0030: flote `FLOAT_TEST`, desfase `staggerMs` y `spawn` en oro, madera y carne (con las
 * hojas `*_Spawn`).
 */
export function withPickupMotion(raw: RawAppearance, staggerMs = 0, spawns = true): void {
  raw.pickupMotion = { float: { ...FLOAT_TEST }, spawnStaggerMs: staggerMs };
  if (!spawns) return;
  const files = { gold: GOLD_SPAWN_FILE, wood: WOOD_SPAWN_FILE, meat: MEAT_SPAWN_FILE } as const;
  for (const [kind, file] of Object.entries(files)) {
    const p = raw.pickups[kind];
    if (p) p.spawn = rawSpawn(file);
  }
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
      idle: anim([0, 1, 2, 3, 4, 5], 6, true),
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
    decor: rawDecorAppearance(),
  };
}

/** Aspecto de decoración crudo (0029): hoja de `w × h` de 1 frame, origen en el borde inferior. */
export const decorItem = (file: string, w: number, h: number, tall: boolean): Json => ({
  sheet: { file, frameWidth: w, frameHeight: h },
  frame: 0,
  scale: 0.9375,
  origin: { x: 0.5, y: 1 },
  tall,
});

/** Sección `map.decor` cruda válida (0029): las 11 hojas de Deco, tope 120 y densidad 25. */
export function rawDecorAppearance(): Json {
  return {
    density: 25,
    maxObjects: 120,
    castleMargin: 1,
    items: DECOR_FILES.map((file) => {
      if (file === DECOR_SCARECROW_FILE) return decorItem(file, 192, 192, true);
      const tall = DECOR_TALL_FILES.includes(file);
      return decorItem(file, 64, tall ? 128 : 64, tall);
    }),
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
      'goblin-torch': { ...moving(TORCH_FILE, 192, '#e5484d'), rock: 'small' },
      'goblin-tnt': {
        ...moving(TNT_FILE, 192, '#8e4ec6'),
        throw: anim([14, 15, 16], 14, false),
        rock: 'medium',
      },
      'goblin-barrel': {
        ...moving(BARREL_FILE, 128, '#f76b15'),
        fuse: anim([30, 31, 32], 10, true),
        rock: 'small',
      },
    },
    projectile: still(ARROW_FILE, 64, '#ffd60a'),
    pickups: {
      xp: { shape: true, placeholderColor: '#3e9bff', diameter: 10 },
      gold: still(GOLD_FILE, 128, '#e8c547'),
      wood: still(WOOD_FILE, 128, '#9c6b3c'),
      meat: still(MEAT_FILE, 128, '#c8504a'),
      stone: {
        placeholderColor: '#9aa0a6',
        rocks: {
          small: rock(ROCK_SMALL_FILE),
          medium: rock(ROCK_MEDIUM_FILE),
          large: rock(ROCK_LARGE_FILE),
        },
      },
    },
    // 0030: sin flote ni desfase por defecto (posiciones del snapshot); ver `FLOAT_TEST`.
    pickupMotion: {
      float: { amplitude: 0, periodMs: 1600, phaseStepMs: 200 },
      spawnStaggerMs: 0,
    },
    sheep: {
      scale: 0.6,
      origin: { x: 0.5, y: 0.5 },
      facing: 'right',
      placeholderColor: '#f0ead6',
      idle: {
        sheet: { file: SHEEP_IDLE_FILE, frameWidth: 128, frameHeight: 128 },
        ...anim([0, 1, 2, 3, 4, 5, 6, 7], 8, true),
      },
      bounce: {
        sheet: { file: SHEEP_BOUNCE_FILE, frameWidth: 128, frameHeight: 128 },
        ...anim([0, 1, 2, 3, 4, 5], 10, true),
      },
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
    sites: {
      construction: structureLook(SITE_CONSTRUCTION_FILE, 128, 192),
      house: structureLook(SITE_HOUSE_FILE, 128, 192),
      tower: structureLook(SITE_TOWER_FILE, 128, 256),
    },
    siteColors: { construction: '#b8a27a', house: '#3f6fb5', tower: '#2c4a7d' },
    combat: {
      colors: { enemy: '#ffffff', structure: '#ffd166', sheep: '#9be7ff', player: '#ff3b30' },
      numbers: { durationMs: 800, risePx: 32, liftPx: 20, fontPx: 16, pool: 48 },
      bar: { width: 48, height: 6, gap: 8, fill: '#e63946', back: '#1d1d1d' },
    },
    ui: rawUi(),
    // 0034: los iconos del repositorio (sus rutas, en la lista IA: `GENERATED_PATHS`).
    icons: structuredClone(appearanceJson.icons),
    // 0036: contadores del HUD del repositorio (lado, paso, recortes y frame de la calavera).
    hud: structuredClone(appearanceJson.hud),
  };
}

/** Interfaz cruda (0032): copia de la del repositorio, que cada test puede modificar. */
export function rawUi(): RawUi {
  return structuredClone(appearanceJson.ui);
}
