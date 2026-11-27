// Sprites del juego para la presentación. Reutiliza las hojas de `public/assets/tiny-swords/`
// (ya versionadas con su procedencia en content/asset-provenance.json): no añade ficheros gráficos.
// Los marcos y animaciones salen de content/appearance.json.

const ROOT = `${import.meta.env.BASE_URL}assets/tiny-swords/`;

interface SpriteDef {
  readonly file: string;
  readonly sheet: readonly [number, number];
  readonly frame: readonly [number, number];
  readonly row: number;
  readonly col: number;
  readonly frames: number;
  readonly fps: number;
}

const def = (
  file: string,
  sheet: readonly [number, number],
  frame: readonly [number, number],
  anim: { row?: number; col?: number; frames?: number; fps?: number } = {},
): SpriteDef => ({
  file,
  sheet,
  frame,
  row: anim.row ?? 0,
  col: anim.col ?? 0,
  frames: anim.frames ?? 1,
  fps: anim.fps ?? 1,
});

const ARCHER = 'Factions/Knights/Troops/Archer/Blue/Archer_Blue.png';
const TORCH = 'Factions/Goblins/Troops/Torch/Red/Torch_Red.png';
const TNT = 'Factions/Goblins/Troops/TNT/Red/TNT_Red.png';
const BARREL = 'Factions/Goblins/Troops/Barrel/Red/Barrel_Red.png';

export const SPRITES = {
  archer: def(ARCHER, [1536, 1344], [192, 192], { frames: 6, fps: 8 }),
  'archer-walk': def(ARCHER, [1536, 1344], [192, 192], { row: 1, frames: 6, fps: 10 }),
  'archer-shoot': def(ARCHER, [1536, 1344], [192, 192], { row: 4, frames: 8, fps: 10 }),
  torch: def(TORCH, [1344, 960], [192, 192], { frames: 7, fps: 8 }),
  'torch-walk': def(TORCH, [1344, 960], [192, 192], { row: 1, frames: 6, fps: 10 }),
  tnt: def(TNT, [1344, 576], [192, 192], { frames: 6, fps: 8 }),
  'tnt-throw': def(TNT, [1344, 576], [192, 192], { row: 2, frames: 7, fps: 10 }),
  barrel: def(BARREL, [768, 768], [128, 128], { row: 4, frames: 3, fps: 8 }),
  'barrel-fuse': def(BARREL, [768, 768], [128, 128], { row: 5, frames: 3, fps: 10 }),
  'barrel-peek': def(BARREL, [768, 768], [128, 128], { row: 1, frames: 6, fps: 6 }),
  dynamite: def('Factions/Goblins/Troops/TNT/Dynamite/Dynamite.png', [384, 64], [64, 64], {
    frames: 6,
    fps: 12,
  }),
  explosion: def('Effects/Explosion/Explosions.png', [1728, 192], [192, 192], {
    frames: 9,
    fps: 16,
  }),
  dead: def('Factions/Knights/Troops/Dead/Dead.png', [896, 256], [128, 128], { frames: 7, fps: 6 }),
  house: def('Factions/Goblins/Buildings/Wood_House/Goblin_House.png', [128, 192], [128, 192]),
  'house-ruin': def(
    'Factions/Goblins/Buildings/Wood_House/Goblin_House_Destroyed.png',
    [128, 192],
    [128, 192],
  ),
  tower: def('Factions/Goblins/Buildings/Wood_Tower/Wood_Tower_Red.png', [1024, 192], [256, 192], {
    frames: 4,
    fps: 6,
  }),
  castle: def('Factions/Knights/Buildings/Castle/Castle_Blue.png', [320, 256], [320, 256]),
  tree: def('Resources/Trees/Tree.png', [768, 576], [192, 192], { frames: 4, fps: 6 }),
  gold: def('Resources/Resources/G_Idle.png', [128, 128], [128, 128]),
  wood: def('Resources/Resources/W_Idle.png', [128, 128], [128, 128]),
  meat: def('Resources/Resources/M_Idle.png', [128, 128], [128, 128]),
  sheep: def('Resources/Sheep/HappySheep_Idle.png', [1024, 128], [128, 128], { frames: 8, fps: 8 }),
  'sheep-bounce': def('Resources/Sheep/HappySheep_Bouncing.png', [768, 128], [128, 128], {
    frames: 6,
    fps: 10,
  }),
  'house-blue': def('Factions/Knights/Buildings/House/House_Blue.png', [128, 192], [128, 192]),
  'tower-blue': def('Factions/Knights/Buildings/Tower/Tower_Blue.png', [128, 256], [128, 256]),
  arrow: def('Factions/Knights/Troops/Archer/Arrow/Arrow.png', [64, 128], [64, 64]),
} as const satisfies Record<string, SpriteDef>;

export type SpriteName = keyof typeof SPRITES;

const isSprite = (name: string): name is SpriteName => name in SPRITES;
const px = (value: number): string => `${String(value)}px`;

/**
 * Convierte cada `[data-sprite]` en un sprite animado con CSS (`steps()` sobre la hoja).
 * Atributos: `data-sprite` (nombre), `data-scale` (1 por defecto), `data-flip`, `data-once`.
 */
export function mountSprites(root: ParentNode = document): void {
  for (const node of root.querySelectorAll<HTMLElement>('[data-sprite]')) {
    const name = node.dataset['sprite'] ?? '';
    if (!isSprite(name)) continue;
    const sprite: SpriteDef = SPRITES[name];
    const scale = Number(node.dataset['scale'] ?? '1');
    const [fw, fh] = sprite.frame;
    const [sw, sh] = sprite.sheet;
    const style = node.style;
    node.classList.add('sprite');
    style.width = px(fw * scale);
    style.height = px(fh * scale);
    style.backgroundImage = `url("${ROOT}${sprite.file}")`;
    style.backgroundSize = `${px(sw * scale)} ${px(sh * scale)}`;
    style.backgroundPositionY = px(-sprite.row * fh * scale);
    style.setProperty('--x0', px(-sprite.col * fw * scale));
    style.setProperty('--x1', px(-(sprite.col + sprite.frames) * fw * scale));
    style.backgroundPositionX = 'var(--x0)';
    // En rejillas (reparto, tarjetas, hoja de ruta) se recorta el margen transparente del marco.
    const trim = Number(
      node.dataset['trim'] ??
        (node.closest('.cast, .roadmap, .card-art, .concepts, .stage-icon') ? 0.3 : 0),
    );
    if (trim > 0) style.margin = `${px(-fh * scale * trim)} ${px(-fw * scale * trim)}`;
    if (sprite.frames > 1) {
      const seconds = sprite.frames / sprite.fps;
      const loops = node.dataset['once'] !== undefined ? '1 forwards' : 'infinite';
      style.animation = `sprite-play ${String(seconds)}s steps(${String(sprite.frames)}) ${loops}`;
    }
  }
}

/** Iconos de mejora (los únicos PNG generados con IA, ADR-0030): `[data-icon="armor"]` → <img>. */
export function mountIcons(root: ParentNode = document): void {
  for (const node of root.querySelectorAll<HTMLElement>('[data-icon]')) {
    const image = new Image();
    image.src = `${import.meta.env.BASE_URL}assets/icons/${node.dataset['icon'] ?? ''}.png`;
    image.alt = '';
    node.append(image);
  }
}

function loadImage(file: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error(`No se pudo cargar ${file}`));
    };
    image.src = `${ROOT}${file}`;
  });
}

const W = 1280;
const H = 720;
const TILE = 64;
const TILEMAP = 'Terrain/Ground/Tilemap_Flat.png';
const WATER = 'Terrain/Water/Water.png';
const TREE = 'Resources/Trees/Tree.png';
const CASTLE = 'Factions/Knights/Buildings/Castle/Castle_Blue.png';

interface Art {
  readonly tiles: HTMLImageElement;
  readonly water: HTMLImageElement;
  readonly tree: HTMLImageElement;
  readonly castle: HTMLImageElement;
}

/** Celda (col, fila) del bloque de hierba 3×3 de Tilemap_Flat, escalada a `size`. */
function grass(
  ctx: CanvasRenderingContext2D,
  art: Art,
  col: number,
  row: number,
  x: number,
  y: number,
  size: number,
): void {
  ctx.drawImage(art.tiles, col * TILE, row * TILE, TILE, TILE, x, y, size, size);
}

/** Franja de hierba de `rows` filas con borde superior, de x0 a x1, apoyada en `bottom`. */
function grassBand(
  ctx: CanvasRenderingContext2D,
  art: Art,
  x0: number,
  x1: number,
  top: number,
  rows: number,
  size: number,
  edges: boolean,
): void {
  const cols = Math.ceil((x1 - x0) / size);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const edgeCol = !edges ? 1 : c === 0 ? 0 : c === cols - 1 ? 2 : 1;
      const edgeRow = r === 0 ? 0 : r === rows - 1 && edges ? 2 : 1;
      grass(ctx, art, edgeCol, edgeRow, x0 + c * size, top + r * size, size);
    }
  }
}

function tree(
  ctx: CanvasRenderingContext2D,
  art: Art,
  frame: number,
  x: number,
  y: number,
  size: number,
): void {
  const col = frame % 4;
  const row = Math.floor(frame / 4);
  ctx.drawImage(art.tree, col * 192, row * 192, 192, 192, x, y, size, size);
}

function base(ctx: CanvasRenderingContext2D): void {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#173238');
  sky.addColorStop(1, '#0f2227');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
}

/** Fondo de contenido: franja de hierba abajo y un par de árboles en las esquinas. */
function contentBackdrop(art: Art): string {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = false;
  base(ctx);
  const size = 32;
  grassBand(ctx, art, -size, W + size, H - size * 1.5, 3, size, false);
  tree(ctx, art, 0, -28, H - 150, 130);
  tree(ctx, art, 4, 40, H - 118, 100);
  tree(ctx, art, 1, W - 112, H - 150, 130);
  return canvas.toDataURL('image/png');
}

/** Fondo de escena (portada, demo, cierre): isla de hierba sobre agua con el castillo. */
function sceneBackdrop(art: Art): string {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = false;
  base(ctx);
  const size = 48;
  // Isla de 4 filas (y 456..648) sobre agua que asoma por abajo y por los lados.
  const islandTop = H - size * 5.5;
  for (let y = islandTop + size; y < H; y += size) {
    for (let x = 0; x < W; x += size) ctx.drawImage(art.water, x, y, size, size);
  }
  grassBand(ctx, art, size * 2, W - size * 2, islandTop, 4, size, true);
  ctx.drawImage(art.castle, W - 400, islandTop - 190, 280, 224);
  const trees: readonly [number, number, number, number][] = [
    [0, size * 1.4, islandTop - 120, 170],
    [4, size * 3.6, islandTop - 90, 140],
    [2, W - 170, islandTop - 100, 150],
    [5, W - 455, islandTop - 70, 120],
  ];
  for (const [frame, x, y, s] of trees) tree(ctx, art, frame, x, y, s);
  return canvas.toDataURL('image/png');
}

/** Pinta los fondos y los asigna a cada slide (`section.scene` lleva el de escena). */
export async function paintBackdrops(): Promise<void> {
  const [tiles, water, treeImage, castle] = await Promise.all([
    loadImage(TILEMAP),
    loadImage(WATER),
    loadImage(TREE),
    loadImage(CASTLE),
  ]);
  const art: Art = { tiles, water, tree: treeImage, castle };
  const content = contentBackdrop(art);
  const scene = sceneBackdrop(art);
  for (const section of document.querySelectorAll<HTMLElement>('.reveal .slides > section')) {
    section.dataset['backgroundImage'] = section.classList.contains('scene') ? scene : content;
    section.dataset['backgroundSize'] = 'cover';
  }
}
