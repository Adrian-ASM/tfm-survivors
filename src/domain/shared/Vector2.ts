/** Vector 2D inmutable (value object). Base de posiciones y direcciones. */
export class Vector2 {
  static readonly ZERO = new Vector2(0, 0);

  private constructor(
    readonly x: number,
    readonly y: number,
  ) {
    Object.freeze(this);
  }

  static of(x: number, y: number): Vector2 {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RangeError(
        `Vector2 requiere componentes finitas (recibido ${String(x)}, ${String(y)})`,
      );
    }
    return new Vector2(x, y);
  }

  add(other: Vector2): Vector2 {
    return Vector2.of(this.x + other.x, this.y + other.y);
  }

  scale(factor: number): Vector2 {
    return Vector2.of(this.x * factor, this.y * factor);
  }

  length(): number {
    return Math.hypot(this.x, this.y);
  }
}
