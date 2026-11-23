import type {
  ElementCount,
  MapArtCounts,
  MapArtPlan,
  MapCellCounts,
  RectDraw,
  SpriteDraw,
  TileDraw,
} from './map/planMapArt';

/**
 * Costura sin motor del pintado del mapa con arte (change 0016, design §5.4): dos capas, la baja
 * bajo las entidades y la alta sobre ellas y bajo el HUD. Pools reutilizados entre partidas. Sustituye
 * a la costura de rectángulos de 0015 (`TerrainCanvas`); la reserva va ahora en el plan.
 */
export interface MapArtCanvas {
  /** Oculta todo lo del mapa anterior (R, partida nueva). */
  clear(): void;
  /** Tramo de baldosas en la capa baja. */
  tiles(t: TileDraw): void;
  sprite(layer: 'low' | 'high', s: SpriteDraw): void;
  /** Rectángulo de reserva en la capa baja. */
  rect(r: RectDraw): void;
  /** Pone el frame dado a todas las espumas visibles (animación en tiempo de render). */
  foam(frame: number): void;
}

/** Celdas pintadas por tipo (sonda `sprites.cells`), mutable para las capas. */
export type CellCounts = { -readonly [K in keyof MapCellCounts]: number };

/** Elementos del mapa pintados (sonda `sprites.mapArt`), mutable para las capas. */
export type MapArtProbe = { -readonly [K in keyof MapArtCounts]: ElementCount } & {
  objects: number;
};

export const zeroCells = (): CellCounts => ({ trunk: 0, water: 0, bridge: 0, castle: 0 });

const none = (): ElementCount => ({ painted: 0, fallback: 0 });

export const zeroMapArt = (): MapArtProbe => ({
  water: none(),
  shore: none(),
  foam: none(),
  tree: none(),
  canopy: none(),
  bridge: none(),
  castle: none(),
  objects: 0,
});

/** Recuentos del mapa pintado para la sonda de render (`sprites.cells` y `sprites.mapArt`). */
export interface PaintedMap {
  readonly cells: MapCellCounts;
  readonly mapArt: MapArtCounts & { readonly objects: number };
}

/** Pinta el plan del mapa de una partida (borra antes el anterior); un objeto por entrada. */
export function paintMapArt(canvas: MapArtCanvas, plan: MapArtPlan): PaintedMap {
  canvas.clear();
  for (const d of plan.low) {
    if (d.kind === 'tiles') canvas.tiles(d);
    else if (d.kind === 'sprite') canvas.sprite('low', d);
    else canvas.rect(d);
  }
  for (const s of plan.high) canvas.sprite('high', s);
  return { cells: plan.cells, mapArt: { ...plan.counts, objects: plan.objects } };
}
