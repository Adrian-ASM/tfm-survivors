import type { CellType } from '../../src/domain/map/CellType';
import type { DeclaredSite, TerrainSource } from '../../src/domain/map/TerrainSource';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { SITE_STREAM, deriveSeed } from '../../src/infrastructure/random/deriveSeed';

// Escenarios de los solares de obra (spec build-sites 0026). El solar de prueba es un único solar
// declarado en el mapa vacío, con huella 2 × 2 (casa = torre, design 0026 §1) anclada en la celda
// (20, 10): x en [1.200, 1.320] e y en [600, 720]. Su acceso está en el centro de la fila r + 3,
// (1.260, 810).

/** Celda ancla (primera columna y fila) de la huella del solar de prueba. */
export const TEST_SITE = { col: 20, row: 10 } as const;

/** Columnas y filas de la huella de casa y de torre del contenido por defecto (design 0026 §1). */
export const FOOTPRINT = { cols: 2, rows: 2 } as const;

/** Rectángulo de mundo de la huella del solar de prueba (celdas de 60 px). */
export const TEST_SITE_RECT = { left: 1200, top: 600, right: 1320, bottom: 720 } as const;

/** Acceso del solar de prueba: centro de la huella en x y borde inferior + 1,5 celdas en y. */
export const TEST_ACCESS = { x: 1260, y: 810 } as const;

/** Celdas `[col, row]` de la huella del solar de prueba, en orden de filas. */
export const TEST_SITE_CELLS: readonly (readonly [number, number])[] = [
  [20, 10],
  [21, 10],
  [20, 11],
  [21, 11],
];

/** Firma de los solares: `site@col,row` en orden de id (la de `map.sites` del núcleo y de la sonda). */
export const siteSignatureOf = (map: {
  readonly sites: readonly { readonly col: number; readonly row: number }[];
}): string[] => map.sites.map((s) => `site@${String(s.col)},${String(s.row)}`);

/** Azar de los solares de la semilla, como en producción (`SITE_STREAM`, 0026). */
export const siteRandomFor = (seed: number): Mulberry32RandomGenerator =>
  new Mulberry32RandomGenerator(deriveSeed(seed, SITE_STREAM));

/**
 * Mapa vacío (o de celdas, con `cells`) con estos solares declarados, en orden (celda de
 * referencia = ancla de la huella; spec procedural-map, "Mapa explícito y mapa vacío").
 */
export function declaredSites(
  sites: readonly DeclaredSite[],
  options: { cells?: readonly CellType[]; door?: { x: number; y: number } } = {},
): TerrainSource {
  const door = options.door ? { door: options.door } : {};
  return options.cells
    ? { kind: 'cells', cells: options.cells, sites, ...door }
    : { kind: 'open', sites, ...door };
}
