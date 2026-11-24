import type { CellType } from '../../../domain/map/CellType';
import type { MapSnapshot } from '../../../domain/map/MapSnapshot';
import type { MapLooks } from './mapLooks';
import { bridgeOrientation, riverSides, shoreCells, type RiverSides } from './shoreTiles';
import { bestRuns, shoreTileCells, waterTileCells, type KeyedCell, type TileRun } from './tileRuns';
import { treeModels } from './treeChoices';

// Plan del pintado del mapa (design 0016 §5.2 y §12.2): convierte el snapshot del mapa y los
// aspectos resueltos en la lista de objetos de cada capa, en orden de pintado. Puro: sin motor.
// Capa baja: agua, espuma, orillas, puentes, troncos y fachada. Capa alta: copas y tejado.

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
}

/** Sprite del mapa: frame (índice o marco con nombre), posición de su origen, volteo y recorte. */
export interface SpriteDraw {
  readonly kind: 'sprite';
  readonly role: 'foam' | 'bridge' | 'trunk' | 'canopy' | 'castle' | 'roof';
  readonly texture: string;
  readonly frame: number | string;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly origin: { readonly x: number; readonly y: number };
  readonly flipX: boolean;
  readonly crop: Crop | null;
}

/** Rectángulo de reserva en px de mundo. */
export interface RectDraw {
  readonly kind: 'rect';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color: number;
}

export type LowDraw = TileDraw | SpriteDraw | RectDraw;

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
    return { kind: 'rect', x, y, width, height, color };
  }

  tiles(run: TileRun, texture: string, frame: number, scale: number): TileDraw {
    const x = run.col * this.s;
    const y = run.row * this.s;
    return {
      kind: 'tiles',
      texture,
      frame,
      x,
      y,
      width: this.right(run.col + run.cols - 1) - x,
      height: this.bottom(run.row + run.rows - 1) - y,
      scale,
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
  return shoreCells(g.map).map(({ col, row }) => ({
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
  }));
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
  const { texture, aspect, frames } = looks.bridges;
  const out: SpriteDraw[] = [];
  g.map.cells.forEach((t, i) => {
    if (t !== 'bridge') return;
    const col = i % g.map.cols;
    const row = (i - col) / g.map.cols;
    out.push({
      kind: 'sprite',
      role: 'bridge',
      texture,
      frame: frames[bridgeOrientation(g.map, col, row)],
      x: g.centerX(col),
      y: g.centerY(row),
      scale: aspect.scale,
      origin: aspect.origin,
      flipX: false,
      crop: null,
    });
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
    trunks.push({ ...base, role: 'trunk', crop: { x: 0, y: cut, width: w, height: h - cut } });
    canopies.push({ ...base, role: 'canopy', crop: { x: 0, y: 0, width: w, height: cut } });
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
    facade: [{ ...base, role: 'castle', crop: { x: 0, y: cut, width: w, height: h - cut } }],
    roof: [{ ...base, role: 'roof', crop: { x: 0, y: 0, width: w, height: cut } }],
  };
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
  const low: LowDraw[] = [
    ...waterDraws(g, looks),
    ...foamDraws(g, looks),
    ...shoreDraws(g, looks),
    ...bridgeDraws(g, looks),
    ...trunks,
    ...facade,
  ];
  const high = [...canopies, ...roof];
  const foam = looks.foam.art && shoreCells(map).length > 0 ? looks.foam.aspect.idle : null;
  const { trunk, water, bridge, castle } = map.counts;
  return {
    low,
    high,
    foam,
    counts: countsOf(map, looks),
    cells: { trunk, water, bridge, castle },
    objects: low.length + high.length,
  };
}
