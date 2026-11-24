import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { TICK_SECONDS } from '../shared/Tick';
import type { PickupKind } from './PickupKind';

/** Mensajes de las invariantes de los recogibles; la validación de contenido (zod) usa los mismos. */
export const GEM_RADIUS_MUST_BE_POSITIVE = 'El radio de una gema debe ser positivo.';
export const MAGNET_SPEED_MUST_BE_POSITIVE = 'La velocidad del imán debe ser positiva.';
export const MAX_GEMS_MUST_BE_INTEGER = 'El tope de gemas en el suelo debe ser un entero ≥ 1.';
export const MAX_GOLD_MUST_BE_INTEGER =
  'El tope de recogibles de oro en el suelo debe ser un entero ≥ 1.';
export const MAX_WOOD_MUST_BE_INTEGER =
  'El tope de recogibles de madera en el suelo debe ser un entero ≥ 1.';

const PATH = 'progression';

/** Parámetros de los recogibles en el contenido (fichero de progresión). */
export interface PickupRulesConfig {
  /** Radio de los tres tipos. */
  readonly gemRadius: number;
  /** px/s. */
  readonly magnetSpeed: number;
  /** Tope de gemas (`xp`) en el suelo. */
  readonly maxGems: number;
  readonly maxGold: number;
  readonly maxWood: number;
}

const isPositive = (v: number): boolean => Number.isFinite(v) && v > 0;
const isCount = (v: number): boolean => Number.isInteger(v) && v >= 1;

/** Reglas de los recogibles con tipo (value object, spec xp-gems, ADR-0021): tope por tipo. */
export class PickupRules {
  /** Distancia que avanza un recogible atraído en un tick (`magnetSpeed / 60`). */
  readonly pullPerTick: number;
  /** Suma de los tres topes: la reserva de registros (y de sprites) de la partida. */
  readonly capacity: number;

  private constructor(
    readonly gemRadius: number,
    readonly magnetSpeed: number,
    readonly maxGems: number,
    readonly maxGold: number,
    readonly maxWood: number,
  ) {
    this.pullPerTick = magnetSpeed * TICK_SECONDS;
    this.capacity = maxGems + maxGold + maxWood;
    Object.freeze(this);
  }

  /** Tope en el suelo del tipo. */
  max(kind: PickupKind): number {
    if (kind === 'xp') return this.maxGems;
    return kind === 'gold' ? this.maxGold : this.maxWood;
  }

  static create(config: PickupRulesConfig): Result<PickupRules, DomainError> {
    const { gemRadius, magnetSpeed, maxGems, maxGold, maxWood } = config;
    if (!isPositive(gemRadius)) {
      return err(invalidConfig(`${PATH}.gemRadius`, GEM_RADIUS_MUST_BE_POSITIVE));
    }
    if (!isPositive(magnetSpeed)) {
      return err(invalidConfig(`${PATH}.magnetSpeed`, MAGNET_SPEED_MUST_BE_POSITIVE));
    }
    if (!isCount(maxGems)) return err(invalidConfig(`${PATH}.maxGems`, MAX_GEMS_MUST_BE_INTEGER));
    if (!isCount(maxGold)) return err(invalidConfig(`${PATH}.maxGold`, MAX_GOLD_MUST_BE_INTEGER));
    if (!isCount(maxWood)) return err(invalidConfig(`${PATH}.maxWood`, MAX_WOOD_MUST_BE_INTEGER));
    return ok(new PickupRules(gemRadius, magnetSpeed, maxGems, maxGold, maxWood));
  }
}
