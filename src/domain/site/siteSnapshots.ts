import type { BuildSnapshot, FootprintSnapshot, SiteSnapshot } from '../run/RunSnapshot';
import type { BuildSite } from './BuildSite';
import type { Settlement } from './Settlement';

/** Oferta de obra cerrada (todo estado salvo en obra): congelada y compartida. */
export const CLOSED_BUILD: BuildSnapshot = Object.freeze({
  open: false,
  siteId: null,
  options: Object.freeze([]),
});

/** Huella de un solar (la de la casa y la de la torre son la misma, design 0026 §1). */
const footprintOf = (s: BuildSite): FootprintSnapshot =>
  Object.freeze({ col: s.col, row: s.row, cols: s.cols, rows: s.rows });

/** Copia congelada de los solares en su orden (fuera del tick: solo al cambiar alguno). */
export function toSiteSnapshots(sites: readonly BuildSite[]): readonly SiteSnapshot[] {
  return Object.freeze(
    sites.map((s) =>
      Object.freeze({
        id: s.id,
        state: s.state,
        armed: s.armed,
        house: footprintOf(s),
        tower: footprintOf(s),
      }),
    ),
  );
}

/** Oferta de la obra abierta (al abrirse; no cambia mientras dura), o la cerrada. */
export function toBuildSnapshot(settlement: Settlement): BuildSnapshot {
  const site = settlement.open;
  if (!site) return CLOSED_BUILD;
  return Object.freeze({
    open: true,
    siteId: site.id,
    options: settlement.options,
  });
}
