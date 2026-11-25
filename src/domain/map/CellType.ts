/** Tipos de celda del mapa (spec procedural-map), en el orden de sus códigos 0..4. */
export const CELL_TYPES = ['grass', 'trunk', 'water', 'bridge', 'castle'] as const;

export type CellType = (typeof CELL_TYPES)[number];

/** Códigos de celda en la rejilla interna (un byte por celda). */
export const GRASS = 0;
export const TRUNK = 1;
export const WATER = 2;
export const BRIDGE = 3;
export const CASTLE = 4;
/**
 * Código interno de la capa de obra (ADR-0025, ADR-0026): celda de la huella de un solar libre o
 * de un edificio construido. No es un `CellType` (el tipo de la celda no cambia) y no es caminable.
 */
export const BUILT = 5;

/** `grass` y `bridge` son caminables; `trunk`, `water` y `castle`, no. */
export const isWalkableCode = (code: number): boolean => code === GRASS || code === BRIDGE;

export const isWalkableType = (type: CellType): boolean => isWalkableCode(codeOf(type));

/** Código de un tipo de celda. */
export function codeOf(type: CellType): number {
  return CELL_TYPES.indexOf(type);
}

/** Tipo de un código de celda (los códigos los escribe solo el dominio). */
export function typeOf(code: number): CellType {
  const type = CELL_TYPES[code];
  if (type === undefined) throw new Error(`Invariante rota: código de celda ${String(code)}`);
  return type;
}
