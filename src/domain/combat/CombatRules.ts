import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';

/** Mensajes de las invariantes del combate; la validación de contenido (zod) usa los mismos. */
export const HIT_WINDOW_MUST_BE_INTEGER = 'La ventana de golpes debe ser un entero ≥ 1 (ticks).';
export const MAX_HITS_MUST_BE_INTEGER = 'El tope de golpes por tick debe ser un entero ≥ 1.';

/** Contenido del combate (content/combat.json, spec simulation-loop 0031). */
export interface CombatConfig {
  /** Ticks que un golpe figura en el snapshot (la cota ≥ 15 del bucle la pone zod). */
  readonly hitWindowTicks: number;
  /** Golpes de enemigo, estructura u oveja que se registran como mucho por tick. */
  readonly maxHitsPerTick: number;
}

const isCount = (v: number): boolean => Number.isInteger(v) && v >= 1;

/**
 * Ventana y tope del registro de golpes (value object, ADR-0027). Solo acotan lo que se registra y
 * se expone: ninguna regla de daño ni de vida depende de ellos.
 */
export class CombatRules implements CombatConfig {
  private constructor(
    readonly hitWindowTicks: number,
    readonly maxHitsPerTick: number,
  ) {
    Object.freeze(this);
  }

  static create(config: CombatConfig): Result<CombatRules, DomainError> {
    const { hitWindowTicks, maxHitsPerTick } = config;
    if (!isCount(hitWindowTicks)) {
      return err(invalidConfig('combat.hitWindowTicks', HIT_WINDOW_MUST_BE_INTEGER));
    }
    if (!isCount(maxHitsPerTick)) {
      return err(invalidConfig('combat.maxHitsPerTick', MAX_HITS_MUST_BE_INTEGER));
    }
    return ok(new CombatRules(hitWindowTicks, maxHitsPerTick));
  }
}
