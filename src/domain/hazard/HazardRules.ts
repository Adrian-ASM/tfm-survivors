import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';

export const MAX_DYNAMITES_MUST_BE_INTEGER = 'El tope de dinamitas debe ser un entero ≥ 1.';
export const DYNAMITE_RADIUS_MUST_BE_POSITIVE = 'El radio visual de la dinamita debe ser positivo.';
export const BLAST_TICKS_MUST_BE_INTEGER =
  'La duración visible de una explosión debe ser un entero ≥ 1 (ticks).';

/** Forma de los globales de peligros en content/enemies.json (`hazards`). */
export interface HazardRulesConfig {
  /** Dinamitas en vuelo a la vez como mucho (las mechas y explosiones no cuentan). */
  readonly maxDynamites: number;
  /** Radio visual de la dinamita en vuelo (no colisiona con nada). */
  readonly dynamiteRadius: number;
  /** Ticks que una explosión figura en el snapshot (solo hace daño en su tick). */
  readonly blastTicks: number;
}

const PATH = 'enemies.hazards';

/** Globales de los peligros de área (value object, spec enemy-hazards). */
export class HazardRules implements HazardRulesConfig {
  private constructor(
    readonly maxDynamites: number,
    readonly dynamiteRadius: number,
    readonly blastTicks: number,
  ) {
    Object.freeze(this);
  }

  static create(config: HazardRulesConfig): Result<HazardRules, DomainError> {
    const { maxDynamites, dynamiteRadius, blastTicks } = config;
    if (!Number.isInteger(maxDynamites) || maxDynamites < 1) {
      return err(invalidConfig(`${PATH}.maxDynamites`, MAX_DYNAMITES_MUST_BE_INTEGER));
    }
    if (!Number.isFinite(dynamiteRadius) || dynamiteRadius <= 0) {
      return err(invalidConfig(`${PATH}.dynamiteRadius`, DYNAMITE_RADIUS_MUST_BE_POSITIVE));
    }
    if (!Number.isInteger(blastTicks) || blastTicks < 1) {
      return err(invalidConfig(`${PATH}.blastTicks`, BLAST_TICKS_MUST_BE_INTEGER));
    }
    return ok(new HazardRules(maxDynamites, dynamiteRadius, blastTicks));
  }
}
