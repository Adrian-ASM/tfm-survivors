import type { MapAppearance } from '../../content/appearanceSchema';

// Cortes derivados de copa y tejado (design 0016 §12.2 B4), en px del frame y sin números de datos:
// la copa es la parte del dibujo por encima del borde superior de la celda del tronco y el tejado,
// la parte por encima del borde superior de la fila inferior de la huella. Puros.

/** Fila del frame del árbol donde empieza su celda: `origin.y · alto − cellSize / escala`. */
export function canopyCut(trees: MapAppearance['trees'], cellSize: number): number {
  return trees.origin.y * trees.sheet.frameHeight - cellSize / trees.scale;
}

/**
 * Fila del frame del castillo donde empieza la fila inferior de su huella. El origen del castillo
 * está en el borde inferior de la huella: `origin.y · alto − cellSize / escala` (256 − 64 = 192).
 */
export function roofCut(castle: MapAppearance['castle'], cellSize: number): number {
  return castle.origin.y * castle.sheet.frameHeight - cellSize / castle.scale;
}
