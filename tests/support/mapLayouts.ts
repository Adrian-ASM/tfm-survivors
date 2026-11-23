import { Arena } from '../../src/domain/arena/Arena';
import type { CellType } from '../../src/domain/map/CellType';
import { GameMap } from '../../src/domain/map/GameMap';
import { MapRules, type MapConfig } from '../../src/domain/map/MapRules';
import type { TerrainSource } from '../../src/domain/map/TerrainSource';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { DEFAULT_MAP, aDefaultConfig } from './builders';

/**
 * `MapRules` válidas o excepción (para preparar escenarios). Por defecto, el mapa, el mundo y el
 * radio del jugador del contenido por defecto.
 */
export function mapRules(
  config: MapConfig = DEFAULT_MAP,
  width = aDefaultConfig().arena.width,
  height = aDefaultConfig().arena.height,
  playerRadius = aDefaultConfig().player.radius,
): MapRules {
  const arena = Arena.create(width, height);
  if (!arena.ok) throw new Error(arena.error.message);
  const r = MapRules.create(config, arena.value, playerRadius);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/**
 * Mapa vacío con la salida del castillo del contenido `config` declarada ((1.950, 1.170) por defecto):
 * la referencia de las comparaciones "con y sin mapa" de 0016 (design §12.1 A3).
 */
export function emptyWithExit(config: RunConfig): TerrainSource {
  const rules = mapRules(config.map, config.arena.width, config.arena.height, config.player.radius);
  return { kind: 'open', start: { ...rules.castle.exit } };
}

/** Mapa vacío de la rejilla por defecto sobre una arena dada (escenarios sin mapa declarado). */
export function openMap(arena: Arena): GameMap {
  return GameMap.open(mapRules(DEFAULT_MAP, arena.width, arena.height));
}

/** Celdas `'c,r'` → tipo sobre hierba (p. ej. `{ '10,4': 'trunk' }`), en orden de filas. */
export type Layout = Readonly<Record<string, CellType>>;

/**
 * Celdas `castle` de un rectángulo de columnas `c0..c1` y filas `r0..r1` (por defecto, la huella
 * del contenido por defecto: columnas 30–34 y filas 15–18, x en [1.800, 2.100] e y en [900, 1.140]).
 */
export function castleBlock(c0 = 30, c1 = 34, r0 = 15, r1 = 18): Layout {
  const layout: Record<string, CellType> = {};
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) layout[`${String(c)},${String(r)}`] = 'castle';
  return layout;
}

/** Lista de tipos de la rejilla de `rules`: hierba salvo las celdas de `layout`. */
export function cellsWith(rules: MapRules, layout: Layout): CellType[] {
  const cells: CellType[] = Array.from({ length: rules.cols * rules.rows }, () => 'grass');
  for (const [key, type] of Object.entries(layout)) {
    const [c, r] = key.split(',').map(Number);
    if (c === undefined || r === undefined) throw new Error(`celda mal escrita: ${key}`);
    cells[r * rules.cols + c] = type;
  }
  return cells;
}

/** Mapa explícito: hierba salvo las celdas de `layout`. */
export function mapWith(rules: MapRules, layout: Layout): GameMap {
  const r = GameMap.fromCells(cellsWith(rules, layout), rules);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}
