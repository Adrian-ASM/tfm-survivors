import type { MapSnapshot } from '../../../domain/map/MapSnapshot';
import type { MapAppearance } from '../../content/appearanceSchema';
import { deriveSeed } from '../../random/deriveSeed';

// Variedad de árboles (spec sprite-rendering 0016, design §12.2 B8): un hash por celda de la semilla
// de decoración de la partida (`deriveSeed(semilla, DECOR_STREAM)`). Sin PRNG ni orden de recorrido:
// no consume el azar de la partida ni el del mapa y no depende de frames ni de partidas anteriores.

/** Modelo de un árbol: frame de la hoja y si va volteado. */
export interface TreeModel {
  readonly frame: number;
  readonly flipX: boolean;
}

/** Bit alto del hash: decide el volteo sin correlacionar con el modelo (bits bajos). */
const FLIP_BIT = 31;

/** Modelo de la celda `cellIndex` (orden de filas) con la semilla de decoración dada. */
export function treeModel(
  decorSeed: number,
  cellIndex: number,
  models: readonly { readonly frame: number }[],
  flip: boolean,
): TreeModel {
  const h = deriveSeed(decorSeed, cellIndex);
  const model = models[h % models.length] ?? models[0];
  return { frame: model?.frame ?? 0, flipX: flip && h >>> FLIP_BIT === 1 };
}

/** Modelos de las celdas `trunk` del mapa, en orden de filas, con el índice de cada celda. */
export function treeModels(
  map: MapSnapshot,
  decorSeed: number,
  trees: Pick<MapAppearance['trees'], 'models' | 'flip'>,
): (TreeModel & { readonly index: number })[] {
  const out: (TreeModel & { readonly index: number })[] = [];
  map.cells.forEach((t, i) => {
    if (t === 'trunk') out.push({ index: i, ...treeModel(decorSeed, i, trees.models, trees.flip) });
  });
  return out;
}
