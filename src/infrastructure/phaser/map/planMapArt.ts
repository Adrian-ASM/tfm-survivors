import type { CellType } from '../../../domain/map/CellType';
import type { MapSnapshot, MapStructure, MapVein } from '../../../domain/map/MapSnapshot';
import type { MapLooks, StructureLook } from './mapLooks';
import { bridgeOrientation, riverSides, shoreCells, type RiverSides } from './shoreTiles';
import { bestRuns, shoreTileCells, waterTileCells, type KeyedCell, type TileRun } from './tileRuns';
import { treeModels } from './treeChoices';

// Plan del pintado del mapa (design 0016 §5.2 y §12.2): convierte el snapshot del mapa y los
// aspectos resueltos en la lista de objetos de cada capa, en orden de pintado. Puro: sin motor.
// Capa baja: agua, espuma, orillas, puentes, troncos, fachada y parte baja de las estructuras.
// Capa alta: copas, tejado y parte alta de las estructuras (0021).

/** Caja en px de mundo de lo que pinta un objeto del mapa (0018, design §3; error ≤ 1 px). */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Recorte en px del frame (relativo a él), como `setCrop`. */
export interface Crop {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Tramo de baldosas (`TileSprite`) en px de mundo, con origen (0, 0). */
export interface TileDraw {
  readonly kind: 'tiles';
  readonly texture: string;
  readonly frame: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  /** Su propio rectángulo (0018). */
  readonly bounds: Box;
}

/** Sprite del mapa: frame (índice o marco con nombre), posición de su origen, volteo y recorte. */
export interface SpriteDraw {
  readonly kind: 'sprite';
  readonly role:
    | 'foam'
    | 'bridge'
    | 'trunk'
    | 'canopy'
    | 'castle'
    | 'roof'
    | 'structure'
    | 'structure-top'
    | 'vein';
  readonly texture: string;
  readonly frame: number | string;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly origin: { readonly x: number; readonly y: number };
  readonly flipX: boolean;
  readonly crop: Crop | null;
  /** Caja del recorte dibujado (0018, design §3). */
  readonly bounds: Box;
}

/**
 * Redondeo a 1/1024 px (exacto en binario): quita el ruido de coma flotante del origen y la escala
 * (p. ej. una copa de la fila 0 que acaba en y = −1e-14 en vez de 0) sin pasar del error de 1 px.
 */
const BOX_GRID = 1024;
const snap = (v: number): number => Math.round(v * BOX_GRID) / BOX_GRID + 0;

/** Lo que fija la caja de un sprite: posición del origen, escala, volteo y recorte. */
export type SpritePlacement = Pick<SpriteDraw, 'x' | 'y' | 'scale' | 'origin' | 'flipX' | 'crop'>;

/**
 * Caja en mundo de un sprite con frame de `fw × fh` (design §3). Con `flipX`, la unión del recorte y
 * de su espejo `fw − c.x − c.width` (conservador: el motor refleja el recorte).
 */
export function spriteBounds(s: SpritePlacement, fw: number, fh: number): Box {
  const c = s.crop ?? { x: 0, y: 0, width: fw, height: fh };
  const x0 = s.flipX ? Math.min(c.x, fw - c.x - c.width) : c.x;
  const x1 = s.flipX ? Math.max(c.x + c.width, fw - c.x) : c.x + c.width;
  const left = snap(s.x + (x0 - s.origin.x * fw) * s.scale);
  const top = snap(s.y + (c.y - s.origin.y * fh) * s.scale);
  const right = snap(s.x + (x1 - s.origin.x * fw) * s.scale);
  const bottom = snap(s.y + (c.y + c.height - s.origin.y * fh) * s.scale);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Sprite del plan con su caja calculada. */
function placed(
  draw: Omit<SpriteDraw, 'bounds'>,
  frame: { readonly width: number; readonly height: number },
): SpriteDraw {
  return { ...draw, bounds: spriteBounds(draw, frame.width, frame.height) };
}

/** Tamaño del frame de una hoja regular. */
const frameOf = (sheet: { readonly frameWidth: number; readonly frameHeight: number }) => ({
  width: sheet.frameWidth,
  height: sheet.frameHeight,
});

/** Rectángulo de reserva en px de mundo. */
export interface RectDraw {
  readonly kind: 'rect';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color: number;
  /** Su propio rectángulo (0018). */
  readonly bounds: Box;
}

/** Círculo de reserva de una veta (0022): centrado en su posición, de su radio de contacto. */
export interface CircleDraw {
  readonly kind: 'circle';
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly color: number;
  /** Su cuadrado envolvente (recorte por cámara, 0018). */
  readonly bounds: Box;
}

export type LowDraw = TileDraw | SpriteDraw | RectDraw | CircleDraw;

/** Elementos de un tipo pintados y cuántos de ellos con reserva (sonda `sprites.mapArt`, B9). */
export interface ElementCount {
  readonly painted: number;
  readonly fallback: number;
}

/** Recuentos por elemento del mapa (spec "Sonda de render para E2E", design §12.2 B9). */
export interface MapArtCounts {
  readonly water: ElementCount;
  readonly shore: ElementCount;
  readonly foam: ElementCount;
  readonly tree: ElementCount;
  readonly canopy: ElementCount;
  readonly bridge: ElementCount;
  readonly castle: ElementCount;
}

/** Celdas del mapa representadas por tipo, con arte o con reserva (`sprites.cells`). */
export interface MapCellCounts {
  readonly trunk: number;
  readonly water: number;
  readonly bridge: number;
  readonly castle: number;
}

export interface MapArtPlan {
  readonly low: readonly LowDraw[];
  readonly high: readonly SpriteDraw[];
  /** Animación de la espuma (frames y fps), o `null` si no hay espuma con arte. */
  readonly foam: { readonly frames: readonly number[]; readonly fps: number } | null;
  readonly counts: MapArtCounts;
  readonly cells: MapCellCounts;
  /** Objetos de escena del plan (uno por entrada de cada capa). */
  readonly objects: number;
  /** Lado de la celda en px (`map.cellSize`): de él sale el margen del recorte (0018). */
  readonly cellSize: number;
  /** Casas y torres del mapa (0021), en el orden del snapshot, con los índices de sus objetos. */
  readonly structures: readonly PlannedStructure[];
  /** Vetas del mapa (0022), en el orden del snapshot: `intact` = activa y `ruin` = agotada. */
  readonly veins: readonly PlannedStructure[];
}

export interface PlanContext {
  /** Semilla de decoración de la partida: `deriveSeed(semilla, DECOR_STREAM)`. */
  readonly decorSeed: number;
  readonly world: { readonly width: number; readonly height: number };
}

/**
 * Recorte de la espuma de una celda de orilla (design §12.2 B11): la celda (centrada en el frame)
 * más la extensión solo hacia sus lados de río, para no asomar sobre la hierba de alrededor.
 */
export function foamCrop(sides: RiverSides, frame: number, tile: number): Crop {
  const m = (frame - tile) / 2;
  const x0 = sides.W ? 0 : m;
  const x1 = sides.E ? frame : frame - m;
  const y0 = sides.N ? 0 : m;
  const y1 = sides.S ? frame : frame - m;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Geometría de mundo de las celdas del snapshot (recortada al mundo). */
class Grid {
  readonly s: number;

  constructor(
    readonly map: MapSnapshot,
    readonly world: PlanContext['world'],
  ) {
    this.s = map.cellSize;
  }

  right(col: number): number {
    return Math.min((col + 1) * this.s, this.world.width);
  }

  bottom(row: number): number {
    return Math.min((row + 1) * this.s, this.world.height);
  }

  centerX(col: number): number {
    return (col * this.s + this.right(col)) / 2;
  }

  centerY(row: number): number {
    return (row * this.s + this.bottom(row)) / 2;
  }

  /** Rectángulos de reserva de las celdas del tipo dado, agrupadas en tramos. */
  fallback(type: CellType, color: number): RectDraw[] {
    const cells: KeyedCell[] = [];
    this.map.cells.forEach((t, i) => {
      if (t !== type) return;
      const col = i % this.map.cols;
      cells.push({ col, row: (i - col) / this.map.cols, key: type });
    });
    return bestRuns(cells).map((run) => this.rect(run, color));
  }

  rect(run: Omit<TileRun, 'key'>, color: number): RectDraw {
    const x = run.col * this.s;
    const y = run.row * this.s;
    const width = this.right(run.col + run.cols - 1) - x;
    const height = this.bottom(run.row + run.rows - 1) - y;
    return { kind: 'rect', x, y, width, height, color, bounds: { x, y, width, height } };
  }

  tiles(run: TileRun, texture: string, frame: number, scale: number): TileDraw {
    const x = run.col * this.s;
    const y = run.row * this.s;
    const width = this.right(run.col + run.cols - 1) - x;
    const height = this.bottom(run.row + run.rows - 1) - y;
    return {
      kind: 'tiles',
      texture,
      frame,
      x,
      y,
      width,
      height,
      scale,
      bounds: { x, y, width, height },
    };
  }
}

function waterDraws(g: Grid, looks: MapLooks): LowDraw[] {
  if (!looks.water.art) return g.fallback('water', looks.colors.water);
  const { texture, aspect } = looks.water;
  const cells = waterTileCells(g.map, looks.shore.art);
  return bestRuns(cells).map((run) => g.tiles(run, texture, aspect.frame, aspect.scale));
}

function foamDraws(g: Grid, looks: MapLooks): SpriteDraw[] {
  if (!looks.foam.art) return [];
  const { texture, aspect } = looks.foam;
  const frame = aspect.idle.frames[0] ?? 0;
  const tile = g.s / aspect.scale;
  const size = frameOf(aspect.sheet);
  return shoreCells(g.map).map(({ col, row }) =>
    placed(
      {
        kind: 'sprite',
        role: 'foam',
        texture,
        frame,
        x: g.centerX(col),
        y: g.centerY(row),
        scale: aspect.scale,
        origin: aspect.origin,
        flipX: false,
        crop: foamCrop(riverSides(g.map, col, row), aspect.sheet.frameWidth, tile),
      },
      size,
    ),
  );
}

function shoreDraws(g: Grid, looks: MapLooks): TileDraw[] {
  if (!looks.shore.art) return [];
  const { texture, aspect } = looks.shore;
  return bestRuns(shoreTileCells(g.map)).map((run) =>
    g.tiles(run, texture, aspect.cases[run.key as keyof typeof aspect.cases], aspect.scale),
  );
}

function bridgeDraws(g: Grid, looks: MapLooks): LowDraw[] {
  if (!looks.bridges.art) return g.fallback('bridge', looks.colors.bridge);
  const { texture, aspect, frames, rects } = looks.bridges;
  const out: SpriteDraw[] = [];
  g.map.cells.forEach((t, i) => {
    if (t !== 'bridge') return;
    const col = i % g.map.cols;
    const row = (i - col) / g.map.cols;
    const orientation = bridgeOrientation(g.map, col, row);
    const draw = {
      kind: 'sprite',
      role: 'bridge',
      texture,
      frame: frames[orientation],
      x: g.centerX(col),
      y: g.centerY(row),
      scale: aspect.scale,
      origin: aspect.origin,
      flipX: false,
      crop: null,
    } as const;
    out.push(placed(draw, rects[orientation]));
  });
  return out;
}

/** Tronco (capa baja) y copa (capa alta) de cada celda `trunk`, partidos por el corte derivado. */
function treeDraws(g: Grid, looks: MapLooks, decorSeed: number) {
  const trunks: LowDraw[] = [];
  const canopies: SpriteDraw[] = [];
  if (!looks.trees.art) return { trunks: g.fallback('trunk', looks.colors.trunk), canopies };
  const { texture, aspect } = looks.trees;
  const { frameWidth: w, frameHeight: h } = aspect.sheet;
  const cut = aspect.origin.y * h - g.s / aspect.scale;
  for (const { index, frame, flipX } of treeModels(g.map, decorSeed, aspect)) {
    const col = index % g.map.cols;
    const row = (index - col) / g.map.cols;
    const base = {
      kind: 'sprite',
      texture,
      frame,
      x: g.centerX(col),
      y: g.bottom(row),
      scale: aspect.scale,
      origin: aspect.origin,
      flipX,
    } as const;
    const size = frameOf(aspect.sheet);
    const trunkCrop = { x: 0, y: cut, width: w, height: h - cut };
    trunks.push(placed({ ...base, role: 'trunk', crop: trunkCrop }, size));
    canopies.push(
      placed({ ...base, role: 'canopy', crop: { x: 0, y: 0, width: w, height: cut } }, size),
    );
  }
  return { trunks, canopies };
}

/**
 * Fachada (capa baja) y tejado (capa alta) del castillo de la huella. Sin arte, 1 rectángulo sobre la
 * huella; sin huella (mapa explícito), sus celdas `castle` sueltas siempre como rectángulos.
 */
function castleDraws(g: Grid, looks: MapLooks): { facade: LowDraw[]; roof: SpriteDraw[] } {
  const footprint = g.map.castle;
  const color = looks.colors.castle;
  if (!footprint) return { facade: g.fallback('castle', color), roof: [] };
  if (!looks.castle.art) {
    const { firstCol: col, firstRow: row } = footprint;
    const cols = footprint.lastCol - col + 1;
    const rows = footprint.lastRow - row + 1;
    return { facade: [g.rect({ col, row, cols, rows }, color)], roof: [] };
  }
  const { texture, aspect } = looks.castle;
  const { frameWidth: w, frameHeight: h } = aspect.sheet;
  const cut = aspect.origin.y * h - g.s / aspect.scale;
  const size = frameOf(aspect.sheet);
  const base = {
    kind: 'sprite',
    texture,
    frame: aspect.frame,
    x: (footprint.firstCol * g.s + g.right(footprint.lastCol)) / 2,
    y: g.bottom(footprint.lastRow),
    scale: aspect.scale,
    origin: aspect.origin,
    flipX: false,
  } as const;
  return {
    facade: [
      placed({ ...base, role: 'castle', crop: { x: 0, y: cut, width: w, height: h - cut } }, size),
    ],
    roof: [placed({ ...base, role: 'roof', crop: { x: 0, y: 0, width: w, height: cut } }, size)],
  };
}

/** Piezas de un aspecto de estructura en el plan, antes de numerarlas. */
interface AspectDraws {
  readonly low: LowDraw[];
  readonly high: SpriteDraw[];
  readonly fallback: boolean;
}

/**
 * Parte baja (bajo el borde superior de la fila inferior de la huella) y alta (el resto) de un
 * aspecto de estructura, con el origen en el punto medio del borde inferior de la huella (0021). Sin
 * arte, 1 rectángulo del color dado sobre la huella, sin parte alta.
 */
function structureAspect(
  g: Grid,
  s: MapStructure,
  look: StructureLook | undefined,
  color: number,
): AspectDraws {
  if (!look?.art) {
    const rect = g.rect({ col: s.col, row: s.row, cols: s.cols, rows: s.rows }, color);
    return { low: [rect], high: [], fallback: true };
  }
  const { texture, aspect } = look;
  const { frameWidth: w, frameHeight: h } = aspect.sheet;
  const cut = Math.min(Math.max(aspect.origin.y * h - g.s / aspect.scale, 0), h);
  const size = frameOf(aspect.sheet);
  const base = {
    kind: 'sprite',
    texture,
    frame: aspect.idle.frames[0] ?? 0,
    x: (s.col * g.s + g.right(s.col + s.cols - 1)) / 2,
    y: g.bottom(s.row + s.rows - 1),
    scale: aspect.scale,
    origin: aspect.origin,
    flipX: false,
  } as const;
  const low =
    h - cut > 0
      ? [
          placed(
            { ...base, role: 'structure', crop: { x: 0, y: cut, width: w, height: h - cut } },
            size,
          ),
        ]
      : [];
  const high =
    cut > 0
      ? [
          placed(
            { ...base, role: 'structure-top', crop: { x: 0, y: 0, width: w, height: cut } },
            size,
          ),
        ]
      : [];
  return { low, high, fallback: false };
}

/** Estructura en el plan (0021): índices de sus objetos por aspecto, en `[...low, ...high]`. */
export interface PlannedStructure {
  readonly id: number;
  readonly type: string;
  readonly intact: readonly number[];
  readonly ruin: readonly number[];
  /** ¿Se pinta cada aspecto con su rectángulo de reserva? */
  readonly fallback: { readonly intact: boolean; readonly ruin: boolean };
}

/** Piezas de todas las estructuras del mapa, con sus índices relativos a cada lista. */
function structureDraws(g: Grid, looks: MapLooks) {
  const low: LowDraw[] = [];
  const high: SpriteDraw[] = [];
  const parts: { s: MapStructure; low: number[][]; high: number[][]; fallback: boolean[] }[] = [];
  const { types, colors, ruinColor } = looks.structures;
  for (const s of g.map.structures) {
    const aspects = [
      structureAspect(g, s, types[s.type]?.intact, colors[s.type] ?? ruinColor),
      structureAspect(g, s, types[s.type]?.ruin, ruinColor),
    ];
    const entry = { s, low: [] as number[][], high: [] as number[][], fallback: [] as boolean[] };
    for (const a of aspects) {
      entry.low.push(a.low.map((d) => low.push(d) - 1));
      entry.high.push(a.high.map((d) => high.push(d) - 1));
      entry.fallback.push(a.fallback);
    }
    parts.push(entry);
  }
  /** Numeración final con las longitudes de las dos capas. */
  const number = (lowStart: number, highStart: number): PlannedStructure[] =>
    parts.map(({ s, low: l, high: h, fallback }) => {
      const at = (k: number) => [
        ...(l[k] ?? []).map((i) => lowStart + i),
        ...(h[k] ?? []).map((i) => highStart + i),
      ];
      return {
        id: s.id,
        type: s.type,
        intact: at(0),
        ruin: at(1),
        fallback: { intact: fallback[0] ?? true, ruin: fallback[1] ?? true },
      };
    });
  return { low, high, number };
}

/**
 * Un aspecto de una veta (0022): 1 sprite con el origen de su aspecto en la posición de la veta o,
 * sin arte, 1 círculo del color de la veta de su radio de contacto.
 */
function veinAspect(v: MapVein, look: StructureLook, color: number): LowDraw {
  if (!look.art) {
    const r = v.radius;
    const bounds = { x: v.x - r, y: v.y - r, width: 2 * r, height: 2 * r };
    return { kind: 'circle', x: v.x, y: v.y, radius: r, color, bounds };
  }
  const { texture, aspect } = look;
  const draw = {
    kind: 'sprite',
    role: 'vein',
    texture,
    frame: aspect.idle.frames[0] ?? 0,
    x: v.x,
    y: v.y,
    scale: aspect.scale,
    origin: aspect.origin,
    flipX: false,
    crop: null,
  } as const;
  return placed(draw, frameOf(aspect.sheet));
}

/** Vetas del mapa en la capa baja (0022): activa y agotada por veta, numeradas desde `start`. */
function veinDraws(map: MapSnapshot, looks: MapLooks, start: number) {
  const low: LowDraw[] = [];
  const planned: PlannedStructure[] = [];
  const { active, depleted, color } = looks.veins;
  for (const v of map.veins) {
    const i = start + low.length;
    low.push(veinAspect(v, active, color), veinAspect(v, depleted, color));
    planned.push({
      id: v.id,
      type: 'vein',
      intact: [i],
      ruin: [i + 1],
      fallback: { intact: !active.art, ruin: !depleted.art },
    });
  }
  return { low, planned };
}

const count = (painted: number, fallback = 0): ElementCount => ({ painted, fallback });

/** Recuentos de la sonda: celdas por elemento, con arte o con reserva (B9). */
function countsOf(map: MapSnapshot, looks: MapLooks): MapArtCounts {
  const { water, trunk, bridge } = map.counts;
  const shores = shoreCells(map).length;
  const art = (on: boolean, n: number) => count(n, on ? 0 : n);
  const castle = map.castle ? 1 : 0;
  return {
    water: art(looks.water.art, water),
    shore: count(looks.shore.art ? shores : 0),
    foam: count(looks.foam.art ? shores : 0),
    tree: art(looks.trees.art, trunk),
    canopy: count(looks.trees.art ? trunk : 0),
    bridge: art(looks.bridges.art, bridge),
    castle: art(looks.castle.art, castle),
  };
}

/**
 * Plan de pintado del mapa: listas de la capa baja (agua, espuma, orillas, puentes, troncos y
 * fachada, en ese orden) y de la alta (copas y tejado).
 */
export function planMapArt(map: MapSnapshot, looks: MapLooks, ctx: PlanContext): MapArtPlan {
  const g = new Grid(map, ctx.world);
  const { trunks, canopies } = treeDraws(g, looks, ctx.decorSeed);
  const { facade, roof } = castleDraws(g, looks);
  const built = structureDraws(g, looks);
  const ground: LowDraw[] = [
    ...waterDraws(g, looks),
    ...foamDraws(g, looks),
    ...shoreDraws(g, looks),
    ...bridgeDraws(g, looks),
    ...trunks,
    ...facade,
  ];
  // 0021: las estructuras tras la fachada (capa baja) y tras el tejado (capa alta). 0022: las vetas,
  // tras las estructuras en la capa baja.
  const veins = veinDraws(map, looks, ground.length + built.low.length);
  const low = [...ground, ...built.low, ...veins.low];
  const above = [...canopies, ...roof];
  const high = [...above, ...built.high];
  const foam = looks.foam.art && shoreCells(map).length > 0 ? looks.foam.aspect.idle : null;
  const { trunk, water, bridge, castle } = map.counts;
  return {
    low,
    high,
    foam,
    counts: countsOf(map, looks),
    cells: { trunk, water, bridge, castle },
    objects: low.length + high.length,
    cellSize: map.cellSize,
    structures: built.number(ground.length, low.length + above.length),
    veins: veins.planned,
  };
}
