import type { MapSnapshot } from '../../../domain/map/MapSnapshot';
import type { MapAppearance } from '../../content/appearanceSchema';
import { deriveSeed } from '../../random/deriveSeed';

// Variedad de árboles (spec sprite-rendering 0016 y 0029, design §12.2 B8): un hash por celda de la
// semilla de decoración de la partida (`deriveSeed(semilla, DECOR_STREAM)`). Sin PRNG ni orden de
// recorrido: no consume el azar de la partida ni el del mapa y no depende de frames ni de partidas
// anteriores. Desde 0029 el hash da la **fase** de la animación `idle` (los mismos bits bajos que
// elegían el modelo fijo) y el volteo (bit alto, igual que antes).

/** Aspecto de un árbol: fase de su `idle` en [0, n − 1] y si va volteado. */
export interface TreeLook {
  readonly phase: number;
  readonly flipX: boolean;
}

/** Bit alto del hash: decide el volteo sin correlacionar con la fase (bits bajos). */
const FLIP_BIT = 31;

/** Fase y volteo de la celda `cellIndex` (orden de filas) con la semilla de decoración dada. */
export function treeLook(
  decorSeed: number,
  cellIndex: number,
  frames: number,
  flip: boolean,
): TreeLook {
  const h = deriveSeed(decorSeed, cellIndex);
  return { phase: frames > 0 ? h % frames : 0, flipX: flip && h >>> FLIP_BIT === 1 };
}

/** Fases y volteos de las celdas `trunk` del mapa, en orden de filas, con el índice de cada celda. */
export function treeLooks(
  map: MapSnapshot,
  decorSeed: number,
  trees: { readonly idle: Pick<MapAppearance['trees']['idle'], 'frames'>; readonly flip: boolean },
): (TreeLook & { readonly index: number })[] {
  const out: (TreeLook & { readonly index: number })[] = [];
  const n = trees.idle.frames.length;
  map.cells.forEach((t, i) => {
    if (t === 'trunk') out.push({ index: i, ...treeLook(decorSeed, i, n, trees.flip) });
  });
  return out;
}
