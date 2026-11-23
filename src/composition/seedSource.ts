import type { RunSeeding } from '../application/StartRun';
import { OPEN_TERRAIN } from '../domain/map/TerrainSource';
import { Mulberry32RandomGenerator } from '../infrastructure/random/Mulberry32RandomGenerator';
import { DECOR_STREAM, MAP_STREAM, deriveSeed } from '../infrastructure/random/deriveSeed';

/** Mapa de las partidas de una carga: el generado por la semilla o el vacío (`?e2e&map=empty`). */
export type MapMode = 'generated' | 'empty';

/** Modo de mapa de la carga a partir de lo resuelto en la URL (`resolveMapMode`). */
export const mapModeOf = (resolved: { readonly emptyForced: boolean }): MapMode =>
  resolved.emptyForced ? 'empty' : 'generated';

/**
 * Siembra de una partida (ADR-0013), única ruta de la composición: oleadas y ofertas con
 * `Mulberry32(seed)` y el mapa con su propio flujo, `Mulberry32(deriveSeed(seed, MAP_STREAM))`, o
 * el mapa vacío si se fuerza.
 */
export function seededRun(seed: number, mode: MapMode = 'generated'): RunSeeding {
  const random = new Mulberry32RandomGenerator(seed);
  if (mode === 'empty') return { random, terrain: OPEN_TERRAIN };
  const mapRandom = new Mulberry32RandomGenerator(deriveSeed(seed, MAP_STREAM));
  return { random, terrain: { kind: 'generated', random: mapRandom } };
}

/**
 * Semilla de decoración de una partida (variedad de árboles, change 0016): su propio flujo de la
 * semilla de la partida, solo presentación (ADR-0013, addendum).
 */
export const decorSeedOf = (seed: number): number => deriveSeed(seed, DECOR_STREAM);

/**
 * Fábrica de siembras para `RestartRun` (spec simulation-loop, "Semilla de la partida"): cada
 * reinicio sortea una semilla nueva con `randomSeed`, sin leer la URL ni emitir avisos, la
 * comunica con `onSeed` (el probe de E2E) y siembra con `seededRun` en el modo de mapa de la carga.
 */
export function restartRandoms(
  randomSeed: () => number,
  onSeed: (seed: number) => void,
  mode: MapMode = 'generated',
): () => RunSeeding {
  return () => {
    const seed = randomSeed();
    onSeed(seed);
    return seededRun(seed, mode);
  };
}
