import type { CellType } from '../../../domain/map/CellType';
import type { MapSnapshot } from '../../../domain/map/MapSnapshot';
import type { ShoreCase } from '../../content/appearanceSchema';

// Autotile de orillas y orientación de puentes (spec sprite-rendering 0016, design §12.2 B1 y B3).
// Funciones puras del snapshot del mapa: sin azar ni motor.

/** Lados de una celda que dan a río (`water` o `bridge`). */
export interface RiverSides {
  readonly N: boolean;
  readonly E: boolean;
  readonly S: boolean;
  readonly W: boolean;
}

/** Celda de orilla: su posición y su caso (los lados que dan a río). */
export interface ShoreCell {
  readonly col: number;
  readonly row: number;
  readonly kind: ShoreCase;
}

export type BridgeOrientation = 'northSouth' | 'eastWest';

const isRiver = (t: CellType | undefined): boolean => t === 'water' || t === 'bridge';
const isLand = (t: CellType | undefined): boolean =>
  t === 'grass' || t === 'trunk' || t === 'castle';

/** Tipo de la celda (c, r), o `undefined` fuera de la rejilla. */
function typeAt(map: MapSnapshot, c: number, r: number): CellType | undefined {
  if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) return undefined;
  return map.cells[r * map.cols + c];
}

/** Lados de río de la celda (c, r); fuera de la rejilla **no** es río (el borde no hace orilla). */
export function riverSides(map: MapSnapshot, c: number, r: number): RiverSides {
  return {
    N: isRiver(typeAt(map, c, r - 1)),
    E: isRiver(typeAt(map, c + 1, r)),
    S: isRiver(typeAt(map, c, r + 1)),
    W: isRiver(typeAt(map, c - 1, r)),
  };
}

/** Clave canónica del caso (letras en orden N-E-S-W), o `null` sin lados de río. */
export function shoreCase(sides: RiverSides): ShoreCase | null {
  const key = (['N', 'E', 'S', 'W'] as const).filter((side) => sides[side]).join('');
  return key === '' ? null : (key as ShoreCase);
}

/** ¿Es (c, r) una celda de orilla? Tierra (`grass`, `trunk` o `castle`) con ≥ 1 lado de río. */
export function isShore(map: MapSnapshot, c: number, r: number): boolean {
  return isLand(typeAt(map, c, r)) && shoreCase(riverSides(map, c, r)) !== null;
}

/** Celdas de orilla del mapa con su caso, en orden de filas. */
export function shoreCells(map: MapSnapshot): ShoreCell[] {
  const out: ShoreCell[] = [];
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (!isLand(typeAt(map, c, r))) continue;
      const kind = shoreCase(riverSides(map, c, r));
      if (kind) out.push({ col: c, row: r, kind });
    }
  }
  return out;
}

/**
 * Orientación del puente (c, r): norte-sur si sus vecinas norte y sur son tierra; si no, este-oeste
 * si lo son la este y la oeste; si no, norte-sur. Aquí fuera de la rejilla no es tierra.
 */
export function bridgeOrientation(map: MapSnapshot, c: number, r: number): BridgeOrientation {
  if (isLand(typeAt(map, c, r - 1)) && isLand(typeAt(map, c, r + 1))) return 'northSouth';
  if (isLand(typeAt(map, c + 1, r)) && isLand(typeAt(map, c - 1, r))) return 'eastWest';
  return 'northSouth';
}
