import type { GameMap } from '../map/GameMap';

/** ¿Es (x, y) una posición legal del círculo de radio r? Dentro del mundo y sin solapar celdas no
 * caminables; la tangencia es legal (spec procedural-map 0023, como la salida del jugador). */
export function isLegalSheepAt(map: GameMap, x: number, y: number, r: number): boolean {
  const inside = x >= r && x <= map.width - r && y >= r && y <= map.height - r;
  return inside && !map.overlapsBlocked(x, y, r);
}

/** Las celdas de `cells` cuyo centro es posición legal del círculo de radio r, en su orden. */
export function legalCells(map: GameMap, cells: readonly number[], r: number): number[] {
  return cells.filter((i) => {
    const c = i % map.cols;
    const rect = map.cellRect(c, (i - c) / map.cols);
    return isLegalSheepAt(map, (rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2, r);
  });
}
