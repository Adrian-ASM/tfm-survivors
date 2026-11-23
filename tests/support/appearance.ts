// Datos de aspecto de prueba (change 0012, design D9): JSON crudo, mínimo y válido, que cada test
// modifica antes de validarlo con `parseAppearance`.
export const TORCH_FILE = 'Factions/Goblins/Troops/Torch/Red/Torch_Red.png';
export const TNT_FILE = 'Factions/Goblins/Troops/TNT/Red/TNT_Red.png';
export const BARREL_FILE = 'Factions/Goblins/Troops/Barrel/Red/Barrel_Red.png';
export const ARCHER_FILE = 'Factions/Knights/Troops/Archer/Blue/Archer_Blue.png';
export const ARROW_FILE = 'Factions/Knights/Troops/Archer/Arrow/Arrow.png';
export const DEAD_FILE = 'Factions/Knights/Troops/Dead/Dead.png';
export const GEM_FILE = 'Resources/Resources/G_Idle.png';
export const GROUND_FILE = 'Terrain/Ground/Tilemap_Flat.png';

const FILES = [
  TORCH_FILE,
  TNT_FILE,
  BARREL_FILE,
  ARCHER_FILE,
  ARROW_FILE,
  DEAD_FILE,
  GEM_FILE,
  GROUND_FILE,
];

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
  player: Json;
  enemies: Record<string, Json>;
  projectile: Json;
  gem: Json;
  ground: Json;
  corpse: Json;
  terrain: Record<string, unknown>;
  [extra: string]: unknown;
}

/** Datos de aspecto crudos válidos con los tres goblins. */
export function rawAppearance(): RawAppearance {
  return {
    maxCorpses: 64,
    player: moving(ARCHER_FILE, 192, '#4cc38a'),
    enemies: {
      'goblin-torch': moving(TORCH_FILE, 192, '#e5484d'),
      'goblin-tnt': moving(TNT_FILE, 192, '#8e4ec6'),
      'goblin-barrel': moving(BARREL_FILE, 128, '#f76b15'),
    },
    projectile: still(ARROW_FILE, 64, '#ffd60a'),
    gem: still(GEM_FILE, 128, '#3e9bff'),
    ground: still(GROUND_FILE, 64, '#2f6b3a'),
    corpse: { ...base(DEAD_FILE, 128, '#b0b4ba'), death: anim([1, 2, 3, 4, 5, 6], 15, false) },
    terrain: { trunk: '#5b3a1e', water: '#2b6cb0', bridge: '#a47148' },
  };
}
