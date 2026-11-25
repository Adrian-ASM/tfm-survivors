import type { SiteSnapshot } from '../../domain/run/RunSnapshot';
import type { PlannedSite } from './map/planMapArt';
import type { StructureMask } from './StructureArt';

/** Solares pintados (sonda `sprites.sites`, 0026): en obra, casas, torres y cuántos con reserva. */
export interface SiteCount {
  empty: number;
  house: number;
  tower: number;
  fallback: number;
}

export const zeroSiteCounts = (): SiteCount => ({ empty: 0, house: 0, tower: 0, fallback: 0 });

/**
 * Aspecto vigente de cada solar del mapa pintado (spec sprite-rendering 0026). Sin motor: al pintar
 * el plan habilita la obra común y deshabilita casa y torre; en cada frame, la primera vez que un
 * solar figura construido en el snapshot, deshabilita la obra y habilita su edificio (O(k), sin
 * asignar). Es permanente hasta el siguiente plan. Mantiene los recuentos de la sonda.
 */
export class SiteArt {
  readonly counts: SiteCount = zeroSiteCounts();
  private planned: readonly PlannedSite[] = [];
  private built = new Uint8Array(0);
  private mask: StructureMask | null = null;

  /** Plan nuevo (al empezar una partida o tras R): todos en obra. */
  reset(planned: readonly PlannedSite[], mask: StructureMask): void {
    this.planned = planned;
    this.mask = mask;
    this.built = new Uint8Array(planned.length);
    Object.assign(this.counts, zeroSiteCounts());
    for (const s of planned) {
      for (const i of [...s.house, ...s.tower]) mask.setEnabled(i, false);
      for (const i of s.free) mask.setEnabled(i, true);
      this.counts.empty += 1;
      if (s.fallback.free) this.counts.fallback += 1;
    }
  }

  /** Cambia a su edificio los solares que el snapshot da por construidos por primera vez. */
  sync(sites: readonly SiteSnapshot[]): void {
    const mask = this.mask;
    if (!mask) return;
    const n = Math.min(sites.length, this.planned.length);
    for (let k = 0; k < n; k++) {
      const site = sites[k];
      const s = this.planned[k];
      if (this.built[k] === 1 || !site || !s || site.state === 'free') continue;
      const kind = site.state;
      this.built[k] = 1;
      for (const i of s.free) mask.setEnabled(i, false);
      for (const i of s[kind]) mask.setEnabled(i, true);
      this.counts.empty -= 1;
      this.counts[kind] += 1;
      this.counts.fallback += (s.fallback[kind] ? 1 : 0) - (s.fallback.free ? 1 : 0);
    }
  }
}
