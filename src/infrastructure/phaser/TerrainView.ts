import type {
  DecorCount,
  ElementCount,
  MapArtCounts,
  MapArtPlan,
  MapCellCounts,
  CircleDraw,
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
  /** Círculo de reserva de una veta en la capa baja (0022). */
  circle(c: CircleDraw): void;
  /** Pone el frame dado a todas las espumas pintadas, ocultas incluidas (animación de render). */
  foam(frame: number): void;
  /**
   * Muestra u oculta el objeto `index` del mapa pintado, en el orden de llamada de `tiles`, `sprite` y
   * `rect` (y `circle`, 0022) desde el último `clear` (recorte por cámara, 0018).
   */
  show(index: number, visible: boolean): void;
}

/** Celdas pintadas por tipo (sonda `sprites.cells`), mutable para las capas. */
export type CellCounts = { -readonly [K in keyof MapCellCounts]: number };

/** Elementos del mapa pintados (sonda `sprites.mapArt`), mutable para las capas. */
export type MapArtProbe = {
  -readonly [K in Exclude<keyof MapArtCounts, 'decor'>]: ElementCount;
} & {
  /** Decoración (0029): del plan, pintadas y sin pintar por fallo de su hoja; 0 en el menú. */
  decor: { -readonly [K in keyof DecorCount]: number };
  objects: number;
  /** Objetos del mapa visibles tras el último recorte por cámara (0018); 0 en el menú. */
  drawn: number;
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
  decor: { planned: 0, painted: 0, unpainted: 0 },
  objects: 0,
  drawn: 0,
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
    else if (d.kind === 'circle') canvas.circle(d);
    else canvas.rect(d);
  }
  for (const s of plan.high) canvas.sprite('high', s);
  return { cells: plan.cells, mapArt: { ...plan.counts, objects: plan.objects } };
}
