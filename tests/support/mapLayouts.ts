import { Arena } from '../../src/domain/arena/Arena';
import type { CellType } from '../../src/domain/map/CellType';
import { GameMap } from '../../src/domain/map/GameMap';
import { MapRules, type MapConfig } from '../../src/domain/map/MapRules';

/** Parámetros del mapa por defecto (design 0015 §3.1; content/map.json desde la tarea 1.2). */
export const DEFAULT_MAP_LITERAL: MapConfig = {
  cellSize: 60,
  startRadius: 180,
  trunkDensity: 0.12,
  trunkPatch: { min: 3, max: 8 },
  rivers: 1,
  bridges: { min: 2, max: 3 },
  tuning: { riverVerticalChance: 0.5, riverMeander: 0.25, patchAttempts: 4000 },
};

/** Radio del jugador del contenido por defecto (content/player.json). */
const PLAYER_RADIUS = 16;

/** `MapRules` válidas o excepción (para preparar escenarios). */
export function mapRules(
  config: MapConfig = DEFAULT_MAP_LITERAL,
  width = 1920,
  height = 1080,
  playerRadius = PLAYER_RADIUS,
): MapRules {
  const arena = Arena.create(width, height);
  if (!arena.ok) throw new Error(arena.error.message);
  const r = MapRules.create(config, arena.value, playerRadius);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** Celdas `'c,r'` → tipo sobre hierba (p. ej. `{ '10,4': 'trunk' }`), en orden de filas. */
export type Layout = Readonly<Record<string, CellType>>;

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
