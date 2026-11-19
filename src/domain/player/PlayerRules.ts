import type { Arena } from '../arena/Arena';
import { invalidConfig, type DomainError } from '../shared/Result';

/** Mensajes de las invariantes del jugador; la validación de contenido (zod) usa los mismos. */
export const SPEED_MUST_BE_POSITIVE = 'La velocidad del jugador debe ser positiva.';
export const RADIUS_MUST_FIT = 'El radio del jugador no cabe en la arena.';
export const PLAYER_HEALTH_MUST_BE_POSITIVE = 'La vida máxima del jugador debe ser positiva.';
export const PICKUP_RADIUS_MUST_BE_POSITIVE = 'El radio de recogida del jugador debe ser positivo.';
export const INVULNERABILITY_TICKS_MUST_BE_INTEGER =
  'La invulnerabilidad tras un golpe debe durar un número entero de ticks ≥ 1.';

/** Parámetros del jugador en el contenido (content/player.json). */
export interface PlayerRules {
  readonly speed: number;
  readonly radius: number;
  readonly maxHealth: number;
  /** N: tras un golpe en el tick t, los contactos de t + 1 a t + N no hacen daño. */
  readonly invulnerabilityTicks: number;
  /** Radio de recogida base: el imán atrae las gemas a distancia ≤ este valor (spec xp-gems). */
  readonly pickupRadius: number;
}

/** Invariantes del jugador (también para la build de peor caso de las mejoras, ADR-0008). */
export function checkPlayer(player: PlayerRules, arena: Arena): DomainError | null {
  const { speed, radius, maxHealth, invulnerabilityTicks, pickupRadius } = player;
  if (!Number.isFinite(speed) || speed <= 0) {
    return invalidConfig('player.speed', SPEED_MUST_BE_POSITIVE);
  }
  if (!arena.fits(radius)) return invalidConfig('player.radius', RADIUS_MUST_FIT);
  if (!Number.isFinite(maxHealth) || maxHealth <= 0) {
    return invalidConfig('player.maxHealth', PLAYER_HEALTH_MUST_BE_POSITIVE);
  }
  if (!Number.isInteger(invulnerabilityTicks) || invulnerabilityTicks < 1) {
    return invalidConfig('player.invulnerabilityTicks', INVULNERABILITY_TICKS_MUST_BE_INTEGER);
  }
  if (!Number.isFinite(pickupRadius) || pickupRadius <= 0) {
    return invalidConfig('player.pickupRadius', PICKUP_RADIUS_MUST_BE_POSITIVE);
  }
  return null;
}
