import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { TICK_SECONDS } from '../shared/Tick';

/** Mensajes de las invariantes de las gemas; la validación de contenido (zod) usa los mismos. */
export const GEM_RADIUS_MUST_BE_POSITIVE = 'El radio de una gema debe ser positivo.';
export const MAGNET_SPEED_MUST_BE_POSITIVE = 'La velocidad del imán debe ser positiva.';
export const MAX_GEMS_MUST_BE_INTEGER = 'El tope de gemas en el suelo debe ser un entero ≥ 1.';

const PATH = 'progression';

/** Parámetros de las gemas en el contenido (fichero de progresión). */
export interface GemRulesConfig {
  readonly gemRadius: number;
  /** px/s. */
  readonly magnetSpeed: number;
  readonly maxGems: number;
}

const isPositive = (v: number): boolean => Number.isFinite(v) && v > 0;

/** Reglas de las gemas de XP (value object, spec xp-gems). */
export class GemRules {
  /** Distancia que avanza una gema atraída en un tick (`magnetSpeed / 60`). */
  readonly pullPerTick: number;

  private constructor(
    readonly gemRadius: number,
    readonly magnetSpeed: number,
    readonly maxGems: number,
  ) {
    this.pullPerTick = magnetSpeed * TICK_SECONDS;
    Object.freeze(this);
  }

  static create(config: GemRulesConfig): Result<GemRules, DomainError> {
    const { gemRadius, magnetSpeed, maxGems } = config;
    if (!isPositive(gemRadius)) {
      return err(invalidConfig(`${PATH}.gemRadius`, GEM_RADIUS_MUST_BE_POSITIVE));
    }
    if (!isPositive(magnetSpeed)) {
      return err(invalidConfig(`${PATH}.magnetSpeed`, MAGNET_SPEED_MUST_BE_POSITIVE));
    }
    if (!Number.isInteger(maxGems) || maxGems < 1) {
      return err(invalidConfig(`${PATH}.maxGems`, MAX_GEMS_MUST_BE_INTEGER));
    }
    return ok(new GemRules(gemRadius, magnetSpeed, maxGems));
  }
}
