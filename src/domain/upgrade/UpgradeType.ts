import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import type { TargetingMode } from '../weapon/WeaponType';

/** Mensajes de las invariantes de una mejora; la validación de contenido (zod) usa los mismos. */
export const UPGRADE_STEP_MUST_NOT_BE_ZERO =
  'El incremento por nivel de una mejora debe ser un número finito distinto de 0.';
export const UPGRADE_STEP_MUST_BE_INTEGER =
  'El incremento por nivel de una mejora de daño, cadencia o de una estadística entera del ' +
  'jugador debe ser entero';
export const UPGRADE_MAX_LEVEL_MUST_BE_INTEGER =
  'El nivel máximo de una mejora debe ser un entero ≥ 1.';
export const UPGRADE_ID_MUST_BE_UNIQUE = 'Identificador de mejora repetido';
export const UPGRADE_UNKNOWN_WEAPON = 'La mejora apunta a un arma que no existe';
export const UPGRADE_STAT_INCOMPATIBLE = 'Estadística incompatible con el objetivo de la mejora';
export const UPGRADE_STAT_OUT_OF_RANGE = 'Estadística fuera de rango con las mejoras al máximo';
export const UPGRADE_WRONG_CATALOG =
  'Mejora en el catálogo equivocado (personaje: objetivo el jugador; arma: objetivo un arma)';
export const UPGRADE_PRICES_INVALID =
  'Una mejora de arma necesita exactamente maxLevel precios enteros ≥ 1 y no decrecientes';

/** Estadísticas mejorables de un arma (`range`/`radius` según su criterio, ver `TARGETING_STAT`). */
export const WEAPON_STATS = Object.freeze(['damage', 'cooldownTicks', 'range', 'radius'] as const);
/** Estadísticas mejorables del jugador (las 6 últimas, de 0024, con base 0 salvo la invulnerabilidad). */
export const PLAYER_STATS = Object.freeze([
  'maxHealth',
  'speed',
  'pickupRadius',
  'regeneration',
  'armor',
  'invulnerabilityTicks',
  'xpBonusPercent',
  'goldBonusPercent',
  'meatHealPercent',
] as const);
export const UPGRADE_STATS = Object.freeze([...WEAPON_STATS, ...PLAYER_STATS] as const);

export type WeaponStat = (typeof WEAPON_STATS)[number];
export type PlayerStat = (typeof PLAYER_STATS)[number];
export type UpgradeStat = (typeof UPGRADE_STATS)[number];

/** Estadísticas cuyo incremento por nivel debe ser entero (spec upgrades). */
export const INTEGER_STATS: ReadonlySet<UpgradeStat> = new Set<UpgradeStat>([
  'damage',
  'cooldownTicks',
  'regeneration',
  'armor',
  'invulnerabilityTicks',
  'xpBonusPercent',
  'goldBonusPercent',
  'meatHealPercent',
]);

/** Qué estadística de distancia tiene cada criterio. El tipo mapeado obliga a cubrir cada criterio. */
export const TARGETING_STAT: { readonly [K in TargetingMode]: 'range' | 'radius' } = Object.freeze({
  'nearest-in-range': 'range',
  'any-in-radius': 'radius',
});

/** Objetivo de una mejora: un arma del loadout (por id) o el jugador. */
export type UpgradeTarget =
  { readonly kind: 'weapon'; readonly weapon: string } | { readonly kind: 'player' };

/**
 * Origen de una mejora (ADR-0023): `level` = catálogo de personaje (oferta por XP); `shop` =
 * catálogo de arma (compra con oro, con precio por nivel).
 */
export type UpgradeSource = 'level' | 'shop';

/** Forma de una mejora en el contenido (content/upgrades.json). */
export interface UpgradeTypeConfig {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly target: UpgradeTarget;
  readonly stat: UpgradeStat;
  readonly perLevel: number;
  readonly maxLevel: number;
  /** Solo en el catálogo de arma: precio del nivel 1 al `maxLevel` (0024). */
  readonly prices?: readonly number[];
}

export const isWeaponStat = (s: UpgradeStat): s is WeaponStat =>
  (WEAPON_STATS as readonly string[]).includes(s);

/** ¿`maxLevel` precios enteros ≥ 1, cada uno ≥ el anterior? */
function validPrices(prices: readonly number[] | undefined, maxLevel: number): boolean {
  if (prices?.length !== maxLevel) return false;
  return prices.every((p, i) => Number.isInteger(p) && p >= 1 && p >= (prices[i - 1] ?? 1));
}

/**
 * Tipo de mejora (value object, ADR-0008 y ADR-0023): un incremento aditivo por nivel sobre una
 * estadística de la base de contenido, con su origen y, en las de arma, su precio por nivel.
 * Invariantes propias: incremento finito ≠ 0, nivel máximo entero ≥ 1 y, en las de arma, `maxLevel`
 * precios enteros ≥ 1 no decrecientes. Las reglas cruzadas (ids, catálogo, arma existente,
 * compatibilidad, peor caso) son de `UpgradeCatalog`.
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
    readonly source: UpgradeSource,
    /** Precio del nivel k + 1 en `prices[k]`; vacío en las de personaje. */
    readonly prices: readonly number[],
  ) {
    Object.freeze(this);
  }

  /** `path` es la ruta de la mejora en el contenido (p. ej. `upgrades.weapons.1`). */
  static create(
    config: UpgradeTypeConfig,
    path: string,
    source: UpgradeSource = 'level',
  ): Result<UpgradeType, DomainError> {
    const { id, name, description, target, stat, perLevel, maxLevel } = config;
    if (!Number.isFinite(perLevel) || perLevel === 0) {
      return err(invalidConfig(`${path}.perLevel`, UPGRADE_STEP_MUST_NOT_BE_ZERO));
    }
    if (!Number.isInteger(maxLevel) || maxLevel < 1) {
      return err(invalidConfig(`${path}.maxLevel`, UPGRADE_MAX_LEVEL_MUST_BE_INTEGER));
    }
    if (source === 'shop' && !validPrices(config.prices, maxLevel)) {
      return err(invalidConfig(`${path}.prices`, `${UPGRADE_PRICES_INVALID}: ${id}`));
    }
    const prices = source === 'shop' ? Object.freeze([...(config.prices ?? [])]) : [];
    const frozenTarget = Object.freeze({ ...target });
    return ok(
      new UpgradeType(
        id,
        name,
        description,
        frozenTarget,
        stat,
        perLevel,
        maxLevel,
        source,
        Object.freeze(prices),
      ),
    );
  }

  /** Precio del siguiente nivel desde `level`, o `null` en el máximo (o sin precios). */
  priceAt(level: number): number | null {
    return level < this.maxLevel ? (this.prices[level] ?? null) : null;
  }
}
