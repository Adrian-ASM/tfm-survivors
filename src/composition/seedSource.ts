import type { RunSeeding } from '../application/StartRun';
import { OPEN_TERRAIN } from '../domain/map/TerrainSource';
import { Mulberry32RandomGenerator } from '../infrastructure/random/Mulberry32RandomGenerator';
import {
  DECOR_STREAM,
  MAP_STREAM,
  RESOURCE_STREAM,
  SHEEP_STREAM,
  STRUCT_STREAM,
  deriveSeed,
} from '../infrastructure/random/deriveSeed';

/** Mapa de las partidas de una carga: el generado por la semilla o el vacío (`?e2e&map=empty`). */
export type MapMode = 'generated' | 'empty';

/** Modo de mapa de la carga a partir de lo resuelto en la URL (`resolveMapMode`). */
export const mapModeOf = (resolved: { readonly emptyForced: boolean }): MapMode =>
  resolved.emptyForced ? 'empty' : 'generated';

/**
 * Siembra de una partida (ADR-0013 y ADR-0020), única ruta de la composición: oleadas y ofertas con
 * `Mulberry32(seed)`, el mapa con su propio flujo, `Mulberry32(deriveSeed(seed, MAP_STREAM))`, y
 * sus casas y torres con otro, `Mulberry32(deriveSeed(seed, STRUCT_STREAM))`, y sus vetas y montones
 * con otro, `Mulberry32(deriveSeed(seed, RESOURCE_STREAM))` (ADR-0021), y sus ovejas con otro,
 * `Mulberry32(deriveSeed(seed, SHEEP_STREAM))` (ADR-0022); o el mapa vacío (sin estructuras,
 * recursos ni ovejas) si se fuerza.
 */
export function seededRun(seed: number, mode: MapMode = 'generated'): RunSeeding {
  const random = new Mulberry32RandomGenerator(seed);
  if (mode === 'empty') return { random, terrain: OPEN_TERRAIN };
  const mapRandom = new Mulberry32RandomGenerator(deriveSeed(seed, MAP_STREAM));
  const structureRandom = new Mulberry32RandomGenerator(deriveSeed(seed, STRUCT_STREAM));
  const resourceRandom = new Mulberry32RandomGenerator(deriveSeed(seed, RESOURCE_STREAM));
  const sheepRandom = new Mulberry32RandomGenerator(deriveSeed(seed, SHEEP_STREAM));
  return {
    random,
    terrain: { kind: 'generated', random: mapRandom, structureRandom, resourceRandom, sheepRandom },
  };
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
