import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';

/** Mensajes de las invariantes de la curva; la validación de contenido (zod) usa los mismos. */
export const BASE_XP_MUST_BE_INTEGER = 'La XP base de la curva debe ser un entero ≥ 1.';
export const XP_GROWTH_MUST_BE_INTEGER = 'El crecimiento de la curva de XP debe ser un entero ≥ 0.';

const PATH = 'progression';

/** Parámetros de la curva en el contenido (fichero de progresión). */
export interface XpCurveConfig {
  readonly baseXp: number;
  readonly xpGrowth: number;
}

/**
 * Curva de XP (value object, spec leveling): `toNext(n) = baseXp + xpGrowth · (n − 1)`. Con
 * enteros, la XP nunca sufre errores de coma flotante.
 */
export class XpCurve {
  private constructor(
    readonly baseXp: number,
    readonly xpGrowth: number,
  ) {
    Object.freeze(this);
  }

  static create(config: XpCurveConfig): Result<XpCurve, DomainError> {
    const { baseXp, xpGrowth } = config;
    if (!Number.isInteger(baseXp) || baseXp < 1) {
      return err(invalidConfig(`${PATH}.baseXp`, BASE_XP_MUST_BE_INTEGER));
    }
    if (!Number.isInteger(xpGrowth) || xpGrowth < 0) {
      return err(invalidConfig(`${PATH}.xpGrowth`, XP_GROWTH_MUST_BE_INTEGER));
    }
    return ok(new XpCurve(baseXp, xpGrowth));
  }

  /** XP necesaria para pasar del nivel `level` (≥ 1) al siguiente. */
  toNext(level: number): number {
    return this.baseXp + this.xpGrowth * (level - 1);
  }
}
