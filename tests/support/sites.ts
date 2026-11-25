import type { CellType } from '../../src/domain/map/CellType';
import type { EnemyTypeConfig } from '../../src/domain/enemy/EnemyType';
import type {
  DeclaredSheep,
  DeclaredSite,
  DeclaredStructure,
  TerrainSource,
} from '../../src/domain/map/TerrainSource';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';
import type { BuildingsConfig } from '../../src/domain/site/BuildingRules';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { SITE_STREAM, deriveSeed } from '../../src/infrastructure/random/deriveSeed';
import { withBuildings } from './builders';
import { aBehaviorConfig, aProbeType } from './runs';

// Escenarios de los solares de obra (spec build-sites 0026 y 0027). El solar de prueba es un único
// solar declarado en el mapa vacío, con huella 2 × 2 (casa = torre) anclada en la celda (20, 10):
// x en [1.200, 1.320] e y en [600, 720]. Sin acceso: se abre al tocar la huella (g ≤ ε) y se re-arma a
// g ≥ X (64 con el contenido por defecto, design 0027 §1.4).

/** Celda ancla (primera columna y fila) de la huella del solar de prueba. */
export const TEST_SITE = { col: 20, row: 10 } as const;

/** Columnas y filas de la huella de casa y de torre del contenido por defecto (design 0026 §1). */
export const FOOTPRINT = { cols: 2, rows: 2 } as const;

/** Rectángulo de mundo de la huella del solar de prueba (celdas de 60 px). */
export const TEST_SITE_RECT = { left: 1200, top: 600, right: 1320, bottom: 720 } as const;

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
  options: {
    cells?: readonly CellType[];
    door?: { x: number; y: number };
    structures?: readonly DeclaredStructure[];
  } = {},
): TerrainSource {
  const extra = {
    ...(options.door ? { door: options.door } : {}),
    ...(options.structures ? { structures: options.structures } : {}),
  };
  return options.cells
    ? { kind: 'cells', cells: options.cells, sites, ...extra }
    : { kind: 'open', sites, ...extra };
}

/** Radio del jugador del contenido por defecto (el de los escenarios del solar de prueba). */
export const PLAYER_RADIUS = 16;

/** Cara de una huella. */
export type Side = 'top' | 'bottom' | 'left' | 'right';

/** Rectángulo de mundo de una huella. */
interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * Centro del jugador (radio `r`) a separación `g` de la cara `side` de la huella, en el punto
 * medio de esa cara (g = 0: tangente, toca). Por defecto, el solar de prueba.
 */
export function touchPoint(
  side: Side,
  g = 0,
  rect: Rect = TEST_SITE_RECT,
  r = PLAYER_RADIUS,
): { x: number; y: number } {
  const cx = (rect.left + rect.right) / 2;
  const cy = (rect.top + rect.bottom) / 2;
  switch (side) {
    case 'top':
      return { x: cx, y: rect.top - r - g };
    case 'bottom':
      return { x: cx, y: rect.bottom + r + g };
    case 'left':
      return { x: rect.left - r - g, y: cy };
    case 'right':
      return { x: rect.right + r + g, y: cy };
  }
}

/** Jugador tangente a la cara inferior del solar de prueba (1.260, 736): toca en el tick 1. */
export const TOUCH = touchPoint('bottom');

/** El contenido dado con otra separación de re-armado X (la del contenido por defecto es 64). */
export const withRearm = (config: RunConfig, rearmDistance: number): RunConfig =>
  withBuildings(config, { ...config.buildings, contact: { rearmDistance } });

/** El contenido dado con los costes de escenario de la casa y de la torre. */
export const withCosts = (
  config: RunConfig,
  house: BuildingsConfig['house']['cost'],
  tower: BuildingsConfig['tower']['cost'],
): RunConfig =>
  withBuildings(config, {
    ...config.buildings,
    house: { ...config.buildings.house, cost: house },
    tower: { ...config.buildings.tower, cost: tower },
  });

/** El contenido dado con otro ingreso de la casa (oro por pago y periodo). */
export const withIncome = (
  config: RunConfig,
  income: Partial<BuildingsConfig['house']['income']>,
): RunConfig =>
  withBuildings(config, {
    ...config.buildings,
    house: { ...config.buildings.house, income: { ...config.buildings.house.income, ...income } },
  });

/**
 * Contenido de los escenarios del solar de prueba: el mundo por defecto, sin armas ni oleadas, el
 * jugador a 60 px/s (1 px por tick) y la separación de re-armado del contenido (64).
 */
export const aSiteConfig = (
  o: Parameters<typeof aBehaviorConfig>[1] = {},
  types: readonly EnemyTypeConfig[] = [aProbeType()],
): RunConfig => aBehaviorConfig(types, { ...o, player: { speed: 60, ...o.player } });

/** Madera, piedra y oro iniciales de un `RunSetup`. */
export const withStock = (wood: number, stone = 0, gold = 0): RunSetup => ({
  resources: { gold, wood, stone },
});

/**
 * Partida en el mapa vacío con estos solares declarados (por defecto, el de prueba) y el jugador en
 * `TOUCH` (tangente a la cara inferior del solar de prueba) salvo que `setup` diga otra cosa.
 */
export function startWithSites(
  config: RunConfig,
  setup: RunSetup = {},
  sites: readonly DeclaredSite[] = [TEST_SITE],
  options: Parameters<typeof declaredSites>[1] & {
    random?: RandomGenerator;
    stoneRandom?: RandomGenerator;
    sheep?: DeclaredSheep;
  } = {},
): Run {
  const base = declaredSites(sites, options);
  const terrain: TerrainSource =
    options.sheep && base.kind !== 'generated' ? { ...base, sheep: options.sheep } : base;
  const r = Run.start(
    config,
    options.random ?? new Mulberry32RandomGenerator(42),
    { player: TOUCH, ...setup },
    terrain,
    options.stoneRandom,
  );
  if (!r.ok) throw new Error(`${r.error.field}: ${r.error.message}`);
  return r.value;
}

/** Ejecuta ticks hasta que la partida está en obra (como mucho `limit`); devuelve el tick. */
export function untilBuilding(run: Run, limit = 1000, input = PlayerInput.NONE): number {
  for (let i = 0; i < limit && run.status === 'running'; i++) run.tick(input);
  if (run.status !== 'building') throw new Error(`sin obra (estado ${run.status})`);
  return run.snapshot().tick;
}

/** Política de obra fija (spec simulation-loop 0026): si la obra está abierta, salir sin construir. */
export function leaveSiteIfOpen(run: Run): boolean {
  if (run.status !== 'building') return false;
  const r = run.leaveSite();
  if (!r.ok) throw new Error(`salida rechazada: ${r.error.code}`);
  return true;
}

/** Construye `kind` en la obra abierta; falla si se rechaza. */
export function buildNow(run: Run, kind: string): RunSnapshot {
  const r = run.build(kind);
  if (!r.ok) throw new Error(`obra rechazada (${kind}): ${r.error.code}`);
  return run.snapshot();
}

/** Separación g del jugador del snapshot al solar de prueba (NaN sin snapshot). */
export const gapOf = (s: RunSnapshot | undefined, rect: Rect = TEST_SITE_RECT): number => {
  if (!s) return Number.NaN;
  const { x, y, radius } = s.player;
  const ex = Math.max(rect.left - x, 0, x - rect.right);
  const ey = Math.max(rect.top - y, 0, y - rect.bottom);
  return Math.hypot(ex, ey) - radius;
};
