/**
 * Tipo de un recogible (spec xp-gems, "Recogibles con tipo"): unión cerrada. Una gema es un
 * recogible `xp`; `gold` y `wood` suman a los contadores de la partida (spec resources).
 */
export type PickupKind = 'xp' | 'gold' | 'wood';

/** Los tres tipos en orden fijo (contadores por tipo y recorridos deterministas). */
export const PICKUP_KINDS: readonly PickupKind[] = Object.freeze(['xp', 'gold', 'wood']);
