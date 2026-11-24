import type { Box } from './planMapArt';

// Recorte por cámara del arte del mapa (change 0018, design §4 y §5). Puro: sin motor. Decide qué
// objetos del plan se dibujan en el frame según su caja y el rectángulo de recorte (vista + M).

/**
 * Margen del recorte en celdas de `map.cellSize` (design D2, gate G3): fijo, absorbe el redondeo
 * del seguimiento y errores de caja ≤ 1 px. No es contenido de juego: no cambia lo que se ve.
 */
export const CULL_MARGIN_CELLS = 1;

/** Margen M en px para una rejilla de celdas de `cellSize` px. */
export const cullMargin = (cellSize: number): number => CULL_MARGIN_CELLS * cellSize;

/** Rectángulo de recorte: la vista del frame ampliada `margin` px por cada lado. */
export function clipRect(view: Box, margin: number): Box {
  return {
    x: view.x - margin,
    y: view.y - margin,
    width: view.width + 2 * margin,
    height: view.height + 2 * margin,
  };
}

/** ¿Comparten la caja y el rectángulo al menos un punto? Bordes incluidos (gate G4). */
export function touches(box: Box, rect: Box): boolean {
  return (
    box.x <= rect.x + rect.width &&
    box.x + box.width >= rect.x &&
    box.y <= rect.y + rect.height &&
    box.y + box.height >= rect.y
  );
}
