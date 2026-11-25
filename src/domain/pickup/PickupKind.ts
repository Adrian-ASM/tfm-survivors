/**
 * Tipo de un recogible (spec xp-gems, "Recogibles con tipo"): unión cerrada. Una gema es un
 * recogible `xp`; `gold`, `wood` y `stone` (0025) suman a los contadores de la partida (spec
 * resources) y `meat` cura al jugador (spec player-health 0023).
 */
export type PickupKind = 'xp' | 'gold' | 'wood' | 'meat' | 'stone';

/** Los cinco tipos en orden fijo (contadores por tipo y recorridos deterministas). */
export const PICKUP_KINDS: readonly PickupKind[] = Object.freeze([
  'xp',
  'gold',
  'wood',
  'meat',
  'stone',
]);
