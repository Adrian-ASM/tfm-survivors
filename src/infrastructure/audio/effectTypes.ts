import type { PickupKind } from '../../domain/pickup/PickupKind';

/**
 * Tipos de efecto de audio (spec audio 0035, convenciones): lista cerrada y en este orden, que es
 * también el de desempate a igual prioridad en el mezclador.
 */
export const EFFECT_TYPES = [
  'playerHurt',
  'impactWeapon',
  'impactTower',
  'impactBlast',
  'enemyDeath',
  'pickupGold',
  'pickupStone',
  'pickupWood',
  'levelUp',
  'explosion',
  'purchase',
  'build',
] as const;

export type EffectType = (typeof EFFECT_TYPES)[number];

/** Tipo de recogida de cada clase de recogible (spec audio, convenciones; design D2). */
export const PICKUP_EFFECT = {
  xp: 'pickupGold',
  gold: 'pickupGold',
  meat: 'pickupGold',
  stone: 'pickupStone',
  wood: 'pickupWood',
} as const satisfies Record<PickupKind, EffectType>;

/** Recuento por tipo de efecto (peticiones, reproducidas o descartadas). */
export type EffectCounts = Record<EffectType, number>;

/** Recuento a 0 de los 12 tipos. */
export function zeroCounts(): EffectCounts {
  const out = {} as EffectCounts;
  for (const t of EFFECT_TYPES) out[t] = 0;
  return out;
}
