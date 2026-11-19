import { assertNever } from '../shared/assertNever';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';

/**
 * Mensajes de las invariantes de un arma; la validación de contenido (zod) usa los mismos.
 */
export const WEAPON_COOLDOWN_MUST_BE_INTEGER =
  'La cadencia de un arma debe ser un número entero de ticks ≥ 1.';
export const WEAPON_DAMAGE_MUST_BE_INTEGER = 'El daño de un arma debe ser un entero ≥ 1.';
export const TARGETING_RANGE_MUST_BE_POSITIVE = 'El alcance del criterio debe ser positivo.';
export const TARGETING_RADIUS_MUST_BE_POSITIVE = 'El radio del criterio debe ser positivo.';
export const PROJECTILE_SPEED_MUST_BE_POSITIVE = 'La velocidad del proyectil debe ser positiva.';
export const PROJECTILE_RADIUS_MUST_BE_POSITIVE = 'El radio del proyectil debe ser positivo.';
export const PROJECTILE_LIFETIME_MUST_BE_INTEGER =
  'La vida de un proyectil debe ser un número entero de ticks ≥ 1.';
export const PULSE_VISUAL_TICKS_MUST_BE_INTEGER =
  'La duración visible de un pulso debe ser un número entero de ticks ≥ 1.';
/** Regla cruzada entre los dos ejes (ver `ATTACK_TARGETING`). */
export const WEAPON_TARGETING_INCOMPATIBLE = 'El ataque no admite ese criterio de objetivo';

/** Criterio de objetivo (ADR-0007): unión discriminada por `mode`. */
export type TargetingConfig =
  | { readonly mode: 'nearest-in-range'; readonly range: number }
  | { readonly mode: 'any-in-radius'; readonly radius: number };

/** Tipo de ataque (ADR-0007): unión discriminada por `type`. */
export type AttackConfig =
  | {
      readonly type: 'projectile';
      readonly speed: number;
      readonly radius: number;
      readonly lifetimeTicks: number;
    }
  | { readonly type: 'pulse'; readonly visualTicks: number };

export type TargetingMode = TargetingConfig['mode'];
export type AttackType = AttackConfig['type'];

/** Qué criterios admite cada ataque. El tipo mapeado obliga a dar entrada a cada ataque nuevo. */
export const ATTACK_TARGETING: { readonly [K in AttackType]: readonly TargetingMode[] } =
  Object.freeze({
    projectile: Object.freeze(['nearest-in-range'] as const),
    pulse: Object.freeze(['any-in-radius'] as const),
  });

/** Forma de un arma en el contenido (content/weapons.json). */
export interface WeaponTypeConfig {
  readonly id: string;
  readonly cooldownTicks: number;
  readonly damage: number;
  readonly targeting: TargetingConfig;
  readonly attack: AttackConfig;
}

const isPositive = (v: number): boolean => Number.isFinite(v) && v > 0;
const isCount = (v: number): boolean => Number.isInteger(v) && v >= 1;

function checkTargeting(t: TargetingConfig, path: string): DomainError | null {
  switch (t.mode) {
    case 'nearest-in-range':
      return isPositive(t.range)
        ? null
        : invalidConfig(`${path}.targeting.range`, TARGETING_RANGE_MUST_BE_POSITIVE);
    case 'any-in-radius':
      return isPositive(t.radius)
        ? null
        : invalidConfig(`${path}.targeting.radius`, TARGETING_RADIUS_MUST_BE_POSITIVE);
    default:
      return assertNever(t);
  }
}

function checkProjectile(
  a: Extract<AttackConfig, { type: 'projectile' }>,
  path: string,
): DomainError | null {
  if (!isPositive(a.speed)) {
    return invalidConfig(`${path}.attack.speed`, PROJECTILE_SPEED_MUST_BE_POSITIVE);
  }
  if (!isPositive(a.radius)) {
    return invalidConfig(`${path}.attack.radius`, PROJECTILE_RADIUS_MUST_BE_POSITIVE);
  }
  if (!isCount(a.lifetimeTicks)) {
    return invalidConfig(`${path}.attack.lifetimeTicks`, PROJECTILE_LIFETIME_MUST_BE_INTEGER);
  }
  return null;
}

function checkAttack(a: AttackConfig, path: string): DomainError | null {
  switch (a.type) {
    case 'projectile':
      return checkProjectile(a, path);
    case 'pulse':
      return isCount(a.visualTicks)
        ? null
        : invalidConfig(`${path}.attack.visualTicks`, PULSE_VISUAL_TICKS_MUST_BE_INTEGER);
    default:
      return assertNever(a);
  }
}

function checkCompatible(config: WeaponTypeConfig, path: string): DomainError | null {
  const { attack, targeting } = config;
  if (ATTACK_TARGETING[attack.type].includes(targeting.mode)) return null;
  const message = `${WEAPON_TARGETING_INCOMPATIBLE}: ${attack.type} con ${targeting.mode}`;
  return invalidConfig(`${path}.targeting.mode`, message);
}

/**
 * Tipo de arma (value object, ADR-0007): el arma es dato. Inmutable y compartido por la partida.
 * Invariantes: cadencia, daño y duraciones enteros ≥ 1; distancias y velocidades finitas > 0;
 * criterio compatible con el ataque.
 */
export class WeaponType {
  private constructor(
    readonly id: string,
    readonly cooldownTicks: number,
    readonly damage: number,
    readonly targeting: TargetingConfig,
    readonly attack: AttackConfig,
  ) {
    Object.freeze(this);
  }

  /** `path` es la ruta del arma en el contenido (p. ej. `weapons.weapons.1`). */
  static create(config: WeaponTypeConfig, path: string): Result<WeaponType, DomainError> {
    const { id, cooldownTicks, damage, targeting, attack } = config;
    if (!isCount(cooldownTicks)) {
      return err(invalidConfig(`${path}.cooldownTicks`, WEAPON_COOLDOWN_MUST_BE_INTEGER));
    }
    if (!isCount(damage)) {
      return err(invalidConfig(`${path}.damage`, WEAPON_DAMAGE_MUST_BE_INTEGER));
    }
    const problem =
      checkTargeting(targeting, path) ?? checkAttack(attack, path) ?? checkCompatible(config, path);
    if (problem) return err(problem);
    const frozenTargeting = Object.freeze({ ...targeting });
    const frozenAttack = Object.freeze({ ...attack });
    return ok(new WeaponType(id, cooldownTicks, damage, frozenTargeting, frozenAttack));
  }
}
