import type { Box, MapArtPlan } from './planMapArt';

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

/** Lo que el culler usa del lienzo del mapa: mostrar u ocultar la entrada `index` del plan. */
export interface MapVisibility {
  show(index: number, visible: boolean): void;
}

/**
 * Aplica la regla en cada frame a todas las entradas del plan (design D3) y llama a `show` solo
 * donde cambia la visibilidad. Índices en el orden de pintado, `[...low, ...high]`. No guarda la vista
 * anterior: cada `apply` decide con la vista que recibe.
 */
export class MapCuller {
  /** x0, y0, x1, y1 de cada entrada. */
  private edges = new Float64Array(0);
  private visible = new Uint8Array(0);
  private margin = 0;
  private count = 0;

  /** Objetos del mapa visibles tras el último recorte (sonda `sprites.mapArt.drawn`). */
  get drawn(): number {
    return this.count;
  }

  /** Plan nuevo (al pintarlo): todo visible, como lo deja `paintMapArt`. */
  reset(plan: MapArtPlan): void {
    const draws = [...plan.low, ...plan.high];
    this.edges = new Float64Array(draws.length * 4);
    draws.forEach(({ bounds: b }, i) => {
      this.edges.set([b.x, b.y, b.x + b.width, b.y + b.height], i * 4);
    });
    this.visible = new Uint8Array(draws.length).fill(1);
    this.margin = cullMargin(plan.cellSize);
    this.count = draws.length;
  }

  /** Recorte del frame con su rectángulo visible `view`. */
  apply(view: Box, canvas: MapVisibility): void {
    const r = clipRect(view, this.margin);
    const left = r.x;
    const top = r.y;
    const right = r.x + r.width;
    const bottom = r.y + r.height;
    const e = this.edges;
    for (let i = 0; i < this.visible.length; i++) {
      const k = i * 4;
      const on =
        (e[k] ?? 0) <= right &&
        (e[k + 2] ?? 0) >= left &&
        (e[k + 1] ?? 0) <= bottom &&
        (e[k + 3] ?? 0) >= top;
      if (on === (this.visible[i] === 1)) continue;
      this.visible[i] = on ? 1 : 0;
      this.count += on ? 1 : -1;
      canvas.show(i, on);
    }
  }
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
