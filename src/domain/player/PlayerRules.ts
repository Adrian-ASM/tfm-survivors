import type { Arena } from '../arena/Arena';
import { invalidConfig, type DomainError } from '../shared/Result';

/** Mensajes de las invariantes del jugador; la validación de contenido (zod) usa los mismos. */
export const SPEED_MUST_BE_POSITIVE = 'La velocidad del jugador debe ser positiva.';
export const RADIUS_MUST_FIT = 'El radio del jugador no cabe en la arena.';
export const PLAYER_HEALTH_MUST_BE_POSITIVE = 'La vida máxima del jugador debe ser positiva.';
export const PICKUP_RADIUS_MUST_BE_POSITIVE = 'El radio de recogida del jugador debe ser positivo.';
export const INVULNERABILITY_TICKS_MUST_BE_INTEGER =
  'La invulnerabilidad tras un golpe debe durar un número entero de ticks ≥ 1.';
export const REGEN_INTERVAL_MUST_BE_INTEGER =
  'El intervalo de regeneración del jugador debe ser un número entero de ticks ≥ 1.';
export const PLAYER_BONUS_MUST_BE_NON_NEGATIVE =
  'La regeneración, la armadura y las bonificaciones de XP y de oro del jugador deben ser ' +
  'enteros ≥ 0.';

/**
 * Estadísticas del jugador de 0024 con base 0 implícita (spec upgrades, "Estadísticas de personaje
 * nuevas"): no se declaran en content/player.json; solo las suben las mejoras de personaje. Las
 * reglas efectivas (`playerWith`) siempre las llevan.
 */
export const PLAYER_BONUS_STATS = Object.freeze([
  'regeneration',
  'armor',
  'xpBonusPercent',
  'goldBonusPercent',
] as const);

/** Parámetros del jugador en el contenido (content/player.json). */
export interface PlayerRules {
  readonly speed: number;
  readonly radius: number;
  readonly maxHealth: number;
  /** N: tras un golpe en el tick t, los contactos de t + 1 a t + N no hacen daño. */
  readonly invulnerabilityTicks: number;
  /** Cada cuántos ticks se aplica la regeneración (contenido, no mejorable; player-health 0024). */
  readonly pickupRadius: number;
  /** Cada cuántos ticks se aplica la regeneración (contenido, no mejorable; spec player-health 0024). */
  readonly regenIntervalTicks: number;
  /** Vida que recupera en cada tick de regeneración (base 0). */
  readonly regeneration?: number;
  /** Reducción plana del daño de cada golpe, con mínimo 1 (base 0). */
  readonly armor?: number;
  /** Porcentaje extra de la XP de cada gema (base 0). */
  readonly xpBonusPercent?: number;
  /** Porcentaje extra del oro de cada ingreso (base 0). */
  readonly goldBonusPercent?: number;
  /** Puntos que se suman a la curación de la carne (base 0; su cota la valida `buildRunRules`). */
  readonly meatHealPercent?: number;
}

const isNonNegativeInt = (v: number | undefined): boolean =>
  v === undefined || (Number.isInteger(v) && v >= 0);

/** Invariantes del jugador (también para la build de peor caso de las mejoras, ADR-0008). */
export function checkPlayer(player: PlayerRules, arena: Arena): DomainError | null {
  const { speed, radius, maxHealth, invulnerabilityTicks, pickupRadius, regenIntervalTicks } =
    player;
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
  if (!Number.isInteger(regenIntervalTicks) || regenIntervalTicks < 1) {
    return invalidConfig('player.regenIntervalTicks', REGEN_INTERVAL_MUST_BE_INTEGER);
  }
  const bad = PLAYER_BONUS_STATS.find((stat) => !isNonNegativeInt(player[stat]));
  return bad ? invalidConfig(`player.${bad}`, PLAYER_BONUS_MUST_BE_NON_NEGATIVE) : null;
}
