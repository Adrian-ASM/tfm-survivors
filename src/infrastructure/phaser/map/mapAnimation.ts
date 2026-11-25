import { phasedFrameAt } from '../art/animation';
import type { MapArtPlan } from './planMapArt';

// Animación del arte del mapa (change 0029, design §Animación): árboles y torres goblin intactas,
// por grupos (animación y fase) del plan. Puro: sin motor. Solo pone el frame a los objetos que se
// dibujan y "ceba" el frame vigente de cada objeto que el recorte vuelve a mostrar.

/** Lo que el animador usa del recorte: si un objeto del plan se dibuja ahora (`MapCuller`). */
export interface DrawnObjects {
  isVisible(index: number): boolean;
}

/** Lo que el animador usa del lienzo del mapa: poner el frame de hoja del objeto `index`. */
export interface MapFrames {
  frame(index: number, frame: number): void;
}

/** Un grupo del plan, sin asignar por frame. */
interface Group {
  readonly frames: readonly number[];
  readonly fps: number;
  readonly phase: number;
  readonly indices: Int32Array;
}

export class MapAnimator {
  private groups: readonly Group[] = [];
  /** Grupo de cada objeto del plan, o −1 si es estático. */
  private groupOf = new Int32Array(0);
  /** Último frame de hoja aplicado por grupo (−1: ninguno todavía). */
  private applied = new Int32Array(0);

  /** Plan nuevo (al pintarlo): sin frames aplicados. */
  reset(plan: MapArtPlan): void {
    this.groups = plan.animations.map((a) => ({
      frames: a.frames,
      fps: a.fps,
      phase: a.phase,
      indices: Int32Array.from(a.indices),
    }));
    this.groupOf = new Int32Array(plan.low.length + plan.high.length).fill(-1);
    this.groups.forEach((g, k) => {
      for (const i of g.indices) this.groupOf[i] = k;
    });
    this.applied = new Int32Array(this.groups.length).fill(-1);
  }

  /**
   * Un frame de render con el reloj `ms`: por grupo, si cambia su frame de hoja, `setFrame` solo a
   * los objetos que se dibujan; los ocultos lo reciben al reaparecer (`prime`).
   */
  tick(ms: number, drawn: DrawnObjects, canvas: MapFrames): void {
    for (let k = 0; k < this.groups.length; k++) {
      const g = this.groups[k];
      if (!g) continue;
      const frame = phasedFrameAt(g, ms, g.phase);
      if (frame === this.applied[k]) continue;
      this.applied[k] = frame;
      for (const i of g.indices) if (drawn.isVisible(i)) canvas.frame(i, frame);
    }
  }

  /** Antes de mostrar el objeto `index`: le pone el frame vigente de su grupo, si es animado. */
  prime(index: number, canvas: MapFrames): void {
    const k = this.groupOf[index] ?? -1;
    if (k < 0) return;
    const frame = this.applied[k] ?? -1;
    if (frame >= 0) canvas.frame(index, frame);
  }
}
