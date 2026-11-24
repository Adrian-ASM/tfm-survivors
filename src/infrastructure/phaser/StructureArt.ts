import type { StructureSnapshot } from '../../domain/run/RunSnapshot';
import type { PlannedStructure } from './map/planMapArt';

/** Lo que `StructureArt` usa del recorte del mapa: la máscara de habilitado (`MapCuller`). */
export interface StructureMask {
  setEnabled(index: number, on: boolean): void;
}

/** Estructuras pintadas de un tipo (sonda `sprites.structures`, 0021). */
export interface StructureCount {
  intact: number;
  ruin: number;
  /** Cuántas de ellas se pintan con su rectángulo de reserva (en su aspecto vigente). */
  fallback: number;
}

/** Recuentos de estructuras por tipo, a 0 para los tipos dados (modo menú). */
export function zeroStructureCounts(types: Iterable<string>): Record<string, StructureCount> {
  const out: Record<string, StructureCount> = {};
  for (const id of types) out[id] = { intact: 0, ruin: 0, fallback: 0 };
  return out;
}

/**
 * Aspecto vigente de cada estructura del mapa pintado (change 0021, design §8). Sin motor: al pintar
 * el plan habilita los aspectos intactos y deshabilita las ruinas; en cada frame, la primera vez que
 * una estructura figura destruida en el snapshot, cambia a su ruina (O(k), sin asignar). La ruina es
 * permanente hasta el siguiente plan. Mantiene los recuentos por tipo de la sonda.
 */
export class StructureArt<T = StructureSnapshot> {
  readonly counts: Record<string, StructureCount>;
  private planned: readonly PlannedStructure[] = [];
  private ruined = new Uint8Array(0);
  private mask: StructureMask | null = null;

  /**
   * `second` lee si un elemento del snapshot está en su segundo aspecto (0022: parametrizado para las
   * vetas, `depleted`; por defecto, la ruina de una estructura, `destroyed`).
   */
  constructor(
    types: Iterable<string>,
    private readonly second: (item: T) => boolean = (s) =>
      (s as unknown as StructureSnapshot).destroyed,
  ) {
    this.counts = zeroStructureCounts(types);
  }

  /** Plan nuevo (al empezar una partida o tras R): todas intactas. */
  reset(planned: readonly PlannedStructure[], mask: StructureMask): void {
    this.planned = planned;
    this.mask = mask;
    this.ruined = new Uint8Array(planned.length);
    for (const c of Object.values(this.counts))
      Object.assign(c, { intact: 0, ruin: 0, fallback: 0 });
    for (const s of planned) {
      for (const i of s.ruin) mask.setEnabled(i, false);
      for (const i of s.intact) mask.setEnabled(i, true);
      const c = this.countOf(s.type);
      c.intact += 1;
      if (s.fallback.intact) c.fallback += 1;
    }
  }

  /** Cambia a ruina las estructuras que el snapshot da por destruidas por primera vez. */
  sync(structures: readonly T[]): void {
    const mask = this.mask;
    if (!mask) return;
    const n = Math.min(structures.length, this.planned.length);
    for (let k = 0; k < n; k++) {
      const item = structures[k];
      if (this.ruined[k] === 1 || item === undefined || !this.second(item)) continue;
      const s = this.planned[k];
      if (!s) continue;
      this.ruined[k] = 1;
      for (const i of s.intact) mask.setEnabled(i, false);
      for (const i of s.ruin) mask.setEnabled(i, true);
      const c = this.countOf(s.type);
      c.intact -= 1;
      c.ruin += 1;
      c.fallback += (s.fallback.ruin ? 1 : 0) - (s.fallback.intact ? 1 : 0);
    }
  }

  private countOf(type: string): StructureCount {
    const existing = this.counts[type];
    if (existing) return existing;
    const created = { intact: 0, ruin: 0, fallback: 0 };
    this.counts[type] = created;
    return created;
  }
}
