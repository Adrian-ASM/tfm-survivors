import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { Vector2 } from '../shared/Vector2';

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** Zona jugable rectangular (value object). Invariante: ancho y alto positivos y finitos. */
export class Arena {
  private constructor(
    readonly width: number,
    readonly height: number,
  ) {
    Object.freeze(this);
  }

  static create(width: number, height: number): Result<Arena, DomainError> {
    if (!Number.isFinite(width) || width <= 0) {
      return err(invalidConfig('arena.width', 'El ancho de la arena debe ser positivo.'));
    }
    if (!Number.isFinite(height) || height <= 0) {
      return err(invalidConfig('arena.height', 'El alto de la arena debe ser positivo.'));
    }
    return ok(new Arena(width, height));
  }

  get center(): Vector2 {
    return Vector2.of(this.width / 2, this.height / 2);
  }

  /** ¿Cabe un círculo de este radio entero dentro de la arena? */
  fits(radius: number): boolean {
    return radius > 0 && 2 * radius <= this.width && 2 * radius <= this.height;
  }

  /** Mueve el centro de un círculo lo mínimo para que el círculo quede entero dentro. */
  clampCircle(center: Vector2, radius: number): Vector2 {
    return Vector2.of(
      clamp(center.x, radius, this.width - radius),
      clamp(center.y, radius, this.height - radius),
    );
  }
}
