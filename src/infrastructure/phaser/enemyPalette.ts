// Colores de placeholder por tipo de enemigo. Es presentación (no contenido de juego): el arte final
// sustituirá estos círculos.
const PALETTE: ReadonlyMap<string, number> = new Map([
  ['goblin-torch', 0xe5484d],
  ['goblin-tnt', 0x8e4ec6],
  ['goblin-barrel', 0xf76b15],
]);

/** Color de un tipo que no está en la paleta (contenido nuevo sin color asignado aún). */
export const DEFAULT_ENEMY_COLOR = 0xb0b4ba;

export function enemyPalette(typeId: string): number {
  return PALETTE.get(typeId) ?? DEFAULT_ENEMY_COLOR;
}
