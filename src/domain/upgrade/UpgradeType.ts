import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import type { TargetingMode } from '../weapon/WeaponType';

/** Mensajes de las invariantes de una mejora; la validación de contenido (zod) usa los mismos. */
export const UPGRADE_STEP_MUST_NOT_BE_ZERO =
  'El incremento por nivel de una mejora debe ser un número finito distinto de 0.';
export const UPGRADE_STEP_MUST_BE_INTEGER =
  'El incremento por nivel de una mejora de daño o cadencia debe ser entero';
export const UPGRADE_MAX_LEVEL_MUST_BE_INTEGER =
  'El nivel máximo de una mejora debe ser un entero ≥ 1.';
export const UPGRADE_ID_MUST_BE_UNIQUE = 'Identificador de mejora repetido';
export const UPGRADE_UNKNOWN_WEAPON = 'La mejora apunta a un arma que no existe';
export const UPGRADE_STAT_INCOMPATIBLE = 'Estadística incompatible con el objetivo de la mejora';
export const UPGRADE_STAT_OUT_OF_RANGE = 'Estadística fuera de rango con las mejoras al máximo';

/** Estadísticas mejorables de un arma (`range`/`radius` según su criterio, ver `TARGETING_STAT`). */
export const WEAPON_STATS = Object.freeze(['damage', 'cooldownTicks', 'range', 'radius'] as const);
/** Estadísticas mejorables del jugador. */
export const PLAYER_STATS = Object.freeze(['maxHealth', 'speed', 'pickupRadius'] as const);
export const UPGRADE_STATS = Object.freeze([...WEAPON_STATS, ...PLAYER_STATS] as const);

export type WeaponStat = (typeof WEAPON_STATS)[number];
export type PlayerStat = (typeof PLAYER_STATS)[number];
export type UpgradeStat = (typeof UPGRADE_STATS)[number];

/** Qué estadística de distancia tiene cada criterio. El tipo mapeado obliga a cubrir cada criterio. */
export const TARGETING_STAT: { readonly [K in TargetingMode]: 'range' | 'radius' } = Object.freeze({
  'nearest-in-range': 'range',
  'any-in-radius': 'radius',
});

/** Objetivo de una mejora: un arma del loadout (por id) o el jugador. */
export type UpgradeTarget =
  { readonly kind: 'weapon'; readonly weapon: string } | { readonly kind: 'player' };

/** Forma de una mejora en el contenido (content/upgrades.json). */
export interface UpgradeTypeConfig {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly target: UpgradeTarget;
  readonly stat: UpgradeStat;
  readonly perLevel: number;
  readonly maxLevel: number;
}

export const isWeaponStat = (s: UpgradeStat): s is WeaponStat =>
  (WEAPON_STATS as readonly string[]).includes(s);

/**
 * Tipo de mejora (value object, ADR-0008): un incremento aditivo por nivel sobre una estadística
 * de la base de contenido. Invariantes propias: incremento finito ≠ 0 y nivel máximo entero ≥ 1.
 * Las reglas cruzadas (ids, arma existente, compatibilidad, peor caso) son de `UpgradeCatalog`.
 */
export class UpgradeType {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly description: string,
    readonly target: UpgradeTarget,
    readonly stat: UpgradeStat,
    readonly perLevel: number,
    readonly maxLevel: number,
  ) {
    Object.freeze(this);
  }

  /** `path` es la ruta de la mejora en el contenido (p. ej. `upgrades.upgrades.1`). */
  static create(config: UpgradeTypeConfig, path: string): Result<UpgradeType, DomainError> {
    const { id, name, description, target, stat, perLevel, maxLevel } = config;
    if (!Number.isFinite(perLevel) || perLevel === 0) {
      return err(invalidConfig(`${path}.perLevel`, UPGRADE_STEP_MUST_NOT_BE_ZERO));
    }
    if (!Number.isInteger(maxLevel) || maxLevel < 1) {
      return err(invalidConfig(`${path}.maxLevel`, UPGRADE_MAX_LEVEL_MUST_BE_INTEGER));
    }
    const frozenTarget = Object.freeze({ ...target });
    return ok(new UpgradeType(id, name, description, frozenTarget, stat, perLevel, maxLevel));
  }
}
