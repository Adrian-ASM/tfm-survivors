import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';

export const VIEW_SIZE_MUST_BE_POSITIVE = 'El tamaño de la vista debe ser positivo.';

const isPositive = (v: number): boolean => Number.isFinite(v) && v > 0;

/**
 * Lo que el jugador ve del mundo, en unidades de mundo (value object). Los enemigos nacen fuera de ella.
 * Invariante: ancho y alto positivos y finitos.
 */
export class View {
  /** Mitad de la diagonal: distancia del centro de la vista a cualquiera de sus esquinas. */
  readonly halfDiagonal: number;

  private constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.halfDiagonal = Math.hypot(width, height) / 2;
    Object.freeze(this);
  }

  static create(width: number, height: number): Result<View, DomainError> {
    if (!isPositive(width)) {
      return err(invalidConfig('arena.view.width', VIEW_SIZE_MUST_BE_POSITIVE));
    }
    if (!isPositive(height)) {
      return err(invalidConfig('arena.view.height', VIEW_SIZE_MUST_BE_POSITIVE));
    }
    return ok(new View(width, height));
  }
}
